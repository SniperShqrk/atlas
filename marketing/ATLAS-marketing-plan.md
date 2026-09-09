# ATLAS — Marketing & Launch Plan

*Working document. Written before billing or a release date exist, so treat the sequencing below as the plan to build toward, not a start-this-week checklist.*

## 1. Positioning

**Who this is for:** males into strength training, muscle building, and self-discipline as an identity — not casual gym-goers looking for a step counter. They already lift; they want the app to think as rigorously as they train.

**What makes ATLAS different, in one line:** it diagnoses your training with arithmetic on your own logs — not AI guesswork, not generic advice — and it looks like something carved rather than something coded.

**What NOT to lead with:** "AI workout planner." Every fitness app claims that now, and it undersells the actual product — the insight engine (neglect, imbalance, plateau detection) works without calling a model at all, which is a more defensible claim than "AI-powered," not a weaker one. Lead with the diagnosis, mention AI only for the plan-building feature specifically.

## 2. App Store presence (ASO)

Current App Store Connect field limits: app name 30 characters, subtitle 30 characters, keywords field 100 characters (comma-separated, no spaces after commas — that's wasted budget). These have been stable for years; treat them as fixed. [Source](https://appscreenshotstudio.com/blog/app-store-metadata-for-indie-devs-title-subtitle-keywords-2026)

Two things worth planning around now rather than at submission time:
- **Screenshots are now read, not just looked at.** Apple's discovery system reportedly OCRs on-screen screenshot text as a ranking signal, so the words on your screenshots (not just the visuals) should carry real keywords — "Recovery Map," "Insight Engine," not just pretty UI.
- **Keyword budget is per locale.** If English (UK/US) is the only market at launch, that's fine, but each additional localization gets its own fresh 30+30+100 allocation later — a cheap way to extend reach without touching the product.

Draft metadata (revisit once the icon and screenshots exist):
- **Name (30):** `ATLAS: Strength & Recovery`
- **Subtitle (30):** `Training log that reads back`
- **Keywords (100):** `strength,gym,recovery,fatigue,workout,log,hypertrophy,progression,stoic,discipline,lifting,muscle`

**Description structure:** first three lines matter most (visible before "more"). Open with the diagnosis claim, not a feature list. Close with the honest line already used in onboarding — "no free trial, no session caps" — because App Store reviews for fitness apps are dominated by trial-and-subscription complaints, and stating the opposite up front is a real differentiator worth spending words on.

## 3. The built-in growth loop

ATLAS already has the hardest part of a marketing plan built into the product: shareable progress cards styled like trading PnL cards, on Greek/Roman statue backgrounds. That's not a feature, it's a distribution mechanism — every card posted is an ad that doesn't look like one. Two things make this loop work harder before launch:

- Make sure the share flow triggers at genuine high points — a new PR, a closed streak, a balance-score milestone — not on every session. A card someone is proud of gets posted; a card that fires constantly gets ignored and then muted.
- Watermark or corner-brand the card subtly (small wordmark, not a badge) so a repost still carries the source without looking like an ad.

This loop is worth more than any paid channel below, and it's free. Sequence everything else around amplifying it, not replacing it.

## 4. Pre-launch

- **Landing page:** built — see the published ATLAS page. Its only job right now is capturing "notify me at launch" interest via a direct email link (no backend yet, so no fake signup form — a mailto: link is the honest version of a waitlist until there's a domain and a real form to put behind it).
- **TestFlight public link**, once the app is stable enough for outside eyes, is the highest-leverage pre-launch move available to a solo iOS dev — it turns "coming soon" into something people can actually install, and public TestFlight links are exactly what gets shared on Reddit and in Discord fitness communities.
- Domain: worth reserving `atlasfit.app` or similar now, cheaply, even before it points anywhere — the landing page can move there later.

## 5. Launch channels, in sequence

1. **TestFlight beta first**, seeded through communities Hugo already has credibility in (or genuine interest in) rather than cold outreach — r/naturalbodybuilding, r/Fitness (check self-promotion rules before posting; most fitness subreddits require a history of non-promotional participation first), and any Discord strength-training servers.
2. **Reddit over Product Hunt for this specific app.** Product Hunt's audience is other founders and early-adopter tech people — not the target lifter. Reddit's fitness subreddits are the actual audience. Save Product Hunt for later, if at all, once there's a polished App Store listing to point to.
3. **TikTok/Reels, content-led rather than ad-led.** The natural content isn't "here's my app" — it's the insight engine's actual output: "your rear delts are getting left behind and here's why that matters" as a 30-second clip, with the app visible but not the pitch. This matches how fitness content already performs and doesn't read as an ad.
4. **App Store Search Ads**: skip until Premium conversion is validated organically. Paying for installs before knowing the free-to-paid funnel converts is how indie apps burn budget for no signal.

## 6. Metrics that actually matter pre-Series-anything

For a solo project, track four numbers, not a dashboard:
- Sessions logged per install in week one (the product's core loop working at all)
- Day-7 retention (whether the recovery map/insights are pulling people back)
- Share-card exports per active user (the growth loop actually firing)
- Free → Premium conversion, once billing exists

## 7. Pricing — resolved

Direct comps, current prices (August 2026):

| App | Free tier | Monthly | Annual | Lifetime | Lifetime ÷ Annual |
|---|---|---|---|---|---|
| Strong | Permanent, capped (3 routines) | $4.99 | $29.99 | $99.99 | 3.33x |
| Hevy | Permanent, capped (4 routines) | $2.99 | $23.99 | $74.99 | 3.13x |
| Fitbod | 7-day trial, no permanent free tier | $15.99 | $95.99 | — | — |
| SensAI | 7-day trial, no permanent free tier | $6.99 | $69.99 | — | — |
| **ATLAS (old)** | Permanent, uncapped | €4.99 | €29.99 | €79.99 | **2.67x** |
| **ATLAS (new)** | Permanent, uncapped | €4.99 | €29.99 | **€99.99** | **3.33x** |

Two things fall out of this table cleanly:

**Strong is the real comp, not Fitbod or SensAI.** Fitbod and SensAI gate everything behind a trial-then-paywall and charge $70–96/year for it — a different product shape (Hugo already ruled out a free trial for ATLAS, which puts it in the Strong/Hevy camp by decision, not by accident). ATLAS's monthly and annual prices already match Strong's exactly, which is a good sign — it means the earlier pricing pass landed on a validated number without knowing it was validated.

**The lifetime tier was underpriced relative to ATLAS's own annual price, not relative to the market in the abstract.** At €79.99 against a €29.99 annual, the break-even was 2.67 years — anyone who expected to stay subscribed longer than that was leaving money on the table by not buying lifetime, which means ATLAS was actively steering its most committed, longest-tenured users (the ones worth the most in recurring revenue) toward the cheapest possible total spend. Strong and Hevy both price lifetime at 3.1–3.3x annual instead, which pushes the break-even out past 3 years — long enough that only genuinely long-horizon users take it, while everyone else stays on the subscription. Moving ATLAS to €99.99 (3.33x, matching Strong's ratio exactly, and matching Strong's digits under a straight USD→EUR nominal swap, which is how most indie apps localize) fixes this without touching the two prices that were already right.

**Not built yet, worth doing at actual launch:** a time- or capacity-boxed "Founding" lifetime price (something like €69.99, close to the old number) offered only to people who signed up on the landing-page waitlist or joined the TestFlight beta before public launch. This rewards the exact audience the marketing plan above is trying to build without permanently discounting lifetime for everyone after launch — but it needs a real launch date or a real beta headcount to box against, neither of which exist yet, so it's a note for later rather than something to half-build now.

## 8. What has to happen before any of this is real

Marketing a product that isn't installable yet is planning, not marketing. Pricing is now settled (§7); real billing (StoreKit/RevenueCat) is the one blocker left gating TestFlight and everything after it in §5.

---

Sources: [App Store Metadata for Indie Devs (2026)](https://appscreenshotstudio.com/blog/app-store-metadata-for-indie-devs-title-subtitle-keywords-2026) · [Fitness App Pricing 2026: Hevy, Strong, Fitbod, SensAI](https://www.sensai.fit/blog/fitness-app-pricing-free-tier-comparison) · [Fitbod vs Strong vs Hevy vs SensAI pricing comparison](https://www.sensai.fit/blog/fitness-app-comparison)
