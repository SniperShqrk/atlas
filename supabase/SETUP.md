# Setting up accounts, friends & leaderboards

This is what powers the new "Friends & Groups" section: accounts, friend
requests, groups, and the stat comparisons/leaderboards. It's a separate
thing from the AI Workout Planner backend (`backend/`) — this one lives on
[Supabase](https://supabase.com) (hosted Postgres + auth), free tier, no
credit card required.

Nothing here is required for the app to work — same as RevenueCat and
Sentry, if you leave the keys blank the "Friends & Groups" entry just shows
a normal sign-in screen that can't connect to anything yet. Everyone's
actual training logs stay local on-device exactly as before; only a small
per-exercise summary (best weight/reps/e1RM, best set volume) and a
lifetime-totals row get uploaded, and only for someone who's signed in.

## 1. Create the project

1. Go to [supabase.com](https://supabase.com) → sign up → **New project**.
2. Pick any name/region, set a database password (you won't need it day to
   day — Supabase manages the connection for you), and create it. Takes
   about two minutes to provision.

## 2. Run the schema

1. In the project dashboard, open **SQL Editor** → **New query**.
2. Paste the entire contents of `supabase/schema.sql` and hit **Run**.
3. It should finish with no errors. This creates the tables (profiles,
   friendships, groups, group members, stats), locks each one down with row
   level security so people can only see their own data plus friends'/
   groupmates', and sets up the functions the app calls to create groups,
   join by invite code, and send/accept friend requests.

Safe to re-run any time — everything in it is written to not duplicate.

## 3. Turn on email sign-in

Email/password is on by default in a new Supabase project, so there's
usually nothing to do here. If you want to double check: **Authentication**
→ **Providers** → **Email** should be enabled. Leave "Confirm email" off
for now (**Authentication** → **Settings**) unless you want new sign-ups to
verify their address first — off is simpler while you're testing.

## 4. Copy your keys

**Project Settings** → **API**. You need two values:

- **Project URL** (looks like `https://xxxxxxxxxxxx.supabase.co`)
- **anon / public key** (a long string starting `eyJ...`) — this is the
  client-safe key, not the `service_role` one. Never put the `service_role`
  key in the app; it bypasses all the row-level security above.

Drop both into `.env`:

```
EXPO_PUBLIC_SUPABASE_URL=https://xxxxxxxxxxxx.supabase.co
EXPO_PUBLIC_SUPABASE_ANON_KEY=eyJ...
```

And into `eas.json`'s `preview` and `production` build profiles the same
way you did for `EXPO_PUBLIC_API_URL`.

That's it — restart `expo start` and the sign-in screen under
Profile → Friends & Groups will actually connect.

## What it looks like in the Supabase dashboard

Once people start signing up, **Table Editor** shows real rows: `profiles`
(usernames), `friendships`, `groups` / `group_members`, and `exercise_stats`
/ `profile_stats` (the numbers leaderboards and comparisons are built from).
Nothing sensitive lives here beyond a username and lifting numbers — no
training logs, no payment info, no email is exposed to other users (auth
emails live in Supabase's own `auth.users` table, which the app never
queries).
