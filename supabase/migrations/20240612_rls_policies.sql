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

-- Create function for direct auth user deletion
CREATE OR REPLACE FUNCTION delete_auth_user(user_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth
AS $$
BEGIN
  -- Delete from auth.users with proper schema reference
  DELETE FROM auth.users WHERE id = user_id;
  
  -- Also delete from auth.identities if exists
  DELETE FROM auth.identities WHERE user_id = user_id;
  
  -- Delete from auth.sessions if exists
  DELETE FROM auth.sessions WHERE user_id = user_id;
END;
$$;

-- Enable RLS on additional tables
ALTER TABLE programs ENABLE ROW LEVEL SECURITY;
ALTER TABLE members ENABLE ROW LEVEL SECURITY;
ALTER TABLE program_memberships ENABLE ROW LEVEL SECURITY;
ALTER TABLE users ENABLE ROW LEVEL SECURITY;
ALTER TABLE events ENABLE ROW LEVEL SECURITY;
ALTER TABLE roles ENABLE ROW LEVEL SECURITY;
ALTER TABLE clubs ENABLE ROW LEVEL SECURITY;

-- Service role bypass for all tables
CREATE POLICY "Service role bypass"
    ON programs FOR ALL
    USING (auth.jwt() ->> 'role' = 'service_role');

CREATE POLICY "Service role bypass"
    ON members FOR ALL
    USING (auth.jwt() ->> 'role' = 'service_role');

CREATE POLICY "Service role bypass"
    ON program_memberships FOR ALL
    USING (auth.jwt() ->> 'role' = 'service_role');

CREATE POLICY "Service role bypass"
    ON users FOR ALL
    USING (auth.jwt() ->> 'role' = 'service_role');

CREATE POLICY "Service role bypass"
    ON events FOR ALL
    USING (auth.jwt() ->> 'role' = 'service_role');

CREATE POLICY "Service role bypass"
    ON roles FOR ALL
    USING (auth.jwt() ->> 'role' = 'service_role');

CREATE POLICY "Service role bypass"
    ON clubs FOR ALL
    USING (auth.jwt() ->> 'role' = 'service_role');

-- Basic policies for clubs
CREATE POLICY "Clubs are viewable by anyone"
    ON clubs FOR SELECT
    USING (true);

CREATE POLICY "Clubs can be created by authenticated users"
    ON clubs FOR INSERT
    WITH CHECK (auth.uid() IS NOT NULL);

CREATE POLICY "Clubs are manageable by owners"
    ON clubs FOR UPDATE
    USING (auth.uid()::text = owner_id::text);

-- Basic policies for members
CREATE POLICY "Members are viewable by club members"
    ON members FOR SELECT
    USING (
        EXISTS (
            SELECT 1 FROM clubs c
            WHERE c.id = members.club_id
            AND (
                c.owner_id::text = auth.uid()::text
                OR EXISTS (
                    SELECT 1 FROM members m
                    WHERE m.club_id = c.id
                    AND m.user_id::text = auth.uid()::text
                )
            )
        )
    );

CREATE POLICY "Members are manageable by club owners"
    ON members FOR ALL
    USING (
        EXISTS (
            SELECT 1 FROM clubs c
            WHERE c.id = members.club_id
            AND c.owner_id::text = auth.uid()::text
        )
    );

-- Basic policies for users
CREATE POLICY "Users can view their own data"
    ON users FOR SELECT
    USING (id::text = auth.uid()::text);

CREATE POLICY "Users can update their own data"
    ON users FOR UPDATE
    USING (id::text = auth.uid()::text);

CREATE POLICY "Users can be created during signup"
    ON users FOR INSERT
    WITH CHECK (
        id::text = auth.uid()::text
        OR auth.jwt() ->> 'role' = 'service_role'
    );

-- Basic policies for programs
CREATE POLICY "Programs are viewable by club members"
    ON programs FOR SELECT
    USING (
        EXISTS (
            SELECT 1 FROM members m
            WHERE m.club_id = programs.club_id
            AND m.user_id::text = auth.uid()::text
        )
    );

CREATE POLICY "Programs are manageable by club owners"
    ON programs FOR ALL
    USING (
        EXISTS (
            SELECT 1 FROM clubs c
            WHERE c.id = programs.club_id
            AND c.owner_id::text = auth.uid()::text
        )
    );

-- Basic policies for program_memberships
CREATE POLICY "Program memberships are viewable by club members"
    ON program_memberships FOR SELECT
    USING (
        EXISTS (
            SELECT 1 FROM programs p
            JOIN members m ON m.club_id = p.club_id
            WHERE p.id = program_memberships.program_id
            AND m.user_id::text = auth.uid()::text
        )
    );

CREATE POLICY "Program memberships are manageable by club owners"
    ON program_memberships FOR ALL
    USING (
        EXISTS (
            SELECT 1 FROM programs p
            JOIN clubs c ON c.id = p.club_id
            WHERE p.id = program_memberships.program_id
            AND c.owner_id::text = auth.uid()::text
        )
    );

-- Basic policies for events
CREATE POLICY "Events are viewable by club members"
    ON events FOR SELECT
    USING (
        EXISTS (
            SELECT 1 FROM members m
            WHERE m.club_id = events.club_id
            AND m.user_id::text = auth.uid()::text
        )
    );

CREATE POLICY "Events are manageable by club owners"
    ON events FOR ALL
    USING (
        EXISTS (
            SELECT 1 FROM clubs c
            WHERE c.id = events.club_id
            AND c.owner_id::text = auth.uid()::text
        )
    ); 