-- Drop existing policies if they exist
DO $$ 
BEGIN
    -- Drop policies for programs
    DROP POLICY IF EXISTS "Service role bypass" ON programs;
    DROP POLICY IF EXISTS "Programs are viewable by club members" ON programs;
    DROP POLICY IF EXISTS "Programs are manageable by club admins" ON programs;

    -- Drop policies for members
    DROP POLICY IF EXISTS "Service role bypass" ON members;
    DROP POLICY IF EXISTS "Members are viewable by club members" ON members;
    DROP POLICY IF EXISTS "Members are manageable by club admins" ON members;

    -- Drop policies for program_memberships
    DROP POLICY IF EXISTS "Service role bypass" ON program_memberships;
    DROP POLICY IF EXISTS "Program memberships are viewable by club members" ON program_memberships;
    DROP POLICY IF EXISTS "Program memberships are manageable by club admins" ON program_memberships;

    -- Drop policies for users
    DROP POLICY IF EXISTS "Service role bypass" ON users;
    DROP POLICY IF EXISTS "Users can view their own data" ON users;
    DROP POLICY IF EXISTS "Users can update their own data" ON users;

    -- Drop policies for events
    DROP POLICY IF EXISTS "Service role bypass" ON events;

    -- Drop policies for roles
    DROP POLICY IF EXISTS "Service role bypass" ON roles;

    -- Drop policies for clubs
    DROP POLICY IF EXISTS "Clubs can be created by authenticated users" ON clubs;
    DROP POLICY IF EXISTS "Clubs are viewable by members" ON clubs;
    DROP POLICY IF EXISTS "Clubs are manageable by admins" ON clubs;
END $$;

-- Enable RLS on additional tables
ALTER TABLE programs ENABLE ROW LEVEL SECURITY;
ALTER TABLE members ENABLE ROW LEVEL SECURITY;
ALTER TABLE program_memberships ENABLE ROW LEVEL SECURITY;
ALTER TABLE users ENABLE ROW LEVEL SECURITY;
ALTER TABLE events ENABLE ROW LEVEL SECURITY;
ALTER TABLE roles ENABLE ROW LEVEL SECURITY;

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
        EXISTS (
            SELECT 1 FROM members m
            WHERE m.club_id = members.club_id
            AND m.user_id::text = auth.uid()::text
        )
    );

CREATE POLICY "Members are manageable by club admins"
    ON members FOR ALL
    USING (
        EXISTS (
            SELECT 1 FROM members m
            JOIN users u ON u.id = m.user_id
            JOIN roles r ON r.id = u.role_id
            WHERE m.club_id = members.club_id
            AND m.user_id::text = auth.uid()::text
            AND r.permissions->>'can_manage_members' = 'true'
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