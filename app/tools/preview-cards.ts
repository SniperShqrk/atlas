/**
 * Renders the share cards to a standalone HTML page so the composition and the
 * procedural marble can be judged before either is committed to a React Native
 * component.
 *
 *   npx tsx tools/preview-cards.ts
 */
import './nodeAssetShim';
import fs from 'node:fs';
import path from 'node:path';

import type { WorkoutSession, SetEntry } from '../src/store/workoutStore';
import { marbleGeometry, seedFrom } from '../src/components/marbleGeometry';
import { getArtwork, artworkImage } from '../src/share/artwork';
import {
  ShareCard,
  CARD_FORMATS,
  CardFormat,
  availableCards,
  sampleCard,
} from '../src/share/cards';

const DAY = 24 * 60 * 60 * 1000;
const NOW = new Date('2026-09-05T18:00:00Z').getTime();

/* A short, believable history — enough for every card builder to fire. */
const PLAN = [
  { name: 'Push', lifts: [['barbell_bench_press', 4, 70, 8], ['overhead_press', 3, 40, 8], ['triceps_pushdown', 3, 30, 12]] },
  { name: 'Pull', lifts: [['lat_pulldown', 4, 60, 10], ['barbell_row', 3, 55, 10], ['barbell_curl', 3, 30, 10]] },
  { name: 'Legs', lifts: [['back_squat', 4, 90, 6], ['romanian_deadlift', 3, 80, 8], ['standing_calf_raise', 3, 60, 15]] },
  { name: 'Upper', lifts: [['incline_barbell_press', 4, 55, 8], ['seated_cable_row', 3, 55, 10], ['lateral_raise', 4, 10, 15]] },
] as const;

function history(): WorkoutSession[] {
  const out: WorkoutSession[] = [];
  let n = 0;
  for (let w = 11; w >= 0; w -= 1) {
    [0, 1, 3, 4].forEach(function (off, d) {
      var day = PLAN[d];
      var at = NOW - w * 7 * DAY - (6 - off) * DAY - 3 * 3600 * 1000;
      if (at > NOW) return;
      var weeksIn = 11 - w;
      out.push({
        id: 's' + n++,
        name: day.name,
        startedAt: at,
        completedAt: at + 58 * 60 * 1000,
        durationSec: 58 * 60,
        entries: day.lifts.map(function (l) {
          var id = l[0] as string, setCount = l[1] as number, base = l[2] as number, reps = l[3] as number;
          var step = base < 25 ? 0.25 : base < 60 ? 0.5 : 1;
          var weightKg = Math.round((base + weeksIn * step) * 2) / 2;
          var sets: SetEntry[] = [];
          for (var s = 0; s < setCount; s += 1) {
            sets.push({ id: 'x' + n + '-' + s, weightKg: weightKg, reps: reps - (s > 1 ? 1 : 0), completed: true });
          }
          return { exerciseId: id, sets: sets };
        }),
      });
    });
  }
  return out;
}

const sessions = history();
const offers = availableCards(sessions, { targetDaysPerWeek: 4, now: NOW });
console.log('Cards offered: ' + offers.map(function (o) { return o.card.kind; }).join(', '));
offers.forEach(function (o) {
  console.log('  ' + o.card.kind.padEnd(8) + ' ' + o.card.hero + (o.card.heroUnit || '') + '  ' + o.card.title +
    '  [' + o.card.stats.map(function (s) { return s.label + ' ' + s.value; }).join(' | ') + ']');
});

/* ------------------------------------------------------------------ */
/* Render                                                              */
/* ------------------------------------------------------------------ */

const C = {
  bronze: '#C08A3E',
  marble: '#EDEAE3',
  text: '#F0EEE9',
  dim: 'rgba(240,238,233,0.62)',
  faint: 'rgba(240,238,233,0.38)',
  hair: 'rgba(240,238,233,0.16)',
};

function backdrop(card: ShareCard, w: number, h: number): string {
  const art = getArtwork(card.artworkId);
  const g = marbleGeometry(w, h, seedFrom(card.kind + card.artworkId + card.title), art.tone.lightAngle);
  const uid = card.kind + '-' + card.artworkId;

  return `<svg class="bg" viewBox="0 0 ${w} ${h}" preserveAspectRatio="xMidYMid slice" aria-hidden="true">
  <defs>
    <linearGradient id="stone-${uid}" x1="${g.light.x1}" y1="${g.light.y1}" x2="${g.light.x2}" y2="${g.light.y2}">
      <stop offset="0%" stop-color="${art.tone.highlight}"/>
      <stop offset="55%" stop-color="${art.tone.base}"/>
      <stop offset="100%" stop-color="${art.tone.base}"/>
    </linearGradient>
    <linearGradient id="scrim-${uid}" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0%" stop-color="#000" stop-opacity="0.30"/>
      <stop offset="42%" stop-color="#000" stop-opacity="0.10"/>
      <stop offset="100%" stop-color="#000" stop-opacity="0.86"/>
    </linearGradient>
  </defs>
  <rect width="${w}" height="${h}" fill="url(#stone-${uid})"/>
  ${g.veins.map(function (v) {
    return `<path d="${v.d}" fill="none" stroke="${C.marble}" stroke-width="${v.width}" stroke-opacity="${v.opacity.toFixed(3)}" stroke-linecap="round"/>`;
  }).join('\n  ')}
  ${g.specks.map(function (s) {
    return `<circle cx="${s.x}" cy="${s.y}" r="${s.r}" fill="${C.marble}" fill-opacity="${s.opacity.toFixed(3)}"/>`;
  }).join('\n  ')}
  <rect width="${w}" height="${h}" fill="url(#scrim-${uid})"/>
</svg>`;
}

function cardHtml(card: ShareCard, format: CardFormat, reason: string): string {
  const f = CARD_FORMATS[format];
  const art = getArtwork(card.artworkId);
  const when = new Date(card.at).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });

  return `<figure class="slot">
  <div class="card" style="aspect-ratio:${f.w}/${f.h}">
    ${backdrop(card, f.w, f.h)}
    <div class="frame"></div>
    <div class="content">
      <header>
        <span class="mark">ATL<b>A</b>S</span>
        <span class="when">${when}</span>
      </header>
      <div class="fill"></div>
      <div class="body">
        <div class="eyebrow">${card.eyebrow}</div>
        <div class="hero"><span class="n">${card.hero}</span>${card.heroUnit ? `<span class="u">${card.heroUnit}</span>` : ''}</div>
        <div class="ttl">${card.title}</div>
        ${card.subtitle ? `<div class="sub">${card.subtitle}</div>` : ''}
      </div>
      <div class="stats">
        ${card.stats.map(function (s) {
          return `<div><div class="sv">${s.value}</div><div class="sl">${s.label}</div></div>`;
        }).join('')}
      </div>
    </div>
    ${card.sample ? '<div class="sample">EXAMPLE</div>' : ''}
  </div>
  <figcaption><b>${card.kind}</b> · ${reason}<br><span>backdrop: ${art.name}${artworkImage(art.id) ? '' : ' (procedural marble — run tools/fetch-artwork.ts for the photograph)'}</span></figcaption>
</figure>`;
}

const cards = offers.slice(0, 5);
const html = `<title>ATLAS Share Cards</title>
<style>
  :root { --bg:#0D0D0E; --ink:#F0EEE9; --dim:#8C887F; --faint:#5A5750; --line:#2A2825; --bronze:#C08A3E; }
  * { box-sizing:border-box; }
  body { margin:0; background:var(--bg); color:var(--ink);
    font-family:-apple-system,BlinkMacSystemFont,"Segoe UI",system-ui,sans-serif; }
  .page { max-width:1200px; margin:0 auto; padding:44px 28px 72px; }
  h1 { font-size:30px; font-weight:700; letter-spacing:6px; margin:0; }
  h1 b { color:var(--bronze); font-weight:700; }
  .lede { color:var(--dim); font-size:14.5px; line-height:1.65; margin:14px 0 0; max-width:70ch; }
  .row { display:flex; flex-wrap:wrap; gap:28px; margin-top:38px; align-items:flex-start; }
  .slot { margin:0; width:300px; }
  .card { position:relative; width:100%; border-radius:18px; overflow:hidden;
    box-shadow:0 20px 44px rgba(0,0,0,.55); }
  .bg { position:absolute; inset:0; width:100%; height:100%; display:block; }
  .frame { position:absolute; inset:14px; border:1px solid rgba(240,238,233,0.14); border-radius:8px; pointer-events:none; }
  .content { position:absolute; inset:0; display:flex; flex-direction:column; padding:30px 28px; }
  header { display:flex; justify-content:space-between; align-items:baseline; }
  .mark { font-size:13px; font-weight:700; letter-spacing:4.5px; color:${C.text}; }
  .mark b { color:${C.bronze}; }
  .when { font-size:10.5px; letter-spacing:1px; color:${C.faint}; }
  .fill { flex:1; }
  .eyebrow { font-size:10px; font-weight:700; letter-spacing:2.2px; text-transform:uppercase; color:${C.bronze}; }
  .hero { display:flex; align-items:baseline; gap:7px; margin-top:9px; }
  .hero .n { font-size:64px; font-weight:700; letter-spacing:-2.5px; line-height:.95; color:${C.text};
    font-variant-numeric:tabular-nums; }
  .hero .u { font-size:17px; font-weight:600; color:${C.dim}; }
  .ttl { font-size:19px; font-weight:600; letter-spacing:-.3px; margin-top:12px; color:${C.text}; }
  .sub { font-size:12.5px; color:${C.dim}; margin-top:4px; }
  .stats { display:flex; gap:0; margin-top:22px; padding-top:16px; border-top:1px solid ${C.hair}; }
  .stats > div { flex:1; }
  .sv { font-size:15px; font-weight:700; color:${C.text}; font-variant-numeric:tabular-nums; }
  .sl { font-size:9.5px; letter-spacing:.8px; text-transform:uppercase; color:${C.faint}; margin-top:3px; }
  .sample { position:absolute; top:52px; right:28px; font-size:9px; font-weight:700; letter-spacing:1.6px;
    color:${C.bronze}; border:1px solid rgba(192,138,62,.5); border-radius:4px; padding:3px 6px; }
  figcaption { margin-top:12px; font-size:12.5px; color:var(--dim); line-height:1.6; }
  figcaption b { color:var(--ink); text-transform:capitalize; }
  figcaption span { color:var(--faint); font-size:11.5px; }
  h2 { font-size:15px; font-weight:600; margin:56px 0 0; color:var(--ink); }
</style>
<div class="page">
  <h1>ATL<b>A</b>S</h1>
  <p class="lede">
    Share cards, drawn from a 12-week logged history. The backdrop is procedural marble seeded from
    the card itself, so a given card always renders the same slab — real sculpture photography drops
    into the same slot once it is sourced, and each entry already names which piece it wants and why.
  </p>
  <div class="row">
    ${cards.map(function (o) { return cardHtml(o.card, 'portrait', o.reason); }).join('\n')}
  </div>

  <h2>Formats</h2>
  <div class="row">
    ${(['square', 'portrait', 'story'] as CardFormat[]).map(function (f) {
      return cardHtml(cards[0].card, f, CARD_FORMATS[f].label + ' — ' + CARD_FORMATS[f].note);
    }).join('\n')}
  </div>

  <h2>Empty state / onboarding sample</h2>
  <div class="row">
    ${cardHtml(sampleCard(), 'portrait', 'Shown before any real data exists, labelled as an example')}
  </div>
</div>`;

const out = path.resolve(process.cwd(), '../preview/atlas-cards.html');
fs.writeFileSync(out, html);
console.log('\nWrote ' + out);
