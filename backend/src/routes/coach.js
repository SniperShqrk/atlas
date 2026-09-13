import { Router } from 'express';
import { generateCoachTurn } from '../services/coach.js';
import { saveCoachTurn, updateCoachProposalStatus, consumeCoachQuota } from '../data/db.js';

export const coachRouter = Router();

// Conversation THREADS are still v1-ephemeral by design (see the epic
// scoping doc §6) — nothing here reconstructs a past thread. What IS
// persisted is one row per turn, purely so the apply/discard ratio on
// proposals (the doc's named "single best quality metric") can be measured
// at all.
//
// Quota, not entitlement: the check below caps how many turns one anonymous
// device (deviceId — an install-scoped id, not a user identity) can spend
// per UTC day, at a higher ceiling for a client that reports isPro. That
// isPro flag is trusted, not verified — this backend has no auth boundary
// linking a request to a real signed-in identity or a real RevenueCat
// subscription, so a modified client could always claim isPro. What this
// DOES guarantee, even against that: nobody gets unlimited turns, so a
// runaway loop or a scraped API key can't produce an unbounded Anthropic
// bill. Real entitlement verification needs a real auth boundary (Supabase
// JWT on requests, or a RevenueCat server-side lookup) — flagged here as
// the next real step, not silently pretended away.
const FREE_DAILY_LIMIT = 15;
const PRO_DAILY_LIMIT = 80;

coachRouter.post('/turn', async (req, res) => {
  const {
    profile,
    recentSessions,
    currentPlan,
    entryPoint,
    seed,
    insightsDigest,
    deviceId,
    isPro,
    conversation,
    userMessage,
  } = req.body ?? {};
  if (!profile) return res.status(400).json({ error: 'profile is required' });
  if (!userMessage || typeof userMessage !== 'string') {
    return res.status(400).json({ error: 'userMessage is required' });
  }

  // deviceId is required for quota purposes — an older client that hasn't
  // updated yet gets the free-tier limit under a shared fallback bucket
  // rather than being rejected outright.
  const quotaKey = typeof deviceId === 'string' && deviceId ? deviceId : 'unknown-device';
  const limit = isPro === true ? PRO_DAILY_LIMIT : FREE_DAILY_LIMIT;
  const quota = await consumeCoachQuota(quotaKey, limit);
  if (!quota.ok) {
    return res.status(429).json({
      error: `Coach turn limit reached for today (${quota.limit}). Resets at midnight UTC.`,
    });
  }

  try {
    const result = await generateCoachTurn({
      profile,
      recentSessions: recentSessions ?? [],
      currentPlan: currentPlan ?? null,
      entryPoint: entryPoint ?? 'plan',
      seed: seed ?? null,
      insightsDigest: insightsDigest ?? [],
      conversation: conversation ?? [],
      userMessage,
    });

    const turnId = `turn_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
    await saveCoachTurn({
      id: turnId,
      createdAt: Date.now(),
      entryPoint: entryPoint ?? 'plan',
      userMessage,
      message: result.message,
      proposal: result.proposal,
      proposalStatus: result.proposal ? 'pending' : null,
    });

    res.json({ ...result, turnId });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'coach turn failed' });
  }
});

coachRouter.post('/proposal-outcome', async (req, res) => {
  const { turnId, status } = req.body ?? {};
  if (!turnId || !['applied', 'discarded'].includes(status)) {
    return res.status(400).json({ error: 'turnId and a valid status are required' });
  }
  const ok = await updateCoachProposalStatus(turnId, status);
  res.json({ ok });
});
