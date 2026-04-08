-- Add username (pseudo) to profiles
alter table profiles add column if not exists username text unique;
create index if not exists idx_profiles_username on profiles(username) where username is not null;
