/**
 * Renders the three retention-feature spots — the Home streak chip, the
 * Achievements screen, and the post-workout "milestone unlocked" banner —
 * from real synthetic history run through the real engines, not mocked
 * numbers typed into HTML by hand.
 *
 *   npx tsx tools/preview-retention.ts
 *   → preview/atlas-retention.html
 */
import fs from 'fs';
import path from 'path';
import { WorkoutSession, SetEntry } from '../src/store/workoutStore';
import { consistency } from '../src/store/analytics';
import { computeAchievements, newlyUnlocked, CATEGORY_LABELS, AchievementCategory } from '../src/data/achievements';

const c = {
  bg: '#0D0D0E', bgElevated: '#141415', card: '#181715', cardAlt: '#1F1E1C',
  border: '#2A2825', text: '#F0EEE9', textSecondary: '#A8A49B', textDim: '#8C887F',
  bronze: '#C08A3E', bronzeSoft: 'rgba(192,138,62,0.15)',
};

const DAY = 86_400_000;
const NOW = Date.now();
const START = NOW - 140 * DAY; // 20 weeks of history

function set(weightKg: number, reps: number): SetEntry {
  return { id: Math.random().toString(36).slice(2), weightKg, reps, completed: true };
}
function makeSession(dayOffset: number, lifts: { id: string; weightKg: number; reps: number; sets: number }[]): WorkoutSession {
  const at = START + dayOffset * DAY;
  return {
    id: `s${dayOffset}`, name: 'Session', startedAt: at, completedAt: at + 50 * 60_000,
    entries: lifts.map((l) => ({ exerciseId: l.id, sets: Array.from({ length: l.sets }, () => set(l.weightKg, l.reps)) })),
  };
}

// 19 weeks of 4x/week training with progressive overload on the big lifts
const sessions: WorkoutSession[] = [];
for (let week = 0; week < 19; week++) {
  const bench = 60 + week * 0.8;
  const squat = 80 + week * 1.1;
  const dl = 100 + week * 1.0;
  const days = [0, 2, 4, 5];
  days.forEach((d, i) => {
    const dayOffset = week * 7 + d;
    if (i === 0) sessions.push(makeSession(dayOffset, [{ id: 'barbell_bench_press', weightKg: bench, reps: 5, sets: 4 }, { id: 'db_row', weightKg: 28, reps: 10, sets: 3 }]));
    else if (i === 1) sessions.push(makeSession(dayOffset, [{ id: 'back_squat', weightKg: squat, reps: 5, sets: 4 }, { id: 'leg_press', weightKg: 140, reps: 10, sets: 3 }]));
    else if (i === 2) sessions.push(makeSession(dayOffset, [{ id: 'deadlift', weightKg: dl, reps: 5, sets: 3 }, { id: 'lat_pulldown', weightKg: 55, reps: 10, sets: 3 }]));
    else sessions.push(makeSession(dayOffset, [{ id: 'overhead_press', weightKg: 40 + week * 0.4, reps: 6, sets: 3 }, { id: 'face_pull', weightKg: 20, reps: 15, sets: 3 }]));
  });
}

const profile = { daysPerWeek: 4 };
const nowForCalc = START + 19 * 7 * DAY;

const streak = consistency(sessions, profile.daysPerWeek, nowForCalc);
const report = computeAchievements(sessions, profile.daysPerWeek, nowForCalc);

// simulate the exact "just finished a session" moment at the 50th session —
// a real tier boundary (sessions_50), rather than the arbitrary final
// session, which mostly won't happen to land on a threshold
const before = computeAchievements(sessions.slice(0, 49), profile.daysPerWeek, nowForCalc);
const at50 = computeAchievements(sessions.slice(0, 50), profile.daysPerWeek, nowForCalc);
const justUnlocked = newlyUnlocked(before, at50);

console.log(`Simulated ${sessions.length} sessions over 19 weeks.`);
console.log(`Current streak: ${streak.weekStreak}w · Longest: ${streak.longestWeekStreak}w`);
console.log(`Achievements: ${report.unlockedCount}/${report.totalCount} unlocked`);
console.log(`Just unlocked by the final session: ${justUnlocked.map((a) => a.tier.label).join(', ') || '(none)'}`);

function phone(title: string, body: string) {
  return `<div style="width:320px;">
    <div style="font:600 13px system-ui;color:${c.textDim};margin-bottom:8px;letter-spacing:0.5px;">${title}</div>
    <div style="background:${c.bg};border-radius:28px;padding:18px;box-shadow:0 20px 60px rgba(0,0,0,0.5);border:1px solid #000;min-height:200px;">${body}</div>
  </div>`;
}

const streakChip = `<div style="display:inline-flex;align-items:center;gap:5px;background:${c.bronzeSoft};border:1px solid rgba(192,138,62,0.35);border-radius:999px;padding:7px 12px;">
  <span style="color:${c.bronze};">🔥</span><span style="font:700 13px system-ui;color:${c.bronze};">${streak.weekStreak}w</span>
</div>`;

const homeBody = `
  <div style="display:flex;justify-content:space-between;align-items:flex-start;">
    <div><div style="font:700 26px system-ui;color:${c.text};">Hey Hugo</div>
    <div style="font:400 15px system-ui;color:${c.textDim};margin-top:2px;">4 of 4 sessions this week</div></div>
    ${streakChip}
  </div>
  <div style="margin-top:16px;background:${c.card};border:1px solid ${c.border};border-radius:16px;padding:14px;display:flex;justify-content:space-between;">
    <div style="text-align:center;flex:1;"><div style="font:700 26px system-ui;color:${c.text};">${sessions.length}</div><div style="font:500 12px system-ui;color:${c.textDim};">Workouts</div></div>
    <div style="text-align:center;flex:1;"><div style="font:700 26px system-ui;color:${c.text};">${streak.longestWeekStreak}w</div><div style="font:500 12px system-ui;color:${c.textDim};">Best streak</div></div>
    <div style="text-align:center;flex:1;"><div style="font:700 26px system-ui;color:${c.text};">${report.unlockedCount}</div><div style="font:500 12px system-ui;color:${c.textDim};">Milestones</div></div>
  </div>
`;

const workoutBody = `
  <div style="display:flex;align-items:center;gap:12px;background:${c.bronzeSoft};border:1px solid rgba(192,138,62,0.4);border-radius:16px;padding:16px;">
    <span style="font-size:20px;">🏆</span>
    <div>
      <div style="font:600 15px system-ui;color:${c.text};">${justUnlocked.length === 1 ? 'Milestone unlocked' : `${justUnlocked.length} milestones unlocked`}</div>
      <div style="font:400 13px system-ui;color:${c.bronze};margin-top:2px;">${justUnlocked.map((a) => a.tier.label).join(' · ')}</div>
    </div>
  </div>
  <div style="text-align:center;padding:20px 8px 8px;">
    <div style="font:700 19px system-ui;color:${c.text};">Ready to train</div>
  </div>
`;

function tierRows(cat: AchievementCategory) {
  return report.byCategory[cat].map((a) => `
    <div style="display:flex;align-items:center;gap:10px;padding:10px 0;border-top:1px solid ${c.border};">
      <div style="width:22px;height:22px;border-radius:11px;border:1px solid ${a.unlocked ? c.bronze : c.border};background:${a.unlocked ? c.bronzeSoft : c.cardAlt};display:flex;align-items:center;justify-content:center;font-size:11px;color:${a.unlocked ? c.bronze : c.textDim};">${a.unlocked ? '✓' : '·'}</div>
      <div style="flex:1;">
        <div style="font:600 13px system-ui;color:${a.unlocked ? c.text : c.textDim};">${a.tier.label}</div>
        <div style="font:400 11px system-ui;color:${c.textDim};margin-top:1px;">${a.tier.detail}${a.achievedAt ? ' · ' + new Date(a.achievedAt).toLocaleDateString(undefined, { day: 'numeric', month: 'short' }) : ''}</div>
      </div>
    </div>`).join('');
}

const achievementsBody = `
  <div style="font:700 30px system-ui;color:${c.text};">${report.unlockedCount} <span style="font:400 18px system-ui;color:${c.textDim};">of ${report.totalCount}</span></div>
  <div style="font:400 12px system-ui;color:${c.textDim};margin-top:2px;">Milestones unlocked</div>
  <div style="height:6px;border-radius:3px;background:${c.cardAlt};margin-top:10px;overflow:hidden;"><div style="height:100%;width:${Math.round((report.unlockedCount / report.totalCount) * 100)}%;background:${c.bronze};"></div></div>
  <div style="font:700 10px system-ui;color:${c.textDim};letter-spacing:0.08em;margin-top:18px;">SESSIONS</div>
  ${tierRows('sessions')}
  <div style="font:700 10px system-ui;color:${c.textDim};letter-spacing:0.08em;margin-top:14px;">CONSISTENCY</div>
  ${tierRows('streak')}
`;

const html = `<!doctype html><html><head><meta charset="utf-8"><title>ATLAS — Retention</title>
<style>body{background:#f2f0ec;font-family:system-ui;margin:0;padding:40px;display:flex;gap:32px;flex-wrap:wrap;align-items:flex-start;}</style>
</head><body>
${phone('HOME — streak chip', homeBody)}
${phone('WORKOUT (empty) — unlock banner', workoutBody)}
${phone('ACHIEVEMENTS — sessions & streak', achievementsBody)}
</body></html>`;

const outDir = path.join(__dirname, '..', '..', 'preview');
fs.mkdirSync(outDir, { recursive: true });
fs.writeFileSync(path.join(outDir, 'atlas-retention.html'), html);
console.log(`\nWrote ${path.join(outDir, 'atlas-retention.html')}`);
