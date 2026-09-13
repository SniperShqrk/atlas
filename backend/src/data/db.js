import { JSONFilePreset } from 'lowdb/node';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const dbPath = path.join(__dirname, 'db.json');

const defaultData = { sessions: [], plans: [], coachTurns: [], coachUsage: {} };

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

// Coach-turn persistence — deliberately minimal (no conversation_id linking,
// no per-user scoping yet, since there's no auth on this backend today).
// This exists for exactly one reason: the applied-vs-discarded ratio on
// proposals is, per the AI-coach epic scoping doc §3.6, "the single best
// quality metric for the whole epic," and that number is worthless if
// nothing records what happened to a proposal after it left the model.
export async function saveCoachTurn(turn) {
  if (!db.data.coachTurns) db.data.coachTurns = [];
  db.data.coachTurns.push(turn);
  await db.write();
}

export async function updateCoachProposalStatus(turnId, status) {
  if (!db.data.coachTurns) return false;
  const turn = db.data.coachTurns.find((t) => t.id === turnId);
  if (!turn) return false;
  turn.proposalStatus = status;
  turn.proposalStatusAt = Date.now();
  await db.write();
  return true;
}

// Coach quota — a real, persisted cap on how many turns one anonymous
// device can burn through per UTC day, keyed by deviceId (see
// app/src/lib/deviceId.ts) rather than a real user id, since this backend
// has no auth boundary to hang a per-user cap off yet. Persisted in the same
// lowdb file everything else uses rather than an in-memory Map, so a backend
// restart doesn't hand every device a fresh quota. Pruned lazily (only the
// day keys actually touched exist at all) so this never grows unbounded.
function todayKey() {
  return new Date().toISOString().slice(0, 10); // UTC calendar day
}

/**
 * Atomically checks and increments today's count for a device. Returns
 * { ok: true, remaining } when under limit, or { ok: false, limit } when
 * the device is already at or over it — the caller decides what to do,
 * this never throws.
 */
export async function consumeCoachQuota(deviceId, limit) {
  if (!db.data.coachUsage) db.data.coachUsage = {};
  const day = todayKey();
  const bucket = db.data.coachUsage[deviceId] ?? { day, count: 0 };
  // a device's bucket resets the moment the UTC day rolls over
  const current = bucket.day === day ? bucket.count : 0;
  if (current >= limit) {
    return { ok: false, limit };
  }
  db.data.coachUsage[deviceId] = { day, count: current + 1 };
  await db.write();
  return { ok: true, remaining: limit - (current + 1) };
}
