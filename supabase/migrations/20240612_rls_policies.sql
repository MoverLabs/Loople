-- First disable RLS on all tables
ALTER TABLE programs DISABLE ROW LEVEL SECURITY;
ALTER TABLE members DISABLE ROW LEVEL SECURITY;
ALTER TABLE program_memberships DISABLE ROW LEVEL SECURITY;
ALTER TABLE users DISABLE ROW LEVEL SECURITY;
ALTER TABLE events DISABLE ROW LEVEL SECURITY;
ALTER TABLE roles DISABLE ROW LEVEL SECURITY;
ALTER TABLE clubs DISABLE ROW LEVEL SECURITY;

-- Remove all existing policies
DO $$ 
DECLARE
    r RECORD;
BEGIN
    FOR r IN (SELECT tablename, policyname 
              FROM pg_policies 
              WHERE schemaname = 'public')
    LOOP
        EXECUTE format('DROP POLICY IF EXISTS %I ON %I', r.policyname, r.tablename);
    END LOOP;
END $$;

-- Enable RLS on additional tables
ALTER TABLE programs ENABLE ROW LEVEL SECURITY;
ALTER TABLE members ENABLE ROW LEVEL SECURITY;
ALTER TABLE program_memberships ENABLE ROW LEVEL SECURITY;
ALTER TABLE users ENABLE ROW LEVEL SECURITY;
ALTER TABLE events ENABLE ROW LEVEL SECURITY;
ALTER TABLE roles ENABLE ROW LEVEL SECURITY;
ALTER TABLE clubs ENABLE ROW LEVEL SECURITY;

-- Debug function to log policy checks
CREATE OR REPLACE FUNCTION log_policy_check(
    policy_name text,
    table_name text,
    operation text,
    user_id text,
    additional_info jsonb DEFAULT '{}'::jsonb
) RETURNS void AS $$
BEGIN
    INSERT INTO policy_logs (policy_name, table_name, operation, user_id, additional_info, created_at)
    VALUES (policy_name, table_name, operation, user_id, additional_info, now());
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create policy_logs table if it doesn't exist
CREATE TABLE IF NOT EXISTS policy_logs (
    id SERIAL PRIMARY KEY,
    policy_name text,
    table_name text,
    operation text,
    user_id text,
    additional_info jsonb,
    created_at timestamptz DEFAULT now()
);

-- Service role bypass for all tables
CREATE POLICY "Service role bypass"
    ON programs FOR ALL
    USING (auth.role() = 'service_role');

CREATE POLICY "Service role bypass"
    ON members FOR ALL
    USING (auth.role() = 'service_role');

CREATE POLICY "Service role bypass"
    ON program_memberships FOR ALL
    USING (auth.role() = 'service_role');

CREATE POLICY "Service role bypass"
    ON users FOR ALL
    USING (auth.role() = 'service_role');

CREATE POLICY "Service role bypass"
    ON events FOR ALL
    USING (auth.role() = 'service_role');

CREATE POLICY "Service role bypass"
    ON roles FOR ALL
    USING (auth.role() = 'service_role');

-- RLS Policies for programs table
CREATE POLICY "Programs are viewable by club members"
    ON programs FOR SELECT
    USING (
        EXISTS (
            SELECT 1 FROM members
            WHERE members.club_id = programs.club_id
            AND members.user_id::text = auth.uid()::text
        )
    );

CREATE POLICY "Programs are manageable by club admins"
    ON programs FOR ALL
    USING (
        EXISTS (
            SELECT 1 FROM members m
            JOIN users u ON u.id = m.user_id
            JOIN roles r ON r.id = u.role_id
            WHERE m.club_id = programs.club_id
            AND m.user_id::text = auth.uid()::text
            AND r.permissions->>'can_manage_programs' = 'true'
        )
    );

-- RLS Policies for members table
CREATE POLICY "Members are viewable by club members"
    ON members FOR SELECT
    USING (
        CASE 
            WHEN auth.uid()::text = user_id::text THEN
                true
            WHEN EXISTS (
                SELECT 1 FROM users u
                JOIN roles r ON r.id = u.role_id
                WHERE u.id::text = auth.uid()::text
                AND r.permissions->>'can_manage_members' = 'true'
                AND EXISTS (
                    SELECT 1 FROM members m
                    WHERE m.club_id = members.club_id
                    AND m.user_id = u.id
                )
            ) THEN
                true
            ELSE
                false
        END
    );

CREATE POLICY "Members are manageable by club admins"
    ON members FOR ALL
    USING (
        EXISTS (
            SELECT 1 FROM users u
            JOIN roles r ON r.id = u.role_id
            WHERE u.id::text = auth.uid()::text
            AND r.permissions->>'can_manage_members' = 'true'
            AND EXISTS (
                SELECT 1 FROM members m
                WHERE m.club_id = members.club_id
                AND m.user_id = u.id
            )
        )
    );

-- Special policy for signup process
CREATE POLICY "Allow member creation during signup"
    ON members FOR INSERT
    WITH CHECK (
        auth.uid()::text = user_id::text
        AND EXISTS (
            SELECT 1 FROM clubs c
            WHERE c.id = club_id
            AND c.owner_id::text = auth.uid()::text
        )
    );

-- RLS Policies for program_memberships table
CREATE POLICY "Program memberships are viewable by club members"
    ON program_memberships FOR SELECT
    USING (
        EXISTS (
            SELECT 1 FROM members m
            WHERE m.club_id = (
                SELECT club_id FROM programs WHERE id = program_memberships.program_id
            )
            AND m.user_id::text = auth.uid()::text
        )
    );

CREATE POLICY "Program memberships are manageable by club admins"
    ON program_memberships FOR ALL
    USING (
        EXISTS (
            SELECT 1 FROM members m
            JOIN users u ON u.id = m.user_id
            JOIN roles r ON r.id = u.role_id
            JOIN programs p ON p.club_id = m.club_id
            WHERE p.id = program_memberships.program_id
            AND m.user_id::text = auth.uid()::text
            AND r.permissions->>'can_manage_programs' = 'true'
        )
    );

-- RLS Policies for users table
CREATE POLICY "Users can view their own data"
    ON users FOR SELECT
    USING (id::text = auth.uid()::text);

CREATE POLICY "Users can update their own data"
    ON users FOR UPDATE
    USING (id::text = auth.uid()::text);

CREATE POLICY "Users can insert their own data"
    ON users FOR INSERT
    WITH CHECK (id::text = auth.uid()::text);

-- RLS Policies for clubs table
CREATE POLICY "Clubs can be created by authenticated users"
    ON clubs FOR INSERT
    WITH CHECK (auth.uid() IS NOT NULL);

CREATE POLICY "Clubs are viewable by members"
    ON clubs FOR SELECT
    USING (
        EXISTS (
            SELECT 1 FROM members
            WHERE members.club_id = clubs.id
            AND members.user_id::text = auth.uid()::text
        )
    );

CREATE POLICY "Clubs are manageable by admins"
    ON clubs FOR ALL
    USING (
        EXISTS (
            SELECT 1 FROM members m
            JOIN users u ON u.id = m.user_id
            JOIN roles r ON r.id = u.role_id
            WHERE m.club_id = clubs.id
            AND m.user_id::text = auth.uid()::text
            AND r.permissions->>'can_manage_club' = 'true'
        )
    );

-- Helper function to check if user is club member
CREATE OR REPLACE FUNCTION is_club_member(club_id UUID)
RETURNS BOOLEAN AS $$
BEGIN
    RETURN EXISTS (
        SELECT 1 FROM members
        WHERE members.club_id = $1
        AND members.user_id::text = auth.uid()::text
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Helper function to check if user is club admin
CREATE OR REPLACE FUNCTION is_club_admin(club_id UUID)
RETURNS BOOLEAN AS $$
BEGIN
    RETURN EXISTS (
        SELECT 1 FROM members m
        JOIN users u ON u.id = m.user_id
        JOIN roles r ON r.id = u.role_id
        WHERE m.club_id = $1
        AND m.user_id::text = auth.uid()::text
        AND r.permissions->>'can_manage_club' = 'true'
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER; 