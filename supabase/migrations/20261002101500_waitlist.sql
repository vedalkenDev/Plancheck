-- Waitlist for people who sign in but are not on the private allowlist.
create table public.waitlist (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  email text not null,
  name text not null,
  position text not null,
  created_at timestamptz not null default now(),
  constraint waitlist_email_key unique (email),
  constraint waitlist_user_id_key unique (user_id),
  constraint waitlist_email_len check (char_length(email) between 3 and 254),
  constraint waitlist_name_len check (char_length(name) between 2 and 80),
  constraint waitlist_position_len check (char_length(position) between 2 and 80)
);

create index waitlist_created_at_idx on public.waitlist (created_at desc);

alter table public.waitlist enable row level security;

revoke all on table public.waitlist from anon, public;
grant select, insert on table public.waitlist to authenticated;

create policy waitlist_insert_own
  on public.waitlist
  for insert
  to authenticated
  with check (
    user_id = auth.uid()
    and lower(email) = lower(coalesce(auth.jwt() ->> 'email', ''))
  );

create policy waitlist_select_own
  on public.waitlist
  for select
  to authenticated
  using (user_id = auth.uid());

comment on table public.waitlist is 'People waiting for Plancheck to open. Not an access list.';
