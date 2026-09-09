# Deploying the ATLAS backend

This is what powers the AI Workout Planner (`generatePlan` in the app's
`src/api/client.ts`). Right now it only runs on `localhost:4000`, which
works for development but is unreachable from a real phone — this gets it
onto a real URL.

Without `ANTHROPIC_API_KEY` set, plan generation automatically falls back
to the rule-based generator (`src/services/ruleBasedPlan.js`) — so this is
worth deploying even before you decide whether to pay for the AI planner
specifically. Free vs. Pro gating for the *feature* happens in the app
(`entitlements.ts`); this server doesn't know or care about that.

## Option A: Render (recommended — free tier, ~5 minutes)

1. Push this repo to GitHub if it isn't already.
2. Go to [dashboard.render.com](https://dashboard.render.com) → **New** → **Blueprint**, and point it at the repo. Render will read `backend/render.yaml` automatically.
   - If you'd rather click through manually instead of using the blueprint: **New** → **Web Service**, root directory `backend`, build command `npm install`, start command `npm start`.
3. When it asks for `ANTHROPIC_API_KEY`, either paste a real key (from [console.anthropic.com](https://console.anthropic.com)) to enable the AI planner, or leave it blank to run rule-based-only for now — both work.
4. Deploy. Render gives you a URL like `https://atlas-backend-xxxx.onrender.com`. Hit `https://<that-url>/health` — you should get back `{"ok":true}`.
5. Put that URL into `eas.json` (replace `REPLACE-WITH-YOUR-DEPLOYED-BACKEND-URL` in the `preview` and `production` build profiles) and into a local `.env` as `EXPO_PUBLIC_API_URL=https://<that-url>` for testing against it from Expo Go/dev builds before a full EAS build.

**Free tier caveats, both real:**
- The free instance spins down after 15 minutes of no traffic and takes a few seconds to wake back up on the next request — the first plan generation after idle time will feel slow once, then it's fine.
- Storage is **not persistent** on the free plan: `db.json` (where generated plans and synced sessions land, see `src/data/db.js`) gets wiped on every redeploy and on some restarts. That's fine for now since the app is offline-first and this data is best-effort, but don't treat it as a real backup of anything. If that changes, Render's paid tiers support an attached persistent disk.

## Option B: Fly.io

Similar shape (free-tier friendly, same ephemeral-storage caveat unless you attach a volume). `fly launch` from inside `backend/` will detect the Node app and generate a `fly.toml`; set `ANTHROPIC_API_KEY` with `fly secrets set ANTHROPIC_API_KEY=...`.

## Option C: Railway

Also works, also ephemeral storage on the free tier by default. Point it at the `backend` directory as the root, same build/start commands as above.

---

Whichever host you pick, the only thing the app needs from you afterward
is that one URL, dropped into `eas.json` and your local `.env`.
