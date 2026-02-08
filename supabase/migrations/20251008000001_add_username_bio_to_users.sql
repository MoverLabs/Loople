-- migration: add username and bio to users
-- purpose: persist ui fields (username, bio) used in settings/profile
-- affected: public.users (columns, indexes, comments)
-- notes:
--   - additive change only (safe)
--   - username is unique (case-insensitive using lower())
--   - backfills leave values null; ui can prompt user to set username

-- add columns if missing
alter table if exists public.users
  add column if not exists username text,
  add column if not exists bio text;

-- create unique index on lower(username) to enforce case-insensitive uniqueness
do $$ begin
  if not exists (
    select 1 from pg_indexes where schemaname = 'public' and indexname = 'users_username_lower_unique'
  ) then
    create unique index users_username_lower_unique on public.users (lower(username));
  end if;
end $$;

-- optional: simple format constraint to discourage spaces-only usernames
alter table if exists public.users
  add constraint users_username_not_empty check (username is null or length(btrim(username)) > 0);

-- comments
comment on column public.users.username is 'Public handle; must be unique (case-insensitive).';
comment on column public.users.bio is 'Short profile bio/description shown on profile pages.';


