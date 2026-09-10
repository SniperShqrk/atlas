import { Router } from 'express';
import { generatePlan } from '../services/aiPlan.js';
import { importWorkout } from '../services/importPlan.js';
import { savePlan } from '../data/db.js';

export const planRouter = Router();

planRouter.post('/generate', async (req, res) => {
  const { profile, recentSessions } = req.body ?? {};
  if (!profile) return res.status(400).json({ error: 'profile is required' });

  try {
    const plan = await generatePlan(profile, recentSessions ?? []);
    await savePlan(plan);
    res.json(plan);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'plan generation failed' });
  }
});

// Import Workouts (Pro): turn photos of / pasted text describing the user's
// own plan into the same shape /generate returns, plus any custom exercises
// that had no catalog match. Request body: { text?, images?: { base64, mimeType }[] }.
// A 20mb JSON body limit is set in server.js — comfortably fits up to 3
// compressed photos; the client should downscale before sending.
planRouter.post('/import', async (req, res) => {
  const { text, images } = req.body ?? {};

  try {
    const plan = await importWorkout({ text, images });
    await savePlan(plan);
    res.json(plan);
  } catch (err) {
    console.error(err);
    const status = err.code === 'NO_API_KEY' ? 501 : 400;
    res.status(status).json({ error: err.message ?? 'import failed' });
  }
});
