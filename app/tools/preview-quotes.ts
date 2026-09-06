/**
 * Renders the three spots the Stoic quote feature actually shows up, using
 * the real selector functions and the real Obsidian palette values, so what
 * gets eyeballed is what ships — not a mockup of it.
 *
 *   npx tsx tools/preview-quotes.ts
 *   → preview/atlas-quotes.html
 */
import fs from 'fs';
import path from 'path';
import { quoteOfTheDay, quoteByTheme, Quote } from '../src/data/quotes';

const c = {
  bg: '#0D0D0E',
  bgElevated: '#141415',
  card: '#181715',
  cardAlt: '#1F1E1C',
  border: '#2A2825',
  text: '#F0EEE9',
  textSecondary: '#A8A49B',
  textDim: '#8C887F',
  bronze: '#C08A3E',
};

const today = quoteOfTheDay();
const startQuote = quoteByTheme(['action', 'discipline'], Math.floor(Date.now() / 86_400_000) + 1);
const restQuote = quoteByTheme(['patience', 'endurance', 'discipline'], Date.now() + 240_000);

function quoteBlock(q: Quote, { card = false, compact = false }: { card?: boolean; compact?: boolean } = {}) {
  return `
    <div style="display:flex;gap:12px;align-items:stretch;
      ${card ? `background:${c.card};border:1px solid ${c.border};border-radius:16px;padding:16px;` : ''}">
      <div style="width:2px;border-radius:1px;background:${c.bronze};align-self:stretch;"></div>
      <div style="flex:1;">
        <div style="font-style:italic;color:${c.textSecondary};line-height:${compact ? '18px' : '21px'};font-size:${compact ? '13px' : '15px'};">${q.text}</div>
        <div style="margin-top:${compact ? '6px' : '8px'};font-size:11px;font-weight:700;letter-spacing:1.1px;color:${c.bronze};">${q.author.toUpperCase()} · ${q.source}</div>
      </div>
    </div>`;
}

function phone(title: string, body: string) {
  return `
  <div style="width:320px;">
    <div style="font:600 13px system-ui;color:${c.textDim};margin-bottom:8px;letter-spacing:0.5px;">${title}</div>
    <div style="background:${c.bg};border-radius:28px;padding:18px;box-shadow:0 20px 60px rgba(0,0,0,0.5);border:1px solid #000;">
      ${body}
    </div>
  </div>`;
}

const homeBody = `
  <div style="font:700 26px system-ui;color:${c.text};letter-spacing:-0.5px;">Hey Hugo</div>
  <div style="font:400 15px system-ui;color:${c.textDim};margin-top:2px;">3 of 4 sessions this week</div>
  <div style="margin-top:16px;">${quoteBlock(today)}</div>
  <div style="margin-top:16px;background:${c.card};border:1px solid ${c.border};border-radius:16px;padding:14px;display:flex;justify-content:space-between;">
    <div style="text-align:center;flex:1;"><div style="font:700 26px system-ui;color:${c.text};">3</div><div style="font:500 12px system-ui;color:${c.textDim};">Workouts</div></div>
    <div style="text-align:center;flex:1;"><div style="font:700 26px system-ui;color:${c.text};">27</div><div style="font:500 12px system-ui;color:${c.textDim};">Sets</div></div>
    <div style="text-align:center;flex:1;"><div style="font:700 26px system-ui;color:${c.text};">8,140</div><div style="font:500 12px system-ui;color:${c.textDim};">Volume kg</div></div>
  </div>
`;

const workoutBody = `
  <div style="text-align:center;padding:24px 8px 8px;">
    <div style="font:700 19px system-ui;color:${c.text};">Ready to train</div>
    <div style="font:400 14px system-ui;color:${c.textDim};margin-top:6px;">Start an empty session, or pick up one of your routines.</div>
  </div>
  <div style="margin-top:16px;background:${c.bronze};color:#141313;text-align:center;padding:14px;border-radius:12px;font:700 15px system-ui;">Start Empty Workout</div>
  <div style="margin-top:24px;">${quoteBlock(startQuote, { card: true })}</div>
`;

const restBody = `
  <div style="background:${c.bgElevated};border-top:1px solid ${c.border};border-radius:12px;overflow:hidden;">
    <div style="display:flex;align-items:center;justify-content:space-between;padding:12px 16px;">
      <div style="font:700 13px system-ui;color:${c.textSecondary};">−15s</div>
      <div style="text-align:center;">
        <div style="font:700 11px system-ui;color:${c.textDim};letter-spacing:1px;">REST</div>
        <div style="font:700 24px system-ui;color:${c.text};font-variant-numeric:tabular-nums;">1:15</div>
      </div>
      <div style="font:700 13px system-ui;color:${c.textSecondary};">+15s</div>
      <div style="background:${c.cardAlt};border-radius:999px;padding:6px 12px;font:700 13px system-ui;color:${c.text};">Skip</div>
    </div>
    <div style="padding:0 16px 12px;">${quoteBlock(restQuote, { compact: true })}</div>
  </div>
`;

const html = `<!doctype html><html><head><meta charset="utf-8"><title>ATLAS — Stoic quotes</title>
<style>body{background:#f2f0ec;font-family:system-ui;margin:0;padding:40px;display:flex;gap:32px;flex-wrap:wrap;}</style>
</head><body>
${phone('HOME — quote of the day', homeBody)}
${phone('WORKOUT (empty) — start prompt', workoutBody)}
${phone('REST TIMER — mid-rest', restBody)}
</body></html>`;

const outDir = path.join(__dirname, '..', '..', 'preview');
fs.mkdirSync(outDir, { recursive: true });
const outPath = path.join(outDir, 'atlas-quotes.html');
fs.writeFileSync(outPath, html);
console.log(`\nWrote ${outPath}`);
console.log(`  Home:     ${today.id} — "${today.text.slice(0, 60)}..."`);
console.log(`  Workout:  ${startQuote.id} — "${startQuote.text.slice(0, 60)}..."`);
console.log(`  Rest:     ${restQuote.id} — "${restQuote.text.slice(0, 60)}..."`);
