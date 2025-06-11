-- Enable RLS on additional tables
ALTER TABLE programs ENABLE ROW LEVEL SECURITY;
ALTER TABLE members ENABLE ROW LEVEL SECURITY;
ALTER TABLE program_memberships ENABLE ROW LEVEL SECURITY;
ALTER TABLE users ENABLE ROW LEVEL SECURITY;
ALTER TABLE events ENABLE ROW LEVEL SECURITY;
ALTER TABLE roles ENABLE ROW LEVEL SECURITY;

-- RLS Policies for programs table
CREATE POLICY "Programs are viewable by club members"
    ON programs FOR SELECT
    USING (
        EXISTS (
            SELECT 1 FROM users
            WHERE users.club_id = programs.club_id
            AND users.id::text = auth.uid()::text
            AND users.is_active = true
        )
    );

CREATE POLICY "Programs are manageable by club admins"
    ON programs FOR ALL
    USING (
        EXISTS (
            SELECT 1 FROM users u
            JOIN roles r ON r.id = u.role_id
            WHERE u.club_id = programs.club_id
            AND u.id::text = auth.uid()::text
            AND u.is_active = true
            AND r.permissions->>'can_manage_programs' = 'true'
        )
    );

-- RLS Policies for members table
CREATE POLICY "Members are viewable by club members"
    ON members FOR SELECT
    USING (
        EXISTS (
            SELECT 1 FROM users
            WHERE users.club_id = members.club_id
            AND users.id::text = auth.uid()::text
            AND users.is_active = true
        )
    );

CREATE POLICY "Members are manageable by club admins"
    ON members FOR ALL
    USING (
        EXISTS (
            SELECT 1 FROM users u
            JOIN roles r ON r.id = u.role_id
            WHERE u.club_id = members.club_id
            AND u.id::text = auth.uid()::text
            AND u.is_active = true
            AND r.permissions->>'can_manage_members' = 'true'
        )
    );

-- RLS Policies for program_memberships table
CREATE POLICY "Program memberships are viewable by club members"
    ON program_memberships FOR SELECT
    USING (
        EXISTS (
            SELECT 1 FROM users
            WHERE users.club_id = (
                SELECT club_id FROM programs WHERE id = program_memberships.program_id
            )
            AND users.id::text = auth.uid()::text
            AND users.is_active = true
        )
    );

CREATE POLICY "Program memberships are manageable by club admins"
    ON program_memberships FOR ALL
    USING (
        EXISTS (
            SELECT 1 FROM users u
            JOIN roles r ON r.id = u.role_id
            JOIN programs p ON p.club_id = u.club_id
            WHERE p.id = program_memberships.program_id
            AND u.id::text = auth.uid()::text
            AND u.is_active = true
            AND r.permissions->>'can_manage_programs' = 'true'
        )
    );

-- RLS Policies for users table
CREATE POLICY "Users are viewable by club members"
    ON users FOR SELECT
    USING (
        EXISTS (
            SELECT 1 FROM users u
            WHERE u.club_id = users.club_id
            AND u.id::text = auth.uid()::text
            AND u.is_active = true
        )
    );

CREATE POLICY "Users are manageable by club admins"
    ON users FOR ALL
    USING (
        EXISTS (
            SELECT 1 FROM users u
            JOIN roles r ON r.id = u.role_id
            WHERE u.club_id = users.club_id
            AND u.id::text = auth.uid()::text
            AND u.is_active = true
            AND r.permissions->>'can_manage_users' = 'true'
        )
    );

-- Improve existing policies

-- Add INSERT policy for clubs
CREATE POLICY "Clubs can be created by authenticated users"
    ON clubs FOR INSERT
    WITH CHECK (auth.uid() IS NOT NULL);

-- Add DELETE policy for clubs
CREATE POLICY "Clubs can be deleted by their admins"
    ON clubs FOR DELETE
    USING (
        EXISTS (
            SELECT 1 FROM users u
            JOIN roles r ON r.id = u.role_id
            WHERE u.club_id = clubs.id
            AND u.id::text = auth.uid()::text
            AND u.is_active = true
            AND r.permissions->>'can_manage_club' = 'true'
        )
    );

-- Add DELETE policy for events
CREATE POLICY "Events can be deleted by club admins"
    ON events FOR DELETE
    USING (
        EXISTS (
            SELECT 1 FROM users u
            JOIN roles r ON r.id = u.role_id
            WHERE u.club_id = events.club_id
            AND u.id::text = auth.uid()::text
            AND u.is_active = true
            AND r.permissions->>'can_manage_events' = 'true'
        )
    );

-- Helper function to check if user is club member
CREATE OR REPLACE FUNCTION is_club_member(club_id UUID)
RETURNS BOOLEAN AS $$
BEGIN
    RETURN EXISTS (
        SELECT 1 FROM users
        WHERE users.club_id = $1
        AND users.id::text = auth.uid()::text
        AND users.is_active = true
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Helper function to check if user is club admin
CREATE OR REPLACE FUNCTION is_club_admin(club_id UUID)
RETURNS BOOLEAN AS $$
BEGIN
    RETURN EXISTS (
        SELECT 1 FROM users u
        JOIN roles r ON r.id = u.role_id
        WHERE u.club_id = $1
        AND u.id::text = auth.uid()::text
        AND u.is_active = true
        AND r.permissions->>'can_manage_club' = 'true'
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER; 