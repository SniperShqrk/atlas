/**
 * Renders the four palettes onto the surfaces that encode meaning in colour —
 * the recovery scale, the balance radar, the insight severities and a card of
 * type — plus a contrast audit, because a theme that cannot carry the data is
 * not a theme.
 *
 *   npx tsx tools/preview-themes.ts
 */
import fs from 'node:fs';
import path from 'node:path';

import { PALETTES, Palette, THEME_ORDER } from '../src/theme/palettes';
import { radarGeometry } from '../src/components/radarGeometry';

/* ------------------------------------------------------------------ */
/* Contrast audit                                                      */
/* ------------------------------------------------------------------ */

function parse(hex: string): [number, number, number] | null {
  const m = /^#([0-9a-f]{6})$/i.exec(hex.trim());
  if (!m) return null;
  const n = parseInt(m[1], 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}

function luminance(rgb: [number, number, number]): number {
  const [r, g, b] = rgb.map((v) => {
    const s = v / 255;
    return s <= 0.03928 ? s / 12.92 : Math.pow((s + 0.055) / 1.055, 2.4);
  });
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

function contrast(a: string, b: string): number | null {
  const ra = parse(a);
  const rb = parse(b);
  if (!ra || !rb) return null;
  const la = luminance(ra);
  const lb = luminance(rb);
  return (Math.max(la, lb) + 0.05) / (Math.min(la, lb) + 0.05);
}

/** Pairs that must stay legible in every theme, with the ratio each needs. */
const CHECKS: { label: string; fg: keyof Palette; bg: keyof Palette; min: number }[] = [
  { label: 'body text on ground', fg: 'text', bg: 'bg', min: 7 },
  { label: 'body text on card', fg: 'text', bg: 'card', min: 7 },
  { label: 'secondary on card', fg: 'textSecondary', bg: 'card', min: 4.5 },
  { label: 'dim text on card', fg: 'textDim', bg: 'card', min: 3.5 },
  { label: 'faint text on card', fg: 'textFaint', bg: 'card', min: 2.2 },
  { label: 'accent on card', fg: 'accent', bg: 'card', min: 3 },
  { label: 'bronze on card', fg: 'bronze', bg: 'card', min: 3 },
  { label: 'label on accent fill', fg: 'onAccent', bg: 'accent', min: 4.5 },
  { label: 'fresh muscle on figure', fg: 'recoveryFresh', bg: 'bodyBase', min: 1.6 },
  { label: 'fatigued muscle on figure', fg: 'recoveryFatigued', bg: 'bodyBase', min: 1.3 },
  { label: 'radar stroke on card', fg: 'marbleLight', bg: 'card', min: 3 },
  { label: 'card against ground', fg: 'card', bg: 'bg', min: 1.05 },
];

let failures = 0;
const audit: Record<string, { label: string; ratio: number; min: number; ok: boolean }[]> = {};

console.log('\nContrast audit\n');
for (const name of THEME_ORDER) {
  const p = PALETTES[name];
  const rows = CHECKS.map((c) => {
    const ratio = contrast(String(p[c.fg]), String(p[c.bg])) ?? 0;
    const ok = ratio >= c.min;
    if (!ok) failures += 1;
    return { label: c.label, ratio: Math.round(ratio * 100) / 100, min: c.min, ok };
  });
  audit[name] = rows;
  const worst = rows.filter((r) => !r.ok);
  console.log(
    `  ${p.label.padEnd(9)} ${worst.length === 0 ? 'all pass' : worst.map((w) => `${w.label} ${w.ratio} < ${w.min}`).join('; ')}`
  );
}

/* ------------------------------------------------------------------ */
/* Render                                                              */
/* ------------------------------------------------------------------ */

// a believably uneven training week, so the radar has a real shape
const RATIOS = [0.87, 1.12, 1.08, 0.63, 0.0, 0.54, 0.62, 0.91];
const SPOKES = ['CHEST', 'DELTS', 'ARMS', 'CORE', 'CALF', 'POST', 'QUAD', 'BACK'];
const geo = radarGeometry(RATIOS, 210, 34);

function radar(p: Palette): string {
  return `<svg viewBox="0 0 210 210" width="210" height="210">
    ${geo.rings.map((r) => `<polygon points="${r.points}" fill="none" stroke="${r.value === 1 ? p.bronze : p.border}" stroke-width="${r.value === 1 ? 1.1 : 1}"${r.value === 1 ? ' stroke-dasharray="3 4"' : ''}/>`).join('')}
    ${geo.axes.map((a) => `<line x1="${geo.cx}" y1="${geo.cy}" x2="${a.x}" y2="${a.y}" stroke="${p.border}"/>`).join('')}
    <polygon points="${geo.polygon}" fill="${p.marbleLight}" fill-opacity="0.14" stroke="${p.marbleLight}" stroke-width="1.8" stroke-linejoin="round"/>
    ${geo.valuePoints.map((v, i) => {
      const tone = RATIOS[i] < 0.35 ? p.accent : RATIOS[i] > 1.3 ? p.bronze : p.marbleLight;
      return `<circle cx="${v.x}" cy="${v.y}" r="3" fill="${tone}"/>`;
    }).join('')}
    ${geo.axes.map((a, i) => `<text x="${a.labelX}" y="${a.labelY + 3}" fill="${RATIOS[i] < 0.35 ? p.accent : p.textDim}" font-size="8" font-weight="700" text-anchor="${a.anchor}" font-family="system-ui">${SPOKES[i]}</text>`).join('')}
  </svg>`;
}

const SCALE: { label: string; key: keyof Palette }[] = [
  { label: 'Fresh', key: 'recoveryFresh' },
  { label: 'Ready', key: 'recoveryReady' },
  { label: 'Moderate', key: 'recoveryModerate' },
  { label: 'Fatigued', key: 'recoveryFatigued' },
  { label: 'Untrained', key: 'recoveryUntrained' },
];

function panel(p: Palette): string {
  const rows = audit[p.name];
  const bad = rows.filter((r) => !r.ok);

  return `<section class="theme" style="background:${p.bg};color:${p.text}">
  <header class="th">
    <div>
      <h2 style="color:${p.text}">${p.label}</h2>
      <p style="color:${p.textDim}">${p.blurb}</p>
    </div>
    <span class="pill" style="background:${p.bronzeSoft};color:${p.bronze};border-color:${p.bronze}">
      ${bad.length === 0 ? 'CONTRAST OK' : bad.length + ' TIGHT'}
    </span>
  </header>

  <div class="grid">
    <!-- a card of type, an accent action and a bronze state -->
    <div class="card" style="background:${p.card};border-color:${p.border}">
      <div class="eyebrow" style="color:${p.bronze}">ATLAS READ YOUR LAST BLOCK</div>
      <div class="h" style="color:${p.text}">Calves is falling behind</div>
      <div class="b" style="color:${p.textSecondary}">No direct calves work logged in this period.</div>
      <div class="b" style="color:${p.textDim}">Target 12 sets a week · currently 0</div>
      <div class="actions">
        <span class="btn" style="background:${p.accent};color:${p.onAccent}">See what ATLAS found</span>
        <span class="btn ghost" style="border-color:${p.bronze};color:${p.bronze}">Premium</span>
      </div>
      <div class="sev">
        ${[['ACTION', p.accent], ['WATCH', p.textSecondary], ['WORKING', p.bronze]]
          .map(([t, col]) => `<span style="color:${col}"><i style="background:${col}"></i>${t}</span>`)
          .join('')}
      </div>
    </div>

    <!-- the radar -->
    <div class="card center" style="background:${p.card};border-color:${p.border}">
      ${radar(p)}
    </div>

    <!-- the recovery scale against the figure -->
    <div class="card" style="background:${p.card};border-color:${p.border}">
      <div class="eyebrow" style="color:${p.textDim}">RECOVERY SCALE ON THE FIGURE</div>
      <div class="figure" style="background:${p.bodyBase}">
        ${SCALE.map((s) => `<div class="swatch" style="background:${p[s.key]}"></div>`).join('')}
      </div>
      <div class="scaleLabels">
        ${SCALE.map((s) => `<span style="color:${p.textFaint}">${s.label}</span>`).join('')}
      </div>
      <div class="eyebrow" style="color:${p.textDim};margin-top:16px">SURFACES</div>
      <div class="surfaces">
        ${(['bg', 'bgElevated', 'card', 'cardAlt', 'border', 'borderStrong'] as (keyof Palette)[])
          .map((k) => `<div style="background:${p[k]};border-color:${p.borderStrong}" title="${k}"></div>`)
          .join('')}
      </div>
    </div>
  </div>

  ${bad.length ? `<p class="warn" style="color:${p.accent}">Tightest pairs: ${bad.map((b) => `${b.label} ${b.ratio}:1`).join(' · ')}</p>` : ''}
</section>`;
}

const html = `<title>ATLAS Palettes</title>
<style>
  :root { --line:#2A2825; }
  * { box-sizing:border-box; }
  body { margin:0; background:#08080A; color:#F0EEE9;
    font-family:-apple-system,BlinkMacSystemFont,"Segoe UI",system-ui,sans-serif; }
  .page { max-width:1180px; margin:0 auto; padding:44px 24px 80px; }
  h1 { font-size:30px; font-weight:700; letter-spacing:6px; margin:0; }
  h1 b { color:#C08A3E; }
  .lede { color:#8C887F; font-size:14.5px; line-height:1.65; margin:14px 0 0; max-width:74ch; }
  .theme { border-radius:16px; padding:26px 26px 22px; margin-top:26px; border:1px solid var(--line); }
  .th { display:flex; align-items:flex-start; justify-content:space-between; gap:16px; }
  .th h2 { margin:0; font-size:22px; font-weight:700; letter-spacing:-.3px; }
  .th p { margin:5px 0 0; font-size:13.5px; }
  .pill { font-size:9.5px; font-weight:700; letter-spacing:1.4px; border:1px solid; border-radius:5px; padding:4px 8px; white-space:nowrap; }
  .grid { display:grid; grid-template-columns:1.25fr .85fr 1fr; gap:16px; margin-top:20px; }
  .card { border:1px solid; border-radius:14px; padding:18px; }
  .card.center { display:flex; align-items:center; justify-content:center; }
  .eyebrow { font-size:9.5px; font-weight:700; letter-spacing:1.6px; }
  .h { font-size:19px; font-weight:600; margin-top:12px; letter-spacing:-.2px; }
  .b { font-size:13px; margin-top:6px; line-height:1.5; }
  .actions { display:flex; gap:8px; margin-top:16px; flex-wrap:wrap; }
  .btn { font-size:12.5px; font-weight:700; padding:9px 14px; border-radius:9px; }
  .btn.ghost { background:none; border:1px solid; }
  .sev { display:flex; gap:14px; margin-top:16px; font-size:9.5px; font-weight:700; letter-spacing:1.4px; }
  .sev span { display:flex; align-items:center; gap:5px; }
  .sev i { width:6px; height:6px; border-radius:3px; display:block; }
  .figure { display:flex; gap:6px; padding:12px; border-radius:9px; margin-top:10px; }
  .swatch { flex:1; height:34px; border-radius:5px; }
  .scaleLabels { display:flex; gap:6px; margin-top:6px; }
  .scaleLabels span { flex:1; font-size:9.5px; text-align:center; }
  .surfaces { display:flex; gap:6px; margin-top:10px; }
  .surfaces div { flex:1; height:26px; border-radius:5px; border:1px solid; }
  .warn { font-size:12px; margin:16px 0 0; }
  @media (max-width:900px) { .grid { grid-template-columns:1fr; } }
</style>
<div class="page">
  <h1>ATL<b>A</b>S</h1>
  <p class="lede">
    The four palettes on the three surfaces that encode meaning in colour. A theme swaps tokens and
    nothing else — accent always marks what needs work, bronze always marks what is recovering,
    complete or Premium. Each panel is drawn entirely in its own theme's tokens, and the badge
    reports a contrast audit of the pairs that have to stay legible.
  </p>
  ${THEME_ORDER.map((n) => panel(PALETTES[n])).join('\n')}
</div>`;

const out = path.resolve(process.cwd(), '../preview/atlas-themes.html');
fs.writeFileSync(out, html);
console.log(`\nWrote ${out}`);
console.log(`\n${failures === 0 ? 'All contrast checks passed' : `${failures} contrast check(s) below target`}\n`);
