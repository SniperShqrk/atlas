-- ATLAS social schema: accounts, friends, groups, shared leaderboards.
--
-- Run this once in your Supabase project's SQL editor (Dashboard → SQL Editor
-- → New query → paste this whole file → Run). Safe to re-run: everything is
-- IF NOT EXISTS / CREATE OR REPLACE.
--
-- Nothing in here touches the AI Workout Planner backend (Render/Express) —
-- this is a separate Postgres database that only exists for accounts,
-- friends, groups and the numbers needed to compare/rank people. Training
-- logs themselves stay local on-device exactly as they always have; only a
-- small per-exercise summary (best weight, best e1RM, best set volume) and a
-- lifetime-totals row get synced here, and only once someone signs in.

-- ─────────────────────────────────────────────────────────────────────────
-- Tables
-- ─────────────────────────────────────────────────────────────────────────

create table if not exists public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  username text unique,
  display_name text,
  avatar_emoji text not null default '🏋️',
  created_at timestamptz not null default now()
);

-- usernames are case-insensitive ("Hugo" and "hugo" collide)
create unique index if not exists profiles_username_lower_idx
  on public.profiles (lower(username));

create table if not exists public.friendships (
  id uuid primary key default gen_random_uuid(),
  requester_id uuid not null references public.profiles (id) on delete cascade,
  addressee_id uuid not null references public.profiles (id) on delete cascade,
  status text not null default 'pending' check (status in ('pending', 'accepted', 'declined')),
  created_at timestamptz not null default now(),
  responded_at timestamptz,
  constraint friendships_not_self check (requester_id <> addressee_id)
);

-- one relationship per pair, regardless of who sent it
create unique index if not exists friendships_pair_idx on public.friendships (
  least(requester_id, addressee_id),
  greatest(requester_id, addressee_id)
);

create table if not exists public.groups (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  invite_code text not null unique,
  created_by uuid not null references public.profiles (id) on delete cascade,
  created_at timestamptz not null default now()
);

create table if not exists public.group_members (
  group_id uuid not null references public.groups (id) on delete cascade,
  user_id uuid not null references public.profiles (id) on delete cascade,
  joined_at timestamptz not null default now(),
  primary key (group_id, user_id)
);

-- one row per (user, exercise) — mirrors the local PersonalRecord shape
create table if not exists public.exercise_stats (
  user_id uuid not null references public.profiles (id) on delete cascade,
  exercise_id text not null,
  best_weight_kg numeric not null,
  best_reps int not null,
  best_e1rm numeric not null,
  best_set_volume_kg numeric not null,
  achieved_at timestamptz not null,
  updated_at timestamptz not null default now(),
  primary key (user_id, exercise_id)
);

-- one row per user — lifetime totals, cheap to rank on
create table if not exists public.profile_stats (
  user_id uuid primary key references public.profiles (id) on delete cascade,
  total_volume_kg numeric not null default 0,
  total_sessions int not null default 0,
  current_streak_weeks int not null default 0,
  updated_at timestamptz not null default now()
);

-- ─────────────────────────────────────────────────────────────────────────
-- Helper functions (security definer — read past RLS deliberately, only to
-- answer one narrow yes/no question, never to return rows directly)
-- ─────────────────────────────────────────────────────────────────────────

create or replace function public.are_friends(a uuid, b uuid)
returns boolean
language sql
security definer
set search_path = public
stable
as $$
  select exists (
    select 1 from public.friendships
    where status = 'accepted'
      and ((requester_id = a and addressee_id = b) or (requester_id = b and addressee_id = a))
  );
$$;

create or replace function public.shares_group(a uuid, b uuid)
returns boolean
language sql
security definer
set search_path = public
stable
as $$
  select exists (
    select 1 from public.group_members gm1
    join public.group_members gm2 on gm1.group_id = gm2.group_id
    where gm1.user_id = a and gm2.user_id = b
  );
$$;

create or replace function public.is_member_of(gid uuid, uid uuid)
returns boolean
language sql
security definer
set search_path = public
stable
as $$
  select exists (
    select 1 from public.group_members where group_id = gid and user_id = uid
  );
$$;

-- readable, hard-to-confuse invite codes (no 0/O/1/I)
create or replace function public.generate_invite_code()
returns text
language sql
as $$
  select array_to_string(
    array(
      select substr('ABCDEFGHJKLMNPQRSTUVWXYZ23456789', (random() * 32)::int + 1, 1)
      from generate_series(1, 6)
    ),
    ''
  );
$$;

-- ─────────────────────────────────────────────────────────────────────────
-- RPCs the app calls (also security definer, so they can do multi-step
-- writes atomically without needing broad direct-table grants)
-- ─────────────────────────────────────────────────────────────────────────

create or replace function public.create_group(p_name text)
returns public.groups
language plpgsql
security definer
set search_path = public
as $$
declare
  v_group public.groups;
  v_code text;
begin
  loop
    v_code := public.generate_invite_code();
    exit when not exists (select 1 from public.groups where invite_code = v_code);
  end loop;

  insert into public.groups (name, invite_code, created_by)
  values (trim(p_name), v_code, auth.uid())
  returning * into v_group;

  insert into public.group_members (group_id, user_id) values (v_group.id, auth.uid());

  return v_group;
end;
$$;

create or replace function public.join_group_by_code(p_code text)
returns public.groups
language plpgsql
security definer
set search_path = public
as $$
declare
  v_group public.groups;
begin
  select * into v_group from public.groups where invite_code = upper(trim(p_code));
  if not found then
    raise exception 'No group found for that code';
  end if;

  insert into public.group_members (group_id, user_id)
  values (v_group.id, auth.uid())
  on conflict do nothing;

  return v_group;
end;
$$;

create or replace function public.send_friend_request(p_username text)
returns public.friendships
language plpgsql
security definer
set search_path = public
as $$
declare
  v_target_id uuid;
  v_existing public.friendships;
  v_row public.friendships;
begin
  select id into v_target_id from public.profiles where lower(username) = lower(trim(p_username));
  if not found then
    raise exception 'No one with that username';
  end if;
  if v_target_id = auth.uid() then
    raise exception 'That is your own username';
  end if;

  select * into v_existing from public.friendships
  where least(requester_id, addressee_id) = least(auth.uid(), v_target_id)
    and greatest(requester_id, addressee_id) = greatest(auth.uid(), v_target_id);

  if found then
    if v_existing.status = 'declined' then
      update public.friendships
        set status = 'pending', requester_id = auth.uid(), addressee_id = v_target_id,
            created_at = now(), responded_at = null
        where id = v_existing.id
        returning * into v_row;
      return v_row;
    end if;
    raise exception 'Already friends or a request is already pending';
  end if;

  insert into public.friendships (requester_id, addressee_id)
  values (auth.uid(), v_target_id)
  returning * into v_row;

  return v_row;
end;
$$;

create or replace function public.respond_to_friend_request(p_friendship_id uuid, p_accept boolean)
returns public.friendships
language plpgsql
security definer
set search_path = public
as $$
declare
  v_row public.friendships;
begin
  update public.friendships
    set status = case when p_accept then 'accepted' else 'declined' end,
        responded_at = now()
    where id = p_friendship_id and addressee_id = auth.uid() and status = 'pending'
    returning * into v_row;

  if not found then
    raise exception 'Request not found';
  end if;

  return v_row;
end;
$$;

-- keeps a profile row in sync with auth.users automatically
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id) values (new.id) on conflict (id) do nothing;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- ─────────────────────────────────────────────────────────────────────────
-- Row Level Security
-- ─────────────────────────────────────────────────────────────────────────

alter table public.profiles enable row level security;
alter table public.friendships enable row level security;
alter table public.groups enable row level security;
alter table public.group_members enable row level security;
alter table public.exercise_stats enable row level security;
alter table public.profile_stats enable row level security;

-- profiles: username/display name/avatar are the "business card" — visible
-- to any signed-in user so people can be found and added as friends. No
-- workout data lives on this table.
drop policy if exists "profiles readable by any signed-in user" on public.profiles;
create policy "profiles readable by any signed-in user" on public.profiles
  for select using (auth.role() = 'authenticated');

drop policy if exists "profiles editable by owner" on public.profiles;
create policy "profiles editable by owner" on public.profiles
  for update using (id = auth.uid());

-- friendships: only the two people involved can see or act on a row
drop policy if exists "friendships visible to participants" on public.friendships;
create policy "friendships visible to participants" on public.friendships
  for select using (auth.uid() in (requester_id, addressee_id));

drop policy if exists "friendships deletable by participants" on public.friendships;
create policy "friendships deletable by participants" on public.friendships
  for delete using (auth.uid() in (requester_id, addressee_id));

-- inserts/updates go through send_friend_request / respond_to_friend_request
-- (security definer), so no direct insert/update policy is needed or granted.

-- groups: visible only to members; created/joined via the RPCs above
drop policy if exists "groups visible to members" on public.groups;
create policy "groups visible to members" on public.groups
  for select using (public.is_member_of(id, auth.uid()));

-- group_members: see membership rows for any group you're also in
drop policy if exists "group_members visible to fellow members" on public.group_members;
create policy "group_members visible to fellow members" on public.group_members
  for select using (public.is_member_of(group_id, auth.uid()));

-- exercise_stats / profile_stats: visible to yourself, accepted friends, and
-- anyone sharing a group with you — this is the actual leaderboard/compare
-- data, so it's the table worth being strict about.
drop policy if exists "exercise_stats visible to self friends groupmates" on public.exercise_stats;
create policy "exercise_stats visible to self friends groupmates" on public.exercise_stats
  for select using (
    user_id = auth.uid()
    or public.are_friends(auth.uid(), user_id)
    or public.shares_group(auth.uid(), user_id)
  );

drop policy if exists "exercise_stats writable by owner" on public.exercise_stats;
create policy "exercise_stats writable by owner" on public.exercise_stats
  for insert with check (user_id = auth.uid());

drop policy if exists "exercise_stats updatable by owner" on public.exercise_stats;
create policy "exercise_stats updatable by owner" on public.exercise_stats
  for update using (user_id = auth.uid());

drop policy if exists "profile_stats visible to self friends groupmates" on public.profile_stats;
create policy "profile_stats visible to self friends groupmates" on public.profile_stats
  for select using (
    user_id = auth.uid()
    or public.are_friends(auth.uid(), user_id)
    or public.shares_group(auth.uid(), user_id)
  );

drop policy if exists "profile_stats writable by owner" on public.profile_stats;
create policy "profile_stats writable by owner" on public.profile_stats
  for insert with check (user_id = auth.uid());

drop policy if exists "profile_stats updatable by owner" on public.profile_stats;
create policy "profile_stats updatable by owner" on public.profile_stats
  for update using (user_id = auth.uid());
