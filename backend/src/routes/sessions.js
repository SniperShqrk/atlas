import { Router } from 'express';
import { db, saveSession } from '../data/db.js';
import { computeMuscleLoads } from '../services/recovery.js';

export const sessionsRouter = Router();

sessionsRouter.post('/', async (req, res) => {
  const session = req.body;
  if (!session?.id) return res.status(400).json({ error: 'session.id is required' });
  await saveSession(session);
  res.json({ ok: true });
});

sessionsRouter.get('/', (req, res) => {
  res.json(db.data.sessions);
});

sessionsRouter.get('/recovery', (req, res) => {
  res.json(computeMuscleLoads(db.data.sessions));
});
