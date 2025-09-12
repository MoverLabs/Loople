-- Fix comments table to properly reference public.users instead of auth.users
-- This migration fixes the foreign key relationship issue

-- First, drop the existing foreign key constraint
ALTER TABLE comments DROP CONSTRAINT IF EXISTS comments_user_id_fkey;

-- Update the user_id column to be text type to match public.users.id
ALTER TABLE comments ALTER COLUMN user_id TYPE text USING user_id::text;

-- Add the correct foreign key constraint to public.users
ALTER TABLE comments ADD CONSTRAINT comments_user_id_fkey 
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE;

-- Update the index to match the new data type
DROP INDEX IF EXISTS idx_comments_user_id;
CREATE INDEX IF NOT EXISTS idx_comments_user_id ON comments(user_id);
