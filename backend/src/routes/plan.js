import { Router } from 'express';
import { generatePlan } from '../services/aiPlan.js';
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
