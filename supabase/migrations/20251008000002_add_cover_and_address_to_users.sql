-- migration: add cover_url and address fields to users
-- purpose: persist cover image and address fields used on settings page
-- affected: public.users (columns, comments)
-- notes: additive, safe; ui handles null values

alter table if exists public.users
  add column if not exists cover_url text,
  add column if not exists country text,
  add column if not exists street_address text,
  add column if not exists city text,
  add column if not exists region text,
  add column if not exists postal_code text;

comment on column public.users.cover_url is 'Profile cover image URL.';
comment on column public.users.country is 'User country.';
comment on column public.users.street_address is 'User street address.';
comment on column public.users.city is 'User city.';
comment on column public.users.region is 'User state/province/region.';
comment on column public.users.postal_code is 'User postal/ZIP code.';


