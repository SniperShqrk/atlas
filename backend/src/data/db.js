import { JSONFilePreset } from 'lowdb/node';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const dbPath = path.join(__dirname, 'db.json');

const defaultData = { sessions: [], plans: [] };

export const db = await JSONFilePreset(dbPath, defaultData);

export async function saveSession(session) {
  db.data.sessions = db.data.sessions.filter((s) => s.id !== session.id);
  db.data.sessions.push(session);
  await db.write();
}

export async function savePlan(plan) {
  db.data.plans.push(plan);
  await db.write();
}
