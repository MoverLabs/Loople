-- Enable RLS on posts, comments, and reactions tables
ALTER TABLE posts ENABLE ROW LEVEL SECURITY;
ALTER TABLE comments ENABLE ROW LEVEL SECURITY;
ALTER TABLE reactions ENABLE ROW LEVEL SECURITY;

-- Posts policies
-- Users can view posts from clubs they are members of
CREATE POLICY "Users can view posts from their clubs" ON posts
    FOR SELECT USING (
        club_id IN (
            SELECT club_id FROM members 
            WHERE user_id = auth.uid() OR email = auth.jwt() ->> 'email'
        )
    );

-- Users can create posts in clubs they are members of
CREATE POLICY "Users can create posts in their clubs" ON posts
    FOR INSERT WITH CHECK (
        club_id IN (
            SELECT club_id FROM members 
            WHERE user_id = auth.uid() OR email = auth.jwt() ->> 'email'
        )
    );

-- Users can update their own posts
CREATE POLICY "Users can update their own posts" ON posts
    FOR UPDATE USING (user_id = auth.uid());

-- Users can delete their own posts
CREATE POLICY "Users can delete their own posts" ON posts
    FOR DELETE USING (user_id = auth.uid());

-- Comments policies
-- Users can view comments on posts from clubs they are members of
CREATE POLICY "Users can view comments on posts from their clubs" ON comments
    FOR SELECT USING (
        post_id IN (
            SELECT p.id FROM posts p
            JOIN members m ON p.club_id = m.club_id
            WHERE m.user_id = auth.uid() OR m.email = auth.jwt() ->> 'email'
        )
    );

-- Users can create comments on posts from clubs they are members of
CREATE POLICY "Users can create comments on posts from their clubs" ON comments
    FOR INSERT WITH CHECK (
        post_id IN (
            SELECT p.id FROM posts p
            JOIN members m ON p.club_id = m.club_id
            WHERE m.user_id = auth.uid() OR m.email = auth.jwt() ->> 'email'
        )
    );

-- Users can update their own comments
CREATE POLICY "Users can update their own comments" ON comments
    FOR UPDATE USING (user_id = auth.uid());

-- Users can delete their own comments
CREATE POLICY "Users can delete their own comments" ON comments
    FOR DELETE USING (user_id = auth.uid());

-- Reactions policies
-- Users can view reactions on posts/comments from clubs they are members of
CREATE POLICY "Users can view reactions on posts from their clubs" ON reactions
    FOR SELECT USING (
        (post_id IS NOT NULL AND post_id IN (
            SELECT p.id FROM posts p
            JOIN members m ON p.club_id = m.club_id
            WHERE m.user_id = auth.uid() OR m.email = auth.jwt() ->> 'email'
        )) OR
        (comment_id IS NOT NULL AND comment_id IN (
            SELECT c.id FROM comments c
            JOIN posts p ON c.post_id = p.id
            JOIN members m ON p.club_id = m.club_id
            WHERE m.user_id = auth.uid() OR m.email = auth.jwt() ->> 'email'
        ))
    );

-- Users can create reactions on posts/comments from clubs they are members of
CREATE POLICY "Users can create reactions on posts from their clubs" ON reactions
    FOR INSERT WITH CHECK (
        (post_id IS NOT NULL AND post_id IN (
            SELECT p.id FROM posts p
            JOIN members m ON p.club_id = m.club_id
            WHERE m.user_id = auth.uid() OR m.email = auth.jwt() ->> 'email'
        )) OR
        (comment_id IS NOT NULL AND comment_id IN (
            SELECT c.id FROM comments c
            JOIN posts p ON c.post_id = p.id
            JOIN members m ON p.club_id = m.club_id
            WHERE m.user_id = auth.uid() OR m.email = auth.jwt() ->> 'email'
        ))
    );

-- Users can update their own reactions
CREATE POLICY "Users can update their own reactions" ON reactions
    FOR UPDATE USING (user_id = auth.uid());

-- Users can delete their own reactions
CREATE POLICY "Users can delete their own reactions" ON reactions
    FOR DELETE USING (user_id = auth.uid());
