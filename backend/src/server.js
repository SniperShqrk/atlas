import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import { planRouter } from './routes/plan.js';
import { sessionsRouter } from './routes/sessions.js';

const app = express();
app.use(cors());
// 20mb covers up to 3 compressed phone photos for Import Workouts with headroom.
app.use(express.json({ limit: '20mb' }));

app.get('/health', (req, res) => res.json({ ok: true }));
app.use('/api/plan', planRouter);
app.use('/api/sessions', sessionsRouter);

const PORT = process.env.PORT ?? 4000;
app.listen(PORT, () => {
  console.log(`ATLAS backend listening on http://localhost:${PORT}`);
  if (!process.env.ANTHROPIC_API_KEY) {
    console.log('ANTHROPIC_API_KEY not set — plan generation will use the rule-based fallback.');
  }
});
