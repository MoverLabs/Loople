-- First disable RLS on all tables
ALTER TABLE programs DISABLE ROW LEVEL SECURITY;
ALTER TABLE members DISABLE ROW LEVEL SECURITY;
ALTER TABLE program_memberships DISABLE ROW LEVEL SECURITY;
ALTER TABLE users DISABLE ROW LEVEL SECURITY;
ALTER TABLE events DISABLE ROW LEVEL SECURITY;
ALTER TABLE event_registrations DISABLE ROW LEVEL SECURITY;
ALTER TABLE roles DISABLE ROW LEVEL SECURITY;
ALTER TABLE clubs DISABLE ROW LEVEL SECURITY;
ALTER TABLE posts DISABLE ROW LEVEL SECURITY;
ALTER TABLE comments DISABLE ROW LEVEL SECURITY;
ALTER TABLE reactions DISABLE ROW LEVEL SECURITY;
ALTER TABLE media_attachments DISABLE ROW LEVEL SECURITY;
ALTER TABLE storage.objects DISABLE ROW LEVEL SECURITY;
ALTER TABLE user_preferences DISABLE ROW LEVEL SECURITY;

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

-- Remove existing storage policies for post-media bucket
DROP POLICY IF EXISTS "Post media files are viewable by club members" ON storage.objects;
DROP POLICY IF EXISTS "Post media files can be uploaded by club members" ON storage.objects;
DROP POLICY IF EXISTS "Post media files can be updated by post authors" ON storage.objects;
DROP POLICY IF EXISTS "Post media files can be deleted by post authors" ON storage.objects;
DROP POLICY IF EXISTS "Service role bypass" ON storage.objects;

-- Create function for direct auth user deletion
DROP FUNCTION IF EXISTS delete_auth_user(uuid);

CREATE OR REPLACE FUNCTION delete_auth_user(p_user_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth
AS $$
BEGIN
  -- Delete from auth.users with proper schema reference
  DELETE FROM auth.users WHERE id = p_user_id;
  
  -- Also delete from auth.identities if exists
  DELETE FROM auth.identities WHERE user_id = p_user_id;
  
  -- Delete from auth.sessions if exists
  DELETE FROM auth.sessions WHERE user_id = p_user_id;
END;
$$;

-- Enable RLS on additional tables
ALTER TABLE programs ENABLE ROW LEVEL SECURITY;
ALTER TABLE members ENABLE ROW LEVEL SECURITY;
ALTER TABLE program_memberships ENABLE ROW LEVEL SECURITY;
ALTER TABLE users ENABLE ROW LEVEL SECURITY;
ALTER TABLE events ENABLE ROW LEVEL SECURITY;
ALTER TABLE event_registrations ENABLE ROW LEVEL SECURITY;
ALTER TABLE roles ENABLE ROW LEVEL SECURITY;
ALTER TABLE clubs ENABLE ROW LEVEL SECURITY;
ALTER TABLE posts ENABLE ROW LEVEL SECURITY;
ALTER TABLE comments ENABLE ROW LEVEL SECURITY;
ALTER TABLE reactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE media_attachments ENABLE ROW LEVEL SECURITY;
-- storage.objects is managed by storage extension but we still define policies; no ENABLE needed here
ALTER TABLE user_preferences ENABLE ROW LEVEL SECURITY;

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

CREATE POLICY "Service role bypass"
    ON posts FOR ALL
    USING (auth.jwt() ->> 'role' = 'service_role');

CREATE POLICY "Service role bypass"
    ON comments FOR ALL
    USING (auth.jwt() ->> 'role' = 'service_role');

CREATE POLICY "Service role bypass"
    ON reactions FOR ALL
    USING (auth.jwt() ->> 'role' = 'service_role');

CREATE POLICY "Service role bypass"
    ON media_attachments FOR ALL
    USING (auth.jwt() ->> 'role' = 'service_role');

CREATE POLICY "Service role bypass"
    ON event_registrations FOR ALL
    USING (auth.jwt() ->> 'role' = 'service_role');

CREATE POLICY "Service role bypass"
    ON storage.objects FOR ALL
    USING (auth.jwt() ->> 'role' = 'service_role');

-- Avatars bucket policies
CREATE POLICY "Avatars are viewable by anyone"
    ON storage.objects FOR SELECT
    USING (
        bucket_id = 'avatars'
    );

CREATE POLICY "Users can upload their avatar"
    ON storage.objects FOR INSERT
    WITH CHECK (
        bucket_id = 'avatars' AND
        owner = auth.uid()
    );

CREATE POLICY "Users can update their avatar"
    ON storage.objects FOR UPDATE
    USING (
        bucket_id = 'avatars' AND
        owner = auth.uid()
    );

CREATE POLICY "Users can delete their avatar"
    ON storage.objects FOR DELETE
    USING (
        bucket_id = 'avatars' AND
        owner = auth.uid()
    );

CREATE POLICY "Service role bypass"
    ON user_preferences FOR ALL
    USING (auth.jwt() ->> 'role' = 'service_role');

-- Basic policies for clubs
CREATE POLICY "Clubs are viewable by anyone"
    ON clubs FOR SELECT
    USING (true);

CREATE POLICY "Clubs can be created by authenticated users and service role"
    ON clubs FOR INSERT
    WITH CHECK (
        auth.uid() IS NOT NULL 
        OR auth.jwt() ->> 'role' = 'service_role'
    );

CREATE POLICY "Clubs are manageable by owners"
    ON clubs FOR UPDATE
    USING (auth.uid()::text = owner_id::text);

-- Basic policies for members
CREATE POLICY "Members are viewable by club members and owners"
    ON members FOR SELECT
    USING (
        -- Club owners can view all members
        EXISTS (
            SELECT 1 FROM clubs c
            WHERE c.id = members.club_id
            AND c.owner_id::text = auth.uid()::text
        )
        OR
        -- Members can view other members in their clubs
        members.user_id = auth.uid()::text
        OR
        -- Members can view by email match
        members.email = auth.jwt() ->> 'email'
        OR
        -- Service role can view all
        (auth.jwt() ->> 'role') = 'service_role'
    );

CREATE POLICY "Members can be created by authenticated users"
    ON members FOR INSERT
    WITH CHECK (
        auth.uid() IS NOT NULL 
        AND (
            -- Users can create their own membership
            auth.uid()::text = user_id::text
            OR
            -- Club owners can create memberships for others
            EXISTS (
                SELECT 1 FROM clubs c
                WHERE c.id = club_id
                AND c.owner_id::text = auth.uid()::text
            )
        )
        AND EXISTS (
            SELECT 1 FROM clubs c
            WHERE c.id = club_id
        )
    );

CREATE POLICY "Members can be managed by club owners"
    ON members FOR UPDATE
    USING (
        EXISTS (
            SELECT 1 FROM clubs c
            WHERE c.id = members.club_id
            AND c.owner_id::text = auth.uid()::text
        )
    );

CREATE POLICY "Members can be deleted by club owners"
    ON members FOR DELETE
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

-- Event registrations policies
CREATE POLICY "Event registrations are viewable by club members"
    ON event_registrations FOR SELECT
    USING (
        EXISTS (
            SELECT 1 FROM events e 
            JOIN members m ON m.club_id = e.club_id 
            WHERE e.id = event_registrations.event_id 
            AND m.user_id::text = auth.uid()::text
        )
    );

CREATE POLICY "Event registrations are manageable by club owners"
    ON event_registrations FOR ALL
    USING (
        EXISTS (
            SELECT 1 FROM events e 
            JOIN clubs c ON c.id = e.club_id 
            WHERE e.id = event_registrations.event_id 
            AND c.owner_id::text = auth.uid()::text
        )
    );

CREATE POLICY "Members can create their own registrations"
    ON event_registrations FOR INSERT
    WITH CHECK (
        EXISTS (
            SELECT 1 FROM members m 
            WHERE m.id = event_registrations.member_id 
            AND m.user_id::text = auth.uid()::text
        )
    );

CREATE POLICY "Members can update their own registrations"
    ON event_registrations FOR UPDATE
    USING (
        EXISTS (
            SELECT 1 FROM members m 
            WHERE m.id = event_registrations.member_id 
            AND m.user_id::text = auth.uid()::text
        )
    )
    WITH CHECK (
        EXISTS (
            SELECT 1 FROM members m 
            WHERE m.id = event_registrations.member_id 
            AND m.user_id::text = auth.uid()::text
        )
    );

CREATE POLICY "Members can delete their own registrations"
    ON event_registrations FOR DELETE
    USING (
        EXISTS (
            SELECT 1 FROM members m 
            WHERE m.id = event_registrations.member_id 
            AND m.user_id::text = auth.uid()::text
        )
    );

-- Note: Members SELECT policy is already defined above as "Members are viewable by club members and owners"

-- Posts policies
CREATE POLICY "Posts are viewable by club members"
    ON posts FOR SELECT
    USING (
        EXISTS (
            SELECT 1 FROM members m
            WHERE m.club_id = posts.club_id
            AND (m.user_id = auth.uid()::text OR m.email = auth.jwt() ->> 'email')
        )
    );

CREATE POLICY "Posts can be created by club members"
    ON posts FOR INSERT
    WITH CHECK (
        EXISTS (
            SELECT 1 FROM members m
            WHERE m.club_id = posts.club_id
            AND (m.user_id = auth.uid()::text OR m.email = auth.jwt() ->> 'email')
        )
    );

CREATE POLICY "Posts can be updated by their authors"
    ON posts FOR UPDATE
    USING (user_id = auth.uid());

CREATE POLICY "Posts can be deleted by their authors"
    ON posts FOR DELETE
    USING (user_id = auth.uid());

-- Comments policies
CREATE POLICY "Comments are viewable by club members"
    ON comments FOR SELECT
    USING (
        EXISTS (
            SELECT 1 FROM posts p
            JOIN members m ON m.club_id = p.club_id
            WHERE p.id = comments.post_id
            AND (m.user_id = auth.uid()::text OR m.email = auth.jwt() ->> 'email')
        )
    );

CREATE POLICY "Comments can be created by club members"
    ON comments FOR INSERT
    WITH CHECK (
        EXISTS (
            SELECT 1 FROM posts p
            JOIN members m ON m.club_id = p.club_id
            WHERE p.id = comments.post_id
            AND (m.user_id = auth.uid()::text OR m.email = auth.jwt() ->> 'email')
        )
    );

CREATE POLICY "Comments can be updated by their authors"
    ON comments FOR UPDATE
    USING (user_id = auth.uid()::text);

CREATE POLICY "Comments can be deleted by their authors"
    ON comments FOR DELETE
    USING (user_id = auth.uid()::text);

-- Reactions policies
CREATE POLICY "Reactions are viewable by club members"
    ON reactions FOR SELECT
    USING (
        (post_id IS NOT NULL AND EXISTS (
            SELECT 1 FROM posts p
            JOIN members m ON m.club_id = p.club_id
            WHERE p.id = reactions.post_id
            AND (m.user_id = auth.uid()::text OR m.email = auth.jwt() ->> 'email')
        )) OR
        (comment_id IS NOT NULL AND EXISTS (
            SELECT 1 FROM comments c
            JOIN posts p ON p.id = c.post_id
            JOIN members m ON m.club_id = p.club_id
            WHERE c.id = reactions.comment_id
            AND (m.user_id = auth.uid()::text OR m.email = auth.jwt() ->> 'email')
        ))
    );

CREATE POLICY "Reactions can be created by club members"
    ON reactions FOR INSERT
    WITH CHECK (
        (post_id IS NOT NULL AND EXISTS (
            SELECT 1 FROM posts p
            JOIN members m ON m.club_id = p.club_id
            WHERE p.id = reactions.post_id
            AND (m.user_id = auth.uid()::text OR m.email = auth.jwt() ->> 'email')
        )) OR
        (comment_id IS NOT NULL AND EXISTS (
            SELECT 1 FROM comments c
            JOIN posts p ON p.id = c.post_id
            JOIN members m ON m.club_id = p.club_id
            WHERE c.id = reactions.comment_id
            AND (m.user_id = auth.uid()::text OR m.email = auth.jwt() ->> 'email')
        ))
    );

CREATE POLICY "Reactions can be updated by their authors"
    ON reactions FOR UPDATE
    USING (user_id = auth.uid());

CREATE POLICY "Reactions can be deleted by their authors"
    ON reactions FOR DELETE
    USING (user_id = auth.uid());

-- Media attachments policies
CREATE POLICY "Media attachments are viewable by club members"
    ON media_attachments FOR SELECT
    USING (
        EXISTS (
            SELECT 1 FROM posts p
            JOIN members m ON m.club_id = p.club_id
            WHERE p.id = media_attachments.post_id
            AND p.is_active = true
            AND (m.user_id = auth.uid()::text OR m.email = auth.jwt() ->> 'email')
        )
    );

CREATE POLICY "Media attachments can be created by post authors"
    ON media_attachments FOR INSERT
    WITH CHECK (
        EXISTS (
            SELECT 1 FROM posts p
            WHERE p.id = media_attachments.post_id
            AND p.user_id = auth.uid()
            AND p.is_active = true
        )
    );

CREATE POLICY "Media attachments can be updated by post authors"
    ON media_attachments FOR UPDATE
    USING (
        EXISTS (
            SELECT 1 FROM posts p
            WHERE p.id = media_attachments.post_id
            AND p.user_id = auth.uid()
            AND p.is_active = true
        )
    );

CREATE POLICY "Media attachments can be deleted by post authors"
    ON media_attachments FOR DELETE
    USING (
        EXISTS (
            SELECT 1 FROM posts p
            WHERE p.id = media_attachments.post_id
            AND p.user_id = auth.uid()
            AND p.is_active = true
        )
    );

-- Storage bucket policies for post-media
CREATE POLICY "Post media files are viewable by club members"
    ON storage.objects FOR SELECT
    USING (
        bucket_id = 'post-media' 
        AND EXISTS (
            SELECT 1 FROM posts p
            JOIN members m ON m.club_id = p.club_id
            WHERE p.id = split_part(name, '/', 1)::bigint
            AND p.is_active = true
            AND (m.user_id = auth.uid()::text OR m.email = auth.jwt() ->> 'email')
        )
    );

CREATE POLICY "Post media files can be uploaded by club members"
    ON storage.objects FOR INSERT
    WITH CHECK (
        bucket_id = 'post-media' 
        AND EXISTS (
            SELECT 1 FROM posts p
            JOIN members m ON m.club_id = p.club_id
            WHERE p.id = split_part(name, '/', 1)::bigint
            AND p.is_active = true
            AND (m.user_id = auth.uid()::text OR m.email = auth.jwt() ->> 'email')
        )
    );

CREATE POLICY "Post media files can be updated by post authors"
    ON storage.objects FOR UPDATE
    USING (
        bucket_id = 'post-media' 
        AND EXISTS (
            SELECT 1 FROM posts p
            WHERE p.id = split_part(name, '/', 1)::bigint
            AND p.user_id = auth.uid()
            AND p.is_active = true
        )
    );

CREATE POLICY "Post media files can be deleted by post authors"
    ON storage.objects FOR DELETE
    USING (
        bucket_id = 'post-media' 
        AND EXISTS (
            SELECT 1 FROM posts p
            WHERE p.id = split_part(name, '/', 1)::bigint
            AND p.user_id = auth.uid()
            AND p.is_active = true
        )
    );

-- User preferences policies
CREATE POLICY "Users can view their own preferences"
    ON user_preferences FOR SELECT
    USING (user_id = auth.uid()::text);

CREATE POLICY "Users can create their own preferences"
    ON user_preferences FOR INSERT
    WITH CHECK (user_id = auth.uid()::text);

CREATE POLICY "Users can update their own preferences"
    ON user_preferences FOR UPDATE
    USING (user_id = auth.uid()::text)
    WITH CHECK (user_id = auth.uid()::text);

CREATE POLICY "Users can delete their own preferences"
    ON user_preferences FOR DELETE
    USING (user_id = auth.uid()::text); 