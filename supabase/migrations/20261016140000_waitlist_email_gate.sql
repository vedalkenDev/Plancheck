-- Waitlist joins no longer need a Google auth user.
alter table public.waitlist
  alter column user_id drop not null;

alter table public.waitlist
  drop constraint if exists waitlist_user_id_key;

drop policy if exists waitlist_insert_own on public.waitlist;
drop policy if exists waitlist_select_own on public.waitlist;

revoke all on table public.waitlist from authenticated;
grant insert on table public.waitlist to anon, authenticated;

create policy waitlist_insert_open
  on public.waitlist
  for insert
  to anon, authenticated
  with check (
    user_id is null
    and char_length(email) between 3 and 254
    and char_length(name) between 2 and 80
    and char_length(position) between 2 and 80
  );
