# ATLAS — things only you can do

Everything here needs to run on your machine, not in the build. Nothing in this list blocks the app
from starting — it builds and runs without any of it — but each one turns something on.

---

## ✅ 1. Install the new dependencies — DONE

Three packages were added since you last installed. Without them Metro will fail to bundle.

```bash
cd app
npm install
```

| Package | What it powers |
| --- | --- |
| `react-native-view-shot` | capturing a share card to a PNG |
| `expo-sharing` | handing that PNG to the OS share sheet |
| `sharp` (dev only) | grading the museum photographs in step 2 |
| `react-native-purchases` | real in-app purchases via RevenueCat (see §4) |
| `@sentry/react-native` | crash reporting (see §5) |
| `expo-splash-screen` | splash screen config plugin |
| `@supabase/supabase-js` | accounts, friends, groups, leaderboards (see §8) |
| `react-native-url-polyfill` | required by the Supabase client on React Native |

---

## ✅ 2. Download the artwork — DONE

The share-card backdrops are four Met Open Access objects — deliberately not statues, so there's no
figure and nothing to crop for nudity. The images are **fetched, not committed** — they're
gitignored, and the app falls back to procedural marble until you run this.

```bash
cd app
npx tsx tools/fetch-artwork.ts
```

It re-checks each work's public-domain flag against the Met's API before downloading, grades all
four to a common black point so they read as one set, writes them to `app/assets/artwork/`, and
regenerates `app/src/share/artworkAssets.ts`.

Roughly 1–2 MB total. Re-run it any time; it's idempotent.

| Card | Work | Met object |
| --- | --- | --- |
| Records | Gold funerary wreath | [254968](https://www.metmuseum.org/art/collection/search/254968) |
| Sessions / weeks | Marble column with base and capital | [250646](https://www.metmuseum.org/art/collection/search/250646) |
| Balance score | Bronze cuirass (body armor) | [256134](https://www.metmuseum.org/art/collection/search/256134) |
| Streaks | Bronze helmet of the Corinthian type | [247983](https://www.metmuseum.org/art/collection/search/247983) |

All four are CC0 under the Met's Open Access policy — commercial use fine, no attribution required.
Provenance and licensing detail is in `THIRD_PARTY_LICENSES.md`.

---

## ✅ 3. If Expo asks about an unknown project — DONE / not hit

The app was renamed, so `app.json` now reads:

```
slug              atlas-fitness      (was flux-fitness)
bundleIdentifier  com.hugosheehan.atlas
```

If `expo start` prompts to create a new project, that rename is why. Setting `slug` back to
`flux-fitness` is a one-line fix if you'd rather not deal with it mid-development.

Your logged workouts are **not** affected — the AsyncStorage keys were deliberately left alone.

---

## 4. Set up RevenueCat (real in-app purchases)  ·  needed before you can sell anything

`PaywallScreen` and `src/store/purchases.ts` are wired to the real RevenueCat SDK
(`react-native-purchases`). With no keys set it falls back to the old local Pro toggle — nothing
breaks, but nobody's actually being charged.

1. Sign up at revenuecat.com, add your iOS/Android apps.
2. In App Store Connect, create your subscription products (monthly/yearly/lifetime).
3. Mirror them in RevenueCat and create an entitlement called exactly `pro` — the code checks for
   that identifier specifically (`PRO_ENTITLEMENT_ID` in `src/store/purchases.ts`).
4. Copy the two **public** API keys (Project settings → API keys) into `.env`:
   ```
   EXPO_PUBLIC_REVENUECAT_IOS_API_KEY=
   EXPO_PUBLIC_REVENUECAT_ANDROID_API_KEY=
   ```

"Restore Purchases" is already on the paywall — Apple requires it for review.

---

## ✅ 5. Set up Sentry (crash reporting) — DONE

`App.tsx` initializes Sentry automatically if `EXPO_PUBLIC_SENTRY_DSN` is set in `.env`; blank
means no crash reporting, which is fine to ship without.

1. Sign up at sentry.io, create a React Native project.
2. Copy the DSN (Project Settings → Client Keys) into `.env`:
   ```
   EXPO_PUBLIC_SENTRY_DSN=
   ```

---

## ✅ 6. Deploy the backend — DONE

It only runs on `localhost:4000` right now, which is unreachable from a real device. Full steps
are in `backend/DEPLOY.md` — short version: push to GitHub, point Render at `backend/render.yaml`
(free tier), get back a URL, then paste it into `eas.json` in place of both
`REPLACE-WITH-YOUR-DEPLOYED-BACKEND-URL` placeholders (preview and production profiles) and into
`.env` as `EXPO_PUBLIC_API_URL` for testing before a full build.

---

## 7. Apple Developer account + submit  ·  the actual App Store part

1. Enroll in the Apple Developer Program ($99/year) if you haven't, and create the app record in
   App Store Connect.
2. Fill the three placeholders in `eas.json`'s `submit.production.ios` block: `appleId` (your
   Apple ID email), `ascAppId` (from App Store Connect), `appleTeamId` (from developer.apple.com/account).
3. Paste the privacy policy URL into App Store Connect's app privacy section, and add the App
   Store screenshots (already generated — ask Claude if you've lost track of them).
4. Once §4–§6 above are done: `eas build --platform ios --profile production`, then
   `eas submit -p ios`.

---

## 8. Set up Friends & Groups (accounts, shared leaderboards)  ·  optional, holds its own screen

New: Profile → Friends & Groups. Add friends by username, build a group with an invite code,
compare lifts head-to-head (1RM / heaviest weight / best set volume, like the Strong-style
comparison you sent over), and rank a group by total volume or streak. No chat — deliberately left
out.

This is a second, separate backend from the AI planner — it lives on Supabase (hosted Postgres),
not on Render. Full setup is in `supabase/SETUP.md`: create a free Supabase project, run
`supabase/schema.sql` once in its SQL editor, then copy your project URL and anon key into `.env`
as `EXPO_PUBLIC_SUPABASE_URL` / `EXPO_PUBLIC_SUPABASE_ANON_KEY` (and into `eas.json`'s preview/
production profiles the same way as the other keys).

With those left blank, tapping Friends & Groups just shows a "not set up yet" screen — nothing
else in ATLAS depends on it, and no local training data leaves the device either way. Signing in
only uploads a small per-exercise summary (best weight/reps/e1RM, best set volume) plus a
lifetime-totals row, and only for someone who's actually signed in.

---

## Still to build

- **Real billing — code-complete, needs your keys.** See §4 below. `PaywallScreen` now calls
  the real RevenueCat SDK when your API keys are set; blank keys fall back to the old local
  `setPro(true)` toggle exactly as before, so nothing breaks until you add them.
- **Local notifications** (streak-at-risk reminder, weekly recap) — deliberately not built. It needs
  `expo-notifications`, iOS push entitlement setup, and a physical device to verify delivery, none
  of which can be checked from here. Worth doing once billing is in and there's a device to test on.

**Pricing is resolved** (was parked): monthly €4.99, yearly €29.99 unchanged — both already match
Strong's real prices exactly, and Strong is the closest comp (same category: workout logger with a
permanent free tier, no forced trial). Lifetime moved from €79.99 → €99.99, which puts it at 3.3x
annual — matching what Hevy and Strong both actually charge for lifetime (roughly 3.1–3.3x their
own annual). The old 2.7x ratio meant anyone confident they'd use ATLAS more than ~2.7 years was
better off buying lifetime once than subscribing, which quietly pushed your most committed,
highest-LTV users out of recurring revenue. Full comp data and sourcing is in
`marketing/ATLAS-marketing-plan.md` under Pricing. One idea deliberately not built yet: a
time- or capacity-limited "Founding" lifetime price for the people on the landing-page waitlist —
worth doing once there's an actual launch window to box it against, not before.

Item 6 (exercise library) is done — 176 exercises, with common mistakes derived from movement
patterns and variations and substitutions scored from the data. `cd app && npx tsx
tools/verify-library.ts` checks it; `npx tsx tools/preview-library.ts` writes a browser preview to
`preview/atlas-library.html` that was never opened, so give it a look when you pick this back up.

Item 7 (Stoic quotes) is done — a 52-quote library (`src/data/quotes.ts`), sourced only from
Marcus Aurelius, Epictetus and Seneca, no disputed or misattributed lines. It shows up in three
places: a "quote of the day" on Home, a start-training line on the empty Workout screen, and a
compact one during rest periods (themed to patience/endurance, stable for the whole rest window).
`npx tsx tools/verify-quotes.ts` checks the library and selectors; `npx tsx
tools/preview-quotes.ts` writes `preview/atlas-quotes.html` showing all three spots rendered with
the real Obsidian palette.

Item 10 (marketing) is done as a plan, not a campaign — nothing here needed you to touch a
machine, so it's all in `marketing/`. `ATLAS-marketing-plan.md` covers positioning, ASO metadata
drafts, the share-card growth loop, and launch channel sequencing (TestFlight and Reddit before
Product Hunt or paid ads). `atlas-landing.html` is a real pre-launch landing page, published as a
Claude artifact — waitlist interest goes through a plain `mailto:` link since there's no backend
yet to hold real signups. The plan is explicit that none of the launch steps are real until
billing and pricing are settled, so read that section before acting on the rest.

Item 8 (retention) is done, minus notifications (see above). Achievements are derived from your
logs the same way everything else in ATLAS is — no stored badge list to drift out of sync —
across five categories (sessions, volume, consistency streak, records, exercise range), 30 tiers
total, in `src/data/achievements.ts`. They show up as: a streak chip on Home (turns rust-colored
when a gap puts the week at risk), a full breakdown on a new Achievements screen off Profile, and a
"milestone unlocked" banner on the Workout screen the moment a finished session crosses a tier.
`npx tsx tools/verify-achievements.ts` checks the engine against synthetic histories — it caught a
real bug during review (`prTimeline` returns most-recent-first, and the records category was
reading it as chronological, which dated every "Nth record" tier wrong). `npx tsx
tools/preview-retention.ts` writes `preview/atlas-retention.html` from a simulated 19-week history.
