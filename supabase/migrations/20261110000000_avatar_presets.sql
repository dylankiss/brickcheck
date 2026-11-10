------------------------------------------------------------------------------
-- A chosen avatar: the id of one of the app's built-in avatars (colour and
-- glyph, such as 'red-brick'). It is not a URL, so nobody can make co-members'
-- browsers fetch an address (that is why avatar_url stays out of reach).
-- The app ignores ids it does not know; the check only keeps the shape tidy.
-- The existing policy "profiles: update self" already limits the update to the
-- person's own row.
------------------------------------------------------------------------------

alter table public.profiles
  add column avatar text check (avatar ~ '^[a-z]{1,12}-[a-z]{1,12}$');

grant update (avatar) on public.profiles to authenticated;
