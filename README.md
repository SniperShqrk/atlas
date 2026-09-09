# ATLAS

An iPhone gym app: log workouts, get AI-personalised plans, browse a 162-exercise library with
anatomical muscle diagrams, see a full-body recovery heatmap of what's ready to train — and get
ATLAS's read on what your training is actually doing.

## What's inside

- **`app/`** — the iPhone app (Expo / React Native / TypeScript). Runs on your phone via Expo Go.
- **`backend/`** — Node/Express server storing workout history and generating training plans
  (Claude when an API key is set, otherwise a built-in algorithm).
- **`preview/`** — a standalone HTML page that renders the anatomy figure and mockups of every
  screen in a normal browser. Open `preview/index.html` to review design changes without
  rebuilding the app.

## Features

**Workout logging** — Hevy-style set table with SET / PREVIOUS / KG / REPS / ✓ columns. Your last
session's numbers appear in the PREVIOUS column so you know what to beat. Checking off a set
automatically starts the rest timer. Personal records are detected via estimated 1RM (Epley) and
flagged with a 🏆 on the set that set them.

**Anatomical muscle diagrams** — an illustrator-drawn anatomical figure (vendored from
react-native-body-highlighter, MIT licence — see `THIRD_PARTY_LICENSES.md`). The upstream asset
treats the shoulder as one region, so the app subdivides each deltoid at render time into an inner
head (anterior at the front, posterior at the back) and an outer head (lateral), which means a
lateral raise lights only the side delt rather than the whole shoulder. Used two ways:
- *Recovery mode* on the home screen colours every muscle by how recovered it is.
- *Target mode* on the exercise detail screen lights up the worked muscles — terracotta for
  primary, bronze for secondary.

**Four themes** — Obsidian (default), Marble, Bronze and Stone, chosen under Profile → Appearance
and saved on-device. A theme swaps colour tokens and nothing else: spacing, radii and the type
scale are deliberately not themeable, and the colour language never changes — the accent always
marks a fatigued or neglected muscle and the primary action, bronze always marks recovering,
complete, a record or Premium. Someone who learns the app in Obsidian and switches to Marble does
not have to re-read a single chart.

`npx tsx tools/preview-themes.ts` renders all four onto the surfaces that encode meaning and runs a
contrast audit over the pairs that have to stay legible. It is a gate, not a report: it caught
Marble drawing a rested muscle at 1.06:1 against its own figure, which is invisible.

**Look and feel** — marble and stone. Colour appears only where it carries meaning. Icons are a
custom line set (`app/src/components/Icon.tsx`).

**Recovery model** — each completed set applies a fatigue "dose" to the muscles that exercise
trains (full weight for primary, half for secondary), which then decays exponentially over that
muscle's recovery half-life. Big muscles recover slower: quads 48h, lower back 48h, chest 36h,
abs and obliques 18h. Warm-up sets are excluded.

**Exercise library** — 162 exercises with primary/secondary muscle mapping, equipment, mechanic
(compound/isolation), difficulty, step-by-step instructions and coaching notes. Searchable by name,
muscle or equipment, filterable by body part and equipment. Every row has an "i" button that opens
the full detail view.

**AI workout planner (Pro)** — runs on Claude Haiku 4.5 (`claude-haiku-4-5-20251001`) and takes in
goal, experience, days per week, minutes per session, equipment, preferred split, up to three muscle
groups to emphasise, injuries to work around, current per-muscle recovery, and weekly volume
measured against growth targets. Days are sized to actually fit the time available. If the API key
is missing or the call fails it falls back silently to the built-in generator, which prioritises
compounds, favours recovered muscles and enforces muscle-group variety.

**ATLAS Insights** — a rule-based analysis engine (`app/src/store/insights.ts`) that reads your
logs and reports what is wrong with them: regions below maintenance, push/pull and front/rear-delt
and quad/hamstring ratios drifting, lifts that have plateaued, volume swinging period to period,
programmes running on five exercises, muscles being trained while still fatigued. Every finding is
arithmetic on your own sessions — no model is called, so it costs nothing to run and cannot make
anything up. Each insight has a free headline and evidence line, with the diagnosis and the fix
behind Premium.

**Muscle balance radar** — an eight-spoke polygon plotting each region's weekly sets as a fraction
of that region's own target, so the dashed ring means "on target" everywhere on the chart and a
dent is a real bias rather than an artefact of some muscles simply needing more work. Geometry is
in `app/src/components/radarGeometry.ts`, kept free of React so it can be tested headlessly.

**Progress screen** — 7D / 30D / 90D / 1Y / all-time ranges across every metric: volume and set
counts with period-over-period deltas, strength trends per lift, biggest movers, weekly volume
bars, a twelve-week consistency grid with streaks and adherence, volume landmarks per muscle, and
a records board that replays your whole history to find every moment a lift beat its own best.

**Shareable progress cards** — a record, a finished session, a week, a consistency streak or the
balance score, rendered onto a stone backdrop at 1080px and handed to the OS share sheet. Cards are
only offered when the moment behind them actually happened, and a card built from example data is
labelled as one. Backdrops are four Met Open Access sculptures — a Diadoumenos for records, a kouros for sessions,
a Polykleitan Hermes for the balance score, a bearded Hercules for streaks — each verified CC0
against the Met's collection API. The images are fetched rather than committed:

```bash
cd app && npm install --save-dev sharp && npx tsx tools/fetch-artwork.ts
```

That re-checks the public-domain flag, downloads, grades all four to a common black point and
saturation so they read as one set, and generates the asset map. Until it runs, the cards fall back
to procedural marble, so the app builds from a clean checkout either way.
`npx tsx tools/verify-artwork.ts` exercises the whole pipeline offline against a synthetic
photograph. Generated on-device — nothing is uploaded.

**Progression suggestions** — double-progression logic on every lift: work up the rep range, then
add weight once you clear the top of it on all work sets. Uses RPE when logged, so a set at RPE 10
gets a deload suggestion rather than more weight. Free tier.

**Plate calculator, warm-up sets and RPE** — plate loading per side for any barbell lift, sets
markable as warm-ups (logged but excluded from volume and recovery load), and optional RPE per set.

**Routines** — save any session as a routine and start it again in one tap. Three free, unlimited
on Pro.

**Bodyweight log** — one reading per day with a 7-day average, feeding the planner and BMI.

**History & PRs** — every session with duration, sets, volume and per-exercise best sets, plus a
lifetime PR board on the profile screen.

## Onboarding and the paywall

Two moments, for a specific reason. Subscription purchases cluster hard on day zero, but ATLAS has
nothing true to say on day zero — it reads your logs and there are none yet. So the first-run flow
demonstrates instead of describing: a complete, real insight and a real share card, both built from
example numbers and both labelled `EXAMPLE`, so a new user sees the actual output before deciding.
The Progress screen's empty state does the same thing, because the failure mode that kills analysis
apps is a new user seeing a blank panel and concluding there is nothing there.

The second moment is contextual and earned: the first genuine "ATLAS found 3 things" card, which
lands around the third logged session. Free users keep every headline and every line of evidence,
plus all the good news in full — only the diagnosis and the fix are held back.

## Free vs Pro

The free tier is deliberately never capped for training — the most common complaint about workout
apps is a free tier that limits how much you can log. Pro sells the thinking, not access to your
own data.

| Free forever | Premium |
| --- | --- |
| Unlimited logging, no session caps | ATLAS Insights — full diagnosis and fix |
| Muscle balance radar and balance score | AI workout planner |
| All 162 exercises with instructions | Strength trend + weekly volume charts |
| Muscle recovery map, full history | Volume landmarks vs growth targets |
| Rest timer, PR detection, plate calculator | Unlimited routines (3 free) |
| Progression suggestions on every lift | CSV export |
| Bodyweight tracking | |

Billing is not wired up yet: `PaywallScreen` unlocks locally via the entitlement store. Swap that
call for StoreKit or RevenueCat before release — `app/src/store/entitlements.ts` is the single place
that decides what is unlocked.

## Before you run it

Some steps only work on your machine — installing the new native dependencies and downloading the
museum artwork. They are listed in **[TODO.md](TODO.md)**.

## Running it

### 1. Backend

```bash
cd backend
npm install
cp .env.example .env      # Windows: copy .env.example .env
npm start
```

Runs on `http://localhost:4000`. For AI-generated plans rather than the built-in algorithm, add
your Anthropic API key to `.env`:

```
ANTHROPIC_API_KEY=sk-ant-...
```

### 2. iPhone app

```bash
cd app
npm install
npm start
```

Install **Expo Go** from the App Store, then scan the QR code.

**Connecting the phone to your computer:** your phone can't reach `localhost` on your PC, so find
your computer's LAN IP (`ipconfig` on Windows → IPv4 Address) and start with:

```powershell
$env:REACT_NATIVE_PACKAGER_HOSTNAME="192.168.1.106"; $env:EXPO_PUBLIC_API_URL="http://192.168.1.106:4000"; npx expo start --lan
```

Both devices must be on the same network. If your router blocks device-to-device traffic (Starlink's
stock router does), turn on Windows Mobile Hotspot, connect the phone to that, and use the hotspot
IP (usually `192.168.137.1`) instead.

The app works fully offline for logging and the recovery heatmap — all workout data lives on the
phone. Only plan generation needs the backend.

## Reviewing design changes

Open `preview/index.html` in any browser to see the anatomy figure and screen mockups. It reads its
path data from `preview/body-data.js`, generated from the app source — after editing
`app/src/data/bodyPaths.ts`, run:

```bash
node preview/build-preview.mjs
```

## Keeping the exercise data in sync

`app/src/data/exercises.ts` is the single source of truth. The backend's copy is generated from it,
so after adding exercises run:

```bash
cd backend && npm run sync-exercises
```

## Previewing the share cards

```bash
cd app && npx tsx tools/preview-cards.ts
```

Writes `preview/atlas-cards.html` — every card type at every format, drawn with the same geometry
the app uses, so composition and the marble can be judged in a browser.

## Verifying the analytics

The analytics and insight engines are pure functions of the session log, with no React or React
Native imports, so they can be driven directly:

```bash
cd app && npx tsx tools/verify-analytics.ts
```

That generates 24 weeks of training with a known bias (press-heavy, no calves, a stalled squat),
asserts the metrics and the findings match what was put in, and writes `.verify/radar.svg` so the
polygon can be looked at rather than assumed.

## Project structure

```
app/
  App.tsx
  src/
    screens/       Home, Workout, ExerciseLibrary, ExerciseDetail, History, Plan, Profile
    components/    BodyMap (anatomy renderer), RestTimer, shared UI primitives
    data/
      exercises.ts   162 exercises — the source of truth
      bodyPaths.ts   vendored anatomical SVG paths + deltoid split geometry
    share/
      cards.ts         card data model and builders — pure, no rendering
      artwork.ts       backdrop registry, sculpture credits
      capture.ts       view capture and share, with a text fallback
    store/
      workoutStore.ts  sessions, PRs, rest timer, profile (persisted on-device)
      recovery.ts      the fatigue/recovery model
      analytics.ts     ranges, muscle balance, streaks, PR timeline, lift progress
      insights.ts      the rule-based insight engine
      formulas.ts      Epley e1RM, dependency-free so tests can import it
    theme/
      palettes.ts      the four palettes, one token set each
      ThemeProvider.tsx  context, persisted choice, makeStyles()
      theme.ts         spacing, radii, type scale — not themeable
    api/client.ts      talks to the backend
backend/
  src/
    server.js
    routes/        /api/plan, /api/sessions
    services/
      aiPlan.js        Claude plan generation, falls back to ruleBasedPlan
      ruleBasedPlan.js deterministic split generator
      recovery.js      server-side copy of the recovery model
    data/exercises.js  GENERATED from the app — do not edit by hand
  scripts/sync-exercises.mjs
preview/
  index.html          design preview
  build-preview.mjs   regenerates body-data.js from the app source
```

## Customising

- **Colours** — `app/src/theme/theme.ts`
- **Exercises** — `app/src/data/exercises.ts` (then run the backend sync)
- **Muscle map** — `app/src/data/bodyPaths.ts`; the deltoid split lives in `DELTOID_SPLIT` there.
  Run `node preview/build-preview.mjs` afterwards to refresh the browser preview
- **Recovery speed** — `RECOVERY_HALFLIFE_HOURS` in `app/src/store/recovery.ts` and the matching
  backend copy
