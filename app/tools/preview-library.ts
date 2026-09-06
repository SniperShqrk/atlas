/**
 * Renders the new exercise-detail content for a few representative lifts, so
 * the derived coaching, variations and substitutions can be read rather than
 * trusted.
 *
 *   npx tsx tools/preview-library.ts
 */
import fs from 'node:fs';
import path from 'node:path';
import { EXERCISES, getExerciseById, MUSCLE_LABELS, EQUIPMENT_LABELS } from '../src/data/exercises';
import { PATTERNS, PATTERN_GROUPS } from '../src/data/patterns';
import {
  commonMistakesFor,
  substitutionsFor,
  variationsOf,
  equipmentFor,
} from '../src/data/exerciseRelations';

const SHOW = ['barbell_bench_press', 'romanian_deadlift', 'lateral_raise', 'cable_pull_through'];
const ACCESS: Record<string, string> = {
  barbell_bench_press: 'home_dumbbells',
  romanian_deadlift: 'full_gym',
  lateral_raise: 'full_gym',
  cable_pull_through: 'bodyweight_only',
};

const esc = (s: string) => s.replace(/[&<>]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;' }[c]!));

const panels = SHOW.map((id) => {
  const e = getExerciseById(id)!;
  const p = PATTERNS[e.pattern];
  const access = ACCESS[id];
  const mistakes = commonMistakesFor(e);
  const vars = variationsOf(e, 4);
  const subs = substitutionsFor(e, { allowed: equipmentFor(access), limit: 4 });

  return `<section class="ex">
  <header>
    <h2>${esc(e.name)}</h2>
    <div class="chips">
      <span>${esc(EQUIPMENT_LABELS[e.equipment])}</span>
      <span>${e.mechanic}</span>
      <span>${e.difficulty}</span>
      <span class="pat">${esc(p.label)}</span>
    </div>
    <p class="summary">${esc(p.summary)}</p>
  </header>

  <div class="cols">
    <div class="col wide">
      <h3>Common mistakes</h3>
      ${mistakes
        .map(
          (m, i) =>
            `<div class="mistake${i < (e.mistakes?.length ?? 0) ? ' specific' : ''}">
               <i>✕</i><p>${esc(m)}</p></div>`
        )
        .join('')}
      ${
        e.mistakes?.length
          ? `<p class="note">The first ${e.mistakes.length} are specific to this lift. The rest are
             true of every ${esc(p.label.toLowerCase())} and are written once, on the pattern.</p>`
          : `<p class="note">All inherited from the ${esc(p.label.toLowerCase())} pattern — nothing
             specific to this lift needed adding.</p>`
      }
    </div>

    <div class="col">
      <h3>Variations</h3>
      ${vars
        .map(
          (v) =>
            `<div class="row"><b>${esc(v.name)}</b><span>${esc(EQUIPMENT_LABELS[v.equipment])} · ${v.difficulty}</span></div>`
        )
        .join('')}

      <h3 style="margin-top:26px">If you can't do this one</h3>
      <p class="access">Equipment: ${access.replace(/_/g, ' ')}</p>
      ${subs
        .map(
          (s) =>
            `<div class="row"><b>${esc(s.exercise.name)}</b><span>${esc(s.reason)}</span></div>`
        )
        .join('')}
    </div>
  </div>
</section>`;
}).join('\n');

const byPattern = PATTERN_GROUPS.map((g) => {
  const n = EXERCISES.filter((e) => g.patterns.includes(e.pattern)).length;
  return `<div class="bucket"><b>${n}</b><span>${esc(g.label)}</span></div>`;
}).join('');

const html = `<title>ATLAS Exercise Library</title>
<style>
  :root { --bg:#0D0D0E; --card:#181715; --alt:#1F1E1C; --line:#2A2825; --ink:#F0EEE9;
          --sec:#A8A49B; --dim:#8C887F; --faint:#5A5750; --accent:#B4472F; --bronze:#C08A3E; }
  * { box-sizing:border-box; }
  body { margin:0; background:var(--bg); color:var(--ink);
    font-family:-apple-system,BlinkMacSystemFont,"Segoe UI",system-ui,sans-serif; line-height:1.6; }
  .page { max-width:1080px; margin:0 auto; padding:44px 26px 80px; }
  h1 { font-size:29px; font-weight:700; letter-spacing:6px; margin:0; }
  h1 b { color:var(--bronze); }
  .lede { color:var(--dim); font-size:14px; margin:14px 0 0; max-width:76ch; }
  .buckets { display:flex; gap:10px; flex-wrap:wrap; margin-top:24px; }
  .bucket { background:var(--card); border:1px solid var(--line); border-radius:10px;
    padding:12px 16px; min-width:92px; }
  .bucket b { display:block; font-size:22px; font-weight:700; font-variant-numeric:tabular-nums; }
  .bucket span { font-size:11px; color:var(--dim); letter-spacing:.4px; }
  .ex { background:var(--card); border:1px solid var(--line); border-radius:16px;
    padding:24px 26px; margin-top:26px; }
  .ex h2 { margin:0; font-size:23px; font-weight:600; letter-spacing:-.3px; }
  .chips { display:flex; gap:7px; flex-wrap:wrap; margin-top:12px; }
  .chips span { font-size:11.5px; color:var(--sec); background:var(--alt);
    border:1px solid var(--line); border-radius:99px; padding:4px 10px; text-transform:capitalize; }
  .chips .pat { color:var(--bronze); border-color:rgba(192,138,62,.4); }
  .summary { color:var(--dim); font-size:13px; margin:12px 0 0; }
  .cols { display:grid; grid-template-columns:1.35fr 1fr; gap:28px; margin-top:22px; }
  h3 { font-size:10.5px; font-weight:700; letter-spacing:1.6px; color:var(--dim);
    text-transform:uppercase; margin:0 0 12px; }
  .mistake { display:flex; gap:11px; margin-top:12px; }
  .mistake i { flex:0 0 auto; width:18px; height:18px; border-radius:9px; margin-top:3px;
    background:rgba(180,71,47,.15); color:var(--accent); font-size:10px; font-weight:700;
    display:flex; align-items:center; justify-content:center; font-style:normal; }
  .mistake p { margin:0; font-size:13.5px; color:var(--sec); line-height:1.62; }
  .mistake.specific i { background:rgba(192,138,62,.18); color:var(--bronze); }
  .mistake.specific p { color:var(--ink); }
  .note { font-size:11.5px; color:var(--faint); margin-top:16px; line-height:1.6; }
  .access { font-size:11.5px; color:var(--faint); margin:-4px 0 8px; text-transform:capitalize; }
  .row { display:flex; flex-direction:column; padding:9px 0; border-bottom:1px solid var(--line); }
  .row b { font-size:14px; font-weight:600; }
  .row span { font-size:11.5px; color:var(--faint); margin-top:1px; }
  @media (max-width:860px) { .cols { grid-template-columns:1fr; } }
</style>
<div class="page">
  <h1>ATL<b>A</b>S</h1>
  <p class="lede">
    ${EXERCISES.length} exercises. Common mistakes come from the movement pattern rather than being
    written out per exercise, so the coaching on a Smith incline press is the same coaching as on a
    barbell bench — because the errors are the same. Variations and substitutions are scored from
    the data, not listed by hand, which is how the substitution list can respect the equipment you
    actually have.
  </p>
  <div class="buckets">${byPattern}</div>
  ${panels}
</div>`;

const out = path.resolve(process.cwd(), '../preview/atlas-library.html');
fs.writeFileSync(out, html);
console.log(`Wrote ${out}`);
