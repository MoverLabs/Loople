-- Migration: add avatar_url column to users table
-- Purpose: Fix API error "column users.avatar_url does not exist" when reading/updating user profiles
-- Affected objects: public.users

-- Safety: additive change only; no destructive operations

-- Add column if missing
alter table if exists users
add column if not exists avatar_url text;

-- No RLS changes required; existing policies on users remain valid.
-- The existing BEFORE UPDATE trigger on users will continue to maintain updated_at.

