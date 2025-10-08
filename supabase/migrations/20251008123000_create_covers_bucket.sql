-- migration: create covers storage bucket
-- purpose: enable uploading and serving user cover images from a dedicated bucket
-- affected: storage.buckets (insert)
-- notes: policies are defined centrally in 20250617_rls_policies.sql

-- create the storage bucket for user cover images
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'covers',
  'covers',
  true,                         -- public read access for cover images
  10485760,                     -- 10MB limit
  array['image/jpeg', 'image/png', 'image/gif', 'image/webp']
)
on conflict (id) do nothing;

