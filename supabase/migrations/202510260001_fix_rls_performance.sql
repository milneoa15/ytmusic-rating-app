-- Fix RLS performance issues by wrapping auth.uid() in subqueries
-- This prevents the function from being re-evaluated for each row

-- Drop existing policies
drop policy if exists users_owner_select on public.users;
drop policy if exists users_owner_update on public.users;
drop policy if exists user_songs_owner_policy on public.user_songs;
drop policy if exists themes_owner_policy on public.themes;
drop policy if exists song_themes_owner_policy on public.song_themes;
drop policy if exists playlists_owner_policy on public.playlists;
drop policy if exists playlist_songs_owner_policy on public.playlist_songs;

-- Recreate policies with optimized auth.uid() calls

-- Users policies: wrap auth.uid() in subquery
create policy users_owner_select on public.users
  for select using (
    (select auth.uid()) is not null
    and ((select auth.uid()) = auth_uid or (select auth.uid()) = id)
  );

create policy users_owner_update on public.users
  for update using (
    (select auth.uid()) is not null
    and ((select auth.uid()) = auth_uid or (select auth.uid()) = id)
  );

-- User songs policy
create policy user_songs_owner_policy on public.user_songs
  for all using (
    (select auth.uid()) = user_id
  ) with check (
    (select auth.uid()) = user_id
  );

-- Themes policy
create policy themes_owner_policy on public.themes
  for all using (
    (select auth.uid()) = user_id
  ) with check (
    (select auth.uid()) = user_id
  );

-- Song themes policy
create policy song_themes_owner_policy on public.song_themes
  for all using (
    (select auth.uid()) = user_id
  ) with check (
    (select auth.uid()) = user_id
  );

-- Playlists policy
create policy playlists_owner_policy on public.playlists
  for all using (
    (select auth.uid()) = user_id
  ) with check (
    (select auth.uid()) = user_id
  );

-- Playlist songs policy
create policy playlist_songs_owner_policy on public.playlist_songs
  for all using (
    (select auth.uid()) = user_id
  ) with check (
    (select auth.uid()) = user_id
  );
