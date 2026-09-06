/**
 * Renders the whole app as phone frames in a browser, from the real modules.
 *
 * Nothing here is a mockup: the recovery figure uses the app's own vendored
 * anatomy paths and deltoid split, the insights come out of the insight engine,
 * the radar out of the radar geometry, the exercise coaching out of the pattern
 * taxonomy, and every colour out of the Obsidian palette. If a screen looks
 * wrong here it is wrong in the app.
 *
 *   npx tsx tools/preview-app.ts
 */
import './nodeAssetShim';
import fs from 'node:fs';
import path from 'node:path';

import type { WorkoutSession, SetEntry } from '../src/store/workoutStore';
import { PALETTES, Palette, THEME_ORDER } from '../src/theme/palettes';
import {
  FRONT_REGIONS,
  BACK_REGIONS,
  FRONT_VIEW_BOX,
  BACK_VIEW_BOX,
  DELTOID_SPLIT,
  BodyRegion,
} from '../src/data/bodyPaths';
import { EXERCISES, MUSCLE_LABELS, EQUIPMENT_LABELS, MuscleGroup, getExerciseById } from '../src/data/exercises';
import { PATTERNS, PATTERN_GROUPS } from '../src/data/patterns';
import { commonMistakesFor, substitutionsFor, variationsOf, equipmentFor } from '../src/data/exerciseRelations';
import { computeMuscleLoads, MuscleLoad } from '../src/store/recovery';
import {
  computeRangeMetrics,
  muscleBalance,
  balanceScore,
  rangeWindow,
  previousWindow,
  pctChange,
  consistency,
  REGION_SHORT,
} from '../src/store/analytics';
import { buildInsights, sampleInsight } from '../src/store/insights';
import { radarGeometry } from '../src/components/radarGeometry';
import { marbleGeometry, seedFrom } from '../src/components/marbleGeometry';
import { availableCards, sampleCard, ShareCard, CARD_FORMATS } from '../src/share/cards';
import { getArtwork, artworkImage } from '../src/share/artwork';
import { quoteOfTheDay, quoteByTheme } from '../src/data/quotes';
import { computeAchievements, newlyUnlocked, CATEGORY_LABELS, AchievementCategory } from '../src/data/achievements';

const C: Palette = PALETTES.obsidian;
const DAY = 24 * 60 * 60 * 1000;
const NOW = new Date('2026-09-06T18:00:00Z').getTime();
const esc = (s: string) => String(s).replace(/[&<>]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;' }[c]!));

/* ------------------------------------------------------------------ */
/* A logged history, so every screen has something true on it          */
/* ------------------------------------------------------------------ */

const PLAN = [
  { name: 'Push', lifts: [['barbell_bench_press', 4, 72, 8], ['incline_db_press', 3, 28, 10], ['overhead_press', 3, 42, 8], ['cable_fly', 3, 18, 14], ['triceps_pushdown', 3, 32, 12]] },
  { name: 'Pull', lifts: [['lat_pulldown', 4, 62, 10], ['barbell_row', 3, 57, 10], ['barbell_curl', 3, 30, 10], ['hammer_curl', 3, 14, 12]] },
  { name: 'Legs', lifts: [['back_squat', 4, 92, 6], ['leg_press', 3, 155, 12], ['leg_extension', 3, 47, 15]] },
  { name: 'Upper', lifts: [['incline_barbell_press', 4, 57, 8], ['seated_cable_row', 3, 57, 10], ['lateral_raise', 4, 11, 15], ['cable_crunch', 3, 36, 15]] },
] as const;

function history(): WorkoutSession[] {
  const out: WorkoutSession[] = [];
  let n = 0;
  for (let w = 23; w >= 0; w -= 1) {
    [0, 1, 3, 4].forEach((off, d) => {
      const day = PLAN[d];
      const at = NOW - w * 7 * DAY - (6 - off) * DAY - 4 * 3600 * 1000;
      if (at > NOW) return;
      const weeksIn = 23 - w;
      out.push({
        id: 's' + n++,
        name: day.name,
        startedAt: at,
        completedAt: at + 64 * 60 * 1000,
        durationSec: 64 * 60,
        entries: day.lifts.map((l) => {
          const id = l[0] as string, setCount = l[1] as number, base = l[2] as number, reps = l[3] as number;
          const prog = id === 'back_squat' ? Math.min(weeksIn, 16) : weeksIn;
          const step = base < 25 ? 0.25 : base < 60 ? 0.6 : 1;
          const weightKg = Math.round((base + prog * step) * 2) / 2;
          const sets: SetEntry[] = [];
          for (let s = 0; s < setCount; s += 1) {
            sets.push({ id: `x${n}-${s}`, weightKg, reps: reps - (s > 1 ? 1 : 0), completed: true });
          }
          return { exerciseId: id, sets };
        }),
      });
    });
  }
  return out;
}

const sessions = history();
const loads = computeMuscleLoads(sessions, NOW);
const w30 = rangeWindow(sessions, '30D', NOW);
const metrics = computeRangeMetrics(sessions, w30);
const prev = computeRangeMetrics(sessions, previousWindow(w30));
const balance = muscleBalance(sessions, w30);
const score = balanceScore(balance);
const report = buildInsights(sessions, { range: '30D', targetDaysPerWeek: 4, now: NOW });
const streak = consistency(sessions, 4, NOW);
const todayQuote = quoteOfTheDay(new Date(NOW));
const achievements = computeAchievements(sessions, 4, NOW);
// the moment a real "milestone unlocked" banner would fire — the session that
// pushed the count past 50, found by diffing the report just before and after it
const unlockBefore = computeAchievements(sessions.slice(0, 49), 4, NOW);
const unlockAfter = computeAchievements(sessions.slice(0, 50), 4, NOW);
const justUnlocked = newlyUnlocked(unlockBefore, unlockAfter);

/* ------------------------------------------------------------------ */
/* The anatomy figure — same geometry the app uses                     */
/* ------------------------------------------------------------------ */

const SLUG_TO_MUSCLE: Record<string, MuscleGroup | null> = {
  chest: 'chest', abs: 'abs', obliques: 'obliques', biceps: 'biceps', triceps: 'triceps',
  forearm: 'forearms', trapezius: 'traps', 'upper-back': 'lats', 'lower-back': 'lower_back',
  gluteal: 'glutes', hamstring: 'hamstrings', adductors: 'hamstrings', quadriceps: 'quads',
  calves: 'calves', tibialis: 'calves',
  neck: null, head: null, hair: null, hands: null, feet: null, knees: null, ankles: null,
};

function recoveryColor(status: MuscleLoad['status'] | undefined): string {
  switch (status) {
    case 'fatigued': return C.recoveryFatigued;
    case 'moderate': return C.recoveryModerate;
    case 'ready': return C.recoveryReady;
    case 'fresh': return C.recoveryFresh;
    default: return C.recoveryUntrained;
  }
}

function bodySvg(view: 'front' | 'back', width: number): string {
  const isFront = view === 'front';
  const viewBox = isFront ? FRONT_VIEW_BOX : BACK_VIEW_BOX;
  const regions: BodyRegion[] = isFront ? FRONT_REGIONS : BACK_REGIONS;
  const [, , vbW, vbH] = viewBox.split(' ').map(Number);
  const height = width * (vbH / vbW);
  const split = isFront ? DELTOID_SPLIT.front : DELTOID_SPLIT.back;
  const innerHead: MuscleGroup = isFront ? 'front_delts' : 'rear_delts';
  const colorFor = (m: MuscleGroup) => recoveryColor(loads[m]?.status);

  const body = regions
    .filter((r) => r.slug !== 'deltoids')
    .map((r) => {
      const muscle = SLUG_TO_MUSCLE[r.slug];
      const fill = muscle ? colorFor(muscle) : C.bodyBase;
      return [...r.left, ...r.right]
        .map((d) => `<path d="${d}" fill="${fill}" stroke="${C.bodyLine}" stroke-width="1.4" stroke-linejoin="round"/>`)
        .join('');
    })
    .join('');

  const deltoid = regions.find((r) => r.slug === 'deltoids');
  const delts = !deltoid
    ? ''
    : (['left', 'right'] as const)
        .map((side) => {
          const box = split[side];
          const paths = deltoid[side];
          const innerHigh = side === 'left';
          const inner = innerHigh ? { x: box.cut, w: box.x + box.w - box.cut } : { x: box.x, w: box.cut - box.x };
          const outer = innerHigh ? { x: box.x - 2, w: box.cut - box.x + 2 } : { x: box.cut, w: box.x + box.w - box.cut + 2 };
          const ii = `di-${view}-${side}`, oi = `do-${view}-${side}`;
          return `<defs>
            <clipPath id="${ii}"><rect x="${inner.x}" y="${box.y - 4}" width="${inner.w}" height="${box.h + 8}"/></clipPath>
            <clipPath id="${oi}"><rect x="${outer.x}" y="${box.y - 4}" width="${outer.w}" height="${box.h + 8}"/></clipPath>
          </defs>
          <g clip-path="url(#${ii})">${paths.map((d) => `<path d="${d}" fill="${colorFor(innerHead)}"/>`).join('')}</g>
          <g clip-path="url(#${oi})">${paths.map((d) => `<path d="${d}" fill="${colorFor('side_delts')}"/>`).join('')}</g>
          ${paths.map((d) => `<path d="${d}" fill="none" stroke="${C.bodyLine}" stroke-width="1.4" stroke-linejoin="round"/>`).join('')}`;
        })
        .join('');

  return `<svg width="${width}" height="${height.toFixed(0)}" viewBox="${viewBox}">${body}${delts}</svg>`;
}

/* ------------------------------------------------------------------ */
/* Small renderers                                                     */
/* ------------------------------------------------------------------ */

function radarSvg(size: number): string {
  const geo = radarGeometry(balance.map((b) => b.ratio), size);
  return `<svg width="${size}" height="${size}" viewBox="0 0 ${size} ${size}">
    <defs><radialGradient id="rg" cx="50%" cy="50%" r="50%">
      <stop offset="0%" stop-color="${C.marbleLight}" stop-opacity="0.26"/>
      <stop offset="100%" stop-color="${C.marbleMid}" stop-opacity="0.08"/></radialGradient></defs>
    ${geo.rings.map((r) => `<polygon points="${r.points}" fill="none" stroke="${r.value === 1 ? C.bronze : C.border}" stroke-width="${r.value === 1 ? 1.1 : 1}"${r.value === 1 ? ' stroke-dasharray="3 4" opacity="0.75"' : ''}/>`).join('')}
    ${geo.axes.map((a) => `<line x1="${geo.cx}" y1="${geo.cy}" x2="${a.x}" y2="${a.y}" stroke="${C.border}"/>`).join('')}
    <polygon points="${geo.polygon}" fill="url(#rg)" stroke="${C.marbleLight}" stroke-width="1.8" stroke-linejoin="round"/>
    ${geo.valuePoints.map((p, i) => {
      const s = balance[i].status;
      const tone = s === 'neglected' ? C.accent : s === 'high' ? C.bronze : C.marbleLight;
      return `<circle cx="${p.x}" cy="${p.y}" r="3.2" fill="${tone}"/>`;
    }).join('')}
    ${geo.axes.map((a, i) => `<text x="${a.labelX}" y="${a.labelY + 3.5}" fill="${balance[i].status === 'neglected' ? C.accent : C.textDim}" font-size="9.5" font-weight="700" text-anchor="${a.anchor}" font-family="system-ui">${REGION_SHORT[balance[i].region]}</text>`).join('')}
  </svg>`;
}

function cardMarkup(card: ShareCard, width: number): string {
  const f = CARD_FORMATS.portrait;
  const art = getArtwork(card.artworkId);
  const g = marbleGeometry(f.w, f.h, seedFrom(card.kind + card.artworkId + card.title), art.tone.lightAngle);
  const uid = card.kind;
  const when = new Date(card.at).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });
  const s = width / 1080;

  return `<div class="sharecard" style="width:${width}px;height:${(width * f.h) / f.w}px">
    <svg class="bg" viewBox="0 0 ${f.w} ${f.h}" preserveAspectRatio="xMidYMid slice">
      <defs>
        <linearGradient id="st-${uid}" x1="${g.light.x1}" y1="${g.light.y1}" x2="${g.light.x2}" y2="${g.light.y2}">
          <stop offset="0%" stop-color="${art.tone.highlight}"/><stop offset="55%" stop-color="${art.tone.base}"/><stop offset="100%" stop-color="${art.tone.base}"/>
        </linearGradient>
        <linearGradient id="sc-${uid}" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stop-color="#000" stop-opacity="0.30"/><stop offset="42%" stop-color="#000" stop-opacity="0.10"/><stop offset="100%" stop-color="#000" stop-opacity="0.86"/>
        </linearGradient>
      </defs>
      <rect width="${f.w}" height="${f.h}" fill="url(#st-${uid})"/>
      ${g.veins.map((v) => `<path d="${v.d}" fill="none" stroke="${C.marbleLight}" stroke-width="${v.width}" stroke-opacity="${v.opacity.toFixed(3)}" stroke-linecap="round"/>`).join('')}
      ${g.specks.map((k) => `<circle cx="${k.x}" cy="${k.y}" r="${k.r}" fill="${C.marbleLight}" fill-opacity="${k.opacity.toFixed(3)}"/>`).join('')}
      <rect width="${f.w}" height="${f.h}" fill="url(#sc-${uid})"/>
    </svg>
    <div class="cframe" style="margin:${40 * s}px;border-radius:${20 * s}px"></div>
    <div class="ccontent" style="padding:${86 * s}px">
      <div class="chead">
        <span style="font-size:${38 * s}px;letter-spacing:${13 * s}px;font-weight:700">ATL<b style="color:${C.bronze}">A</b>S</span>
        <span style="font-size:${30 * s}px;color:rgba(240,238,233,.38)">${when}</span>
      </div>
      <div style="flex:1"></div>
      <div>
        <div style="font-size:${29 * s}px;letter-spacing:${6.4 * s}px;font-weight:700;color:${C.bronze};text-transform:uppercase">${esc(card.eyebrow)}</div>
        <div style="display:flex;align-items:flex-end;gap:${20 * s}px;margin-top:${26 * s}px">
          <span style="font-size:${186 * s}px;letter-spacing:${-7 * s}px;font-weight:700;line-height:.9">${esc(card.hero)}</span>
          ${card.heroUnit ? `<span style="font-size:${49 * s}px;font-weight:600;color:rgba(240,238,233,.62);padding-bottom:${22 * s}px">${esc(card.heroUnit)}</span>` : ''}
        </div>
        <div style="font-size:${55 * s}px;font-weight:600;margin-top:${34 * s}px">${esc(card.title)}</div>
        ${card.subtitle ? `<div style="font-size:${36 * s}px;color:rgba(240,238,233,.62);margin-top:${12 * s}px">${esc(card.subtitle)}</div>` : ''}
      </div>
      <div style="display:flex;margin-top:${64 * s}px;padding-top:${46 * s}px;border-top:1px solid rgba(240,238,233,.16)">
        ${card.stats.slice(0, 3).map((st) => `<div style="flex:1">
          <div style="font-size:${43 * s}px;font-weight:700">${esc(st.value)}</div>
          <div style="font-size:${27 * s}px;letter-spacing:${2.3 * s}px;color:rgba(240,238,233,.38);margin-top:${9 * s}px;font-weight:600">${esc(st.label.toUpperCase())}</div>
        </div>`).join('')}
      </div>
    </div>
    ${card.sample ? `<div class="csample">EXAMPLE</div>` : ''}
  </div>`;
}

const ICON = {
  home: 'M4,20.5 V11 C4,6.9 7.6,3.5 12,3.5 C16.4,3.5 20,6.9 20,11 V20.5 M4,20.5 H20',
  plan: 'M5,6.5 C5,5.1 6.1,4 7.5,4 C8.9,4 10,5.1 10,6.5 V17.5 C10,18.9 11.1,20 12.5,20 H17 C18.4,20 19.5,18.9 19.5,17.5 V6.5 C19.5,5.1 18.4,4 17,4 H7.5 M12.8,8.5 H16.6 M12.8,12 H16.6 M12.8,15.5 H15.2',
  workout: 'M2.8,9.5 V14.5 M6.3,6 V18 M17.7,6 V18 M21.2,9.5 V14.5 M6.3,12 H17.7',
  chart: 'M4,20 V4 M4,20 H20 M8,16.5 V12 M12,16.5 V7.5 M16,16.5 V10',
  profile: 'M12,3.8 C14.3,3.8 16.1,5.6 16.1,7.9 C16.1,10.2 14.3,12 12,12 C9.7,12 7.9,10.2 7.9,7.9 C7.9,5.6 9.7,3.8 12,3.8 Z M4.8,20.5 C4.8,16.4 8,13.4 12,13.4 C16,13.4 19.2,16.4 19.2,20.5',
  sparkle: 'M12,3 L13.6,9.1 L19.5,10.8 L13.6,12.5 L12,18.6 L10.4,12.5 L4.5,10.8 L10.4,9.1 Z M18.5,16 L19.2,18.3 L21.5,19 L19.2,19.7 L18.5,22 L17.8,19.7 L15.5,19 L17.8,18.3 Z',
  lock: 'M7,10.5 V7.5 C7,4.7 9.2,2.5 12,2.5 C14.8,2.5 17,4.7 17,7.5 V10.5 M5.5,10.5 H18.5 C19.3,10.5 20,11.2 20,12 V19.5 C20,20.3 19.3,21 18.5,21 H5.5 C4.7,21 4,20.3 4,19.5 V12 C4,11.2 4.7,10.5 5.5,10.5 Z M12,14.5 V17',
  chevron: 'M9,5 L16,12 L9,19',
  check: 'M5,12.5 L9.5,17 L19,7',
  search: 'M11,4 A7,7 0 1 1 10.99,4 Z M16.2,16.2 L20.5,20.5',
};
const ic = (n: keyof typeof ICON, size: number, color: string, sw = 1.6) =>
  `<svg width="${size}" height="${size}" viewBox="0 0 24 24" fill="none" stroke="${color}" stroke-width="${sw}" stroke-linecap="round" stroke-linejoin="round"><path d="${ICON[n]}"/></svg>`;

function tabBar(active: string): string {
  const tabs: [keyof typeof ICON, string][] = [['home', 'Home'], ['plan', 'Plan'], ['workout', 'Workout'], ['chart', 'Progress'], ['profile', 'Profile']];
  return `<nav class="tabbar">${tabs
    .map(([i, l]) => {
      const on = l === active;
      return `<div class="tab${on ? ' on' : ''}">${ic(i, 23, on ? C.accent : C.textFaint, on ? 1.9 : 1.6)}<span>${l}</span></div>`;
    })
    .join('')}</nav>`;
}

function phone(title: string, note: string, body: string, opts: { tab?: string; header?: boolean } = {}): string {
  return `<figure class="slot">
    <div class="phone">
      <div class="island"></div>
      <div class="statusbar"><span>9:41</span><span class="glyphs">
        <i style="height:5px"></i><i style="height:8px"></i><i style="height:11px"></i><i style="height:14px"></i>
        <svg width="26" height="13" viewBox="0 0 26 13" style="margin-left:5px"><rect x=".5" y=".5" width="21" height="12" rx="3.5" fill="none" stroke="${C.text}" opacity=".45"/><rect x="2" y="2" width="18" height="9" rx="2" fill="${C.text}"/><path d="M23.5 4.5v4a2.2 2.2 0 0 0 0-4z" fill="${C.text}" opacity=".45"/></svg>
      </span></div>
      <main class="screen">${body}</main>
      ${opts.tab ? tabBar(opts.tab) : ''}
      <div class="home-indicator"></div>
    </div>
    <figcaption><b>${esc(title)}</b><br><span>${note}</span></figcaption>
  </figure>`;
}

/* ------------------------------------------------------------------ */
/* Screens                                                             */
/* ------------------------------------------------------------------ */

const fatigued = (Object.values(loads) as MuscleLoad[])
  .filter((l) => l.recoveryPct < 65)
  .sort((a, b) => a.recoveryPct - b.recoveryPct)
  .slice(0, 3);
const ready = (Object.values(loads) as MuscleLoad[])
  .filter((l) => l.recoveryPct >= 85)
  .sort((a, b) => b.recoveryPct - a.recoveryPct)
  .slice(0, 3);

const w7 = computeRangeMetrics(sessions, rangeWindow(sessions, '7D', NOW));

const streakAtRisk = streak.daysSinceLast !== null && streak.daysSinceLast >= 4 + 2;
const homeScreen = `
  <div class="greetrow">
    <div>
      <h1 class="greeting">Hey Hugo</h1>
      <p class="sub">${w7.sessionCount} of 4 sessions this week</p>
    </div>
    ${streak.weekStreak > 0 ? `<div class="streakchip${streakAtRisk ? ' risk' : ''}">🔥<b>${streak.weekStreak}w</b></div>` : ''}
  </div>
  <div class="quoteblock" style="margin-top:14px">
    <i class="qrule"></i>
    <div><p>${esc(todayQuote.text)}</p><span>${todayQuote.author.toUpperCase()} · ${esc(todayQuote.source)}</span></div>
  </div>
  <div class="card row3" style="margin-top:16px">
    <div class="stat"><div class="v">${w7.sessionCount}</div><div class="l">Workouts</div></div>
    <div class="stat"><div class="v">${w7.totalSets}</div><div class="l">Sets</div></div>
    <div class="stat"><div class="v">${Math.round(w7.totalVolumeKg).toLocaleString('en-GB')}<small>kg</small></div><div class="l">Volume</div></div>
  </div>
  <button class="cta" style="margin-top:16px">Start Empty Workout</button>
  <div class="libraryRow">${ic('search', 17, C.textDim)}<span>Browse ${EXERCISES.length} exercises</span>${ic('chevron', 16, C.textFaint)}</div>

  <div class="sect"><span class="sect-t">Muscle Recovery</span></div>
  <div class="card">
    <div class="bodies">
      <div class="bodycol">${bodySvg('front', 118)}<div class="blabel">FRONT</div></div>
      <div class="bodycol">${bodySvg('back', 118)}<div class="blabel">BACK</div></div>
    </div>
    <div class="legend">
      ${[['Fresh', C.recoveryFresh], ['Ready', C.recoveryReady], ['Moderate', C.recoveryModerate], ['Fatigued', C.recoveryFatigued]]
        .map(([l, c]) => `<span class="lg"><i style="background:${c}"></i>${l}</span>`).join('')}
    </div>
  </div>

  <div class="sect"><span class="sect-t">Still Recovering</span></div>
  <div class="card">
    ${fatigued.map((l) => `<div class="mrow"><span>${MUSCLE_LABELS[l.muscle]}</span>
      <span class="bar"><i style="width:${l.recoveryPct}%;background:${recoveryColor(l.status)}"></i></span>
      <b style="color:${recoveryColor(l.status)}">${l.recoveryPct}%</b></div>`).join('')}
  </div>

  <div class="sect"><span class="sect-t">Ready To Train</span></div>
  <div class="card">
    ${ready.map((l) => `<div class="mrow"><span>${MUSCLE_LABELS[l.muscle]}</span>
      <span class="bar"><i style="width:${l.recoveryPct}%;background:${recoveryColor(l.status)}"></i></span>
      <b style="color:${recoveryColor(l.status)}">${l.recoveryPct}%</b></div>`).join('')}
  </div>`;

const topInsight = report.all[0];
const secondInsight = report.all[1];
const progressScreen = `
  <h1 class="title">Progress</h1>
  <div class="range">${['7D', '30D', '90D', '1Y', 'All'].map((r) => `<span class="${r === '30D' ? 'on' : ''}">${r}</span>`).join('')}</div>
  <div class="card row3" style="margin-top:16px">
    <div class="stat"><div class="v">${metrics.sessionCount}</div><div class="l">Sessions</div></div>
    <div class="stat"><div class="v">${metrics.totalSets}</div><div class="l">Sets</div></div>
    <div class="stat"><div class="v">${Math.round(metrics.totalVolumeKg / 1000)}k<small>kg</small></div><div class="l">Volume</div></div>
  </div>
  <div class="sect"><span class="sect-t">ATLAS Insights</span></div>
  <div class="headline">
    <div class="kicker">${ic('sparkle', 15, C.bronze, 1.5)}ATLAS READ YOUR LAST BLOCK</div>
    <div class="praise">${esc(report.headline!.praise)}.</div>
    <div class="tease">However — ${esc(report.headline!.tease)}</div>
    <button class="cta" style="margin-top:16px">See what ATLAS found ${ic('chevron', 15, C.onAccent, 2)}</button>
  </div>
  <div class="insight">
    <div class="itop"><i class="dot" style="background:${C.accent}"></i><span style="color:${C.accent}">ACTION</span><span class="grow"></span>${ic('chevron', 14, C.textFaint, 1.8)}</div>
    <h3>${esc(topInsight.headline)}</h3><p>${esc(topInsight.preview)}</p>
  </div>
  <div class="insight">
    <div class="itop"><i class="dot" style="background:${C.accent}"></i><span style="color:${C.accent}">ACTION</span><span class="grow"></span>${ic('lock', 14, C.textFaint)}</div>
    <h3>${esc(secondInsight.headline)}</h3><p>${esc(secondInsight.preview)}</p>
    <div class="lockfoot"><span>Diagnosis and fix</span><b>PREMIUM</b></div>
  </div>
  <div class="sect"><span class="sect-t">Muscle Balance</span></div>
  <div class="card">
    <p class="note">Each spoke is one region as a share of its own weekly set target. The dashed ring is on target.</p>
    <div style="display:flex;justify-content:center;margin-top:12px">${radarSvg(258)}</div>
    <div class="scorerow"><div class="n">${score}</div><div><div class="lbl">BALANCE SCORE</div>
      <div class="hint">${balance.filter((b) => b.status === 'on_target').length} of ${balance.length} regions inside their weekly range</div></div></div>
  </div>`;

const bench = getExerciseById('barbell_bench_press')!;
const benchPattern = PATTERNS[bench.pattern];
const benchMistakes = commonMistakesFor(bench);
const benchVars = variationsOf(bench, 3);
const benchSubs = substitutionsFor(bench, { allowed: equipmentFor('home_dumbbells'), limit: 3 });

const detailScreen = `
  <div class="modalhead">${ic('chevron', 18, C.accent, 1.9)}<span style="color:${C.accent}">Back</span></div>
  <h1 class="title" style="font-size:26px">${esc(bench.name)}</h1>
  <div class="chips">
    <span>Chest</span><span>Barbell</span><span>Compound</span><span>Intermediate</span>
    <span class="pat">${esc(benchPattern.label)}</span>
  </div>
  <p class="note" style="margin-top:12px">${esc(benchPattern.summary)}</p>
  <div class="card" style="margin-top:16px">
    <div class="ctitle">COMMON MISTAKES</div>
    ${benchMistakes.slice(0, 4).map((m, i) => `<div class="mistake${i < (bench.mistakes?.length ?? 0) ? ' spec' : ''}">
      <i>✕</i><p>${esc(m)}</p></div>`).join('')}
    <p class="mnote">The first ${bench.mistakes!.length} are specific to this lift; the rest apply to every ${esc(benchPattern.label.toLowerCase())}.</p>
  </div>
  <div class="card" style="margin-top:16px">
    <div class="ctitle">VARIATIONS</div>
    ${benchVars.map((v) => `<div class="lrow"><div><b>${esc(v.name)}</b><span>${esc(EQUIPMENT_LABELS[v.equipment])} · ${v.difficulty}</span></div>${ic('chevron', 16, C.textFaint)}</div>`).join('')}
  </div>
  <div class="card" style="margin-top:16px">
    <div class="ctitle">IF YOU CAN'T DO THIS ONE</div>
    <p class="note">Filtered to the equipment on your profile — change it in Profile to see more.</p>
    ${benchSubs.map((s) => `<div class="lrow"><div><b>${esc(s.exercise.name)}</b><span>${esc(s.reason)}</span></div>${ic('chevron', 16, C.textFaint)}</div>`).join('')}
  </div>`;

const libRows = EXERCISES.filter((e) => e.category === 'back' && e.mechanic === 'compound').slice(0, 7);
const libraryScreen = `
  <div class="libhead"><h1 class="title">Exercises</h1><span class="count">${libRows.length} of ${EXERCISES.length}</span></div>
  <div class="searchwrap">${ic('search', 17, C.textDim)}<span class="ph">Search exercise, muscle or equipment</span></div>
  <div class="chiprow">${['All', 'Chest', 'Back', 'Shoulders', 'Arms'].map((x) => `<span class="${x === 'Back' ? 'on' : ''}">${x}</span>`).join('')}</div>
  <div class="chiprow">${['Any Equipment', 'Barbell', 'Dumbbell', 'Machine'].map((x) => `<span class="${x === 'Any Equipment' ? 'on' : ''}">${x}</span>`).join('')}</div>
  <div class="morerow"><span style="color:${C.accent}">Fewer filters · 1</span><span style="color:${C.textDim}">Clear</span></div>
  <div class="chiprow">${['Any Difficulty', 'Beginner', 'Intermediate', 'Compound'].map((x) => `<span class="${x === 'Compound' ? 'on' : ''}">${x}</span>`).join('')}</div>
  <div class="chiprow">${['Any Movement', ...PATTERN_GROUPS.slice(0, 4).map((g) => g.label)].map((x) => `<span class="${x === 'Any Movement' ? 'on' : ''}">${x}</span>`).join('')}</div>
  ${libRows.map((e) => {
    const initials = e.name.split(' ').filter((w) => w.length > 2).slice(0, 2).map((w) => w[0]).join('').toUpperCase();
    return `<div class="exrow">
      <div class="thumb">${initials}</div>
      <div class="exbody"><b>${esc(e.name)}</b>
        <span>${e.primaryMuscles.map((m) => MUSCLE_LABELS[m]).join(' · ')}</span>
        <em>${esc(EQUIPMENT_LABELS[e.equipment])} • ${e.mechanic}</em></div>
    </div>`;
  }).join('')}`;

const offers = availableCards(sessions, { targetDaysPerWeek: 4, now: NOW });
const shareScreen = `
  <div class="modalhead">${ic('chevron', 18, C.accent, 1.9)}<span style="color:${C.accent}">Back</span><span class="mtitle">Share progress</span></div>
  <div style="display:flex;justify-content:center;margin-top:8px">${cardMarkup(offers[0].card, 250)}</div>
  <div class="chiprow" style="margin-top:16px">${['Record', 'Session', 'Week', 'Balance', 'Streak'].map((x) => `<span class="${x === 'Record' ? 'on' : ''}">${x}</span>`).join('')}</div>
  <p class="note" style="padding:0 20px">New record this week</p>
  <div class="fmtlabel">FORMAT</div>
  <div class="formats">
    ${(['Square', 'Portrait', 'Story'] as const).map((f) => `<div class="fmt${f === 'Portrait' ? ' on' : ''}"><b>${f}</b><span>${f === 'Square' ? 'Feed posts' : f === 'Portrait' ? 'Instagram feed' : 'Stories, Reels'}</span></div>`).join('')}
  </div>
  <button class="cta" style="margin:20px">Share</button>`;

const si = sampleInsight();
const onboardingScreen = `
  <div class="pips">${[0, 1, 2, 3].map((i) => `<i style="background:${i <= 2 ? C.bronze : C.border}"></i>`).join('')}</div>
  <h1 class="title" style="font-size:27px;line-height:1.25">What ATLAS will tell you</h1>
  <p class="note" style="margin-top:12px">After about three logged sessions, ATLAS starts reading your training. This is a real insight, built from example numbers — yours will be about your lifts.</p>
  <div class="extag">EXAMPLE</div>
  <div class="insight">
    <div class="itop"><i class="dot" style="background:${C.accent}"></i><span style="color:${C.accent}">ACTION</span><span class="grow"></span>${ic('chevron', 14, C.textFaint, 1.8)}</div>
    <h3>${esc(si.headline)}</h3><p>${esc(si.preview)}</p>
    <div class="ibody">
      <div class="metrics">${si.metrics.map((m) => `<div><b>${m.value}</b><span>${m.label}</span></div>`).join('')}</div>
      <p class="detail">${esc(si.detail[0])}</p>
      <p class="detail">${esc(si.detail[1])}</p>
      <div class="action"><div class="ak">DO THIS</div><p>${esc(si.action)}</p></div>
    </div>
  </div>
  <div class="fmtlabel">AND WHAT YOU CAN POST</div>
  <div style="display:flex;justify-content:center;margin-top:10px">${cardMarkup(sampleCard(), 190)}</div>`;

function themeMini(p: Palette): string {
  const W = 268, H = 88;
  const scale = [p.recoveryFresh, p.recoveryReady, p.recoveryModerate, p.recoveryFatigued, p.recoveryUntrained];
  return `<svg viewBox="0 0 ${W} ${H}" style="width:100%;display:block">
    <rect width="${W}" height="${H}" rx="8" fill="${p.bg}"/>
    <rect x="9" y="9" width="${W - 18}" height="${H - 18}" rx="7" fill="${p.card}" stroke="${p.border}"/>
    <rect x="20" y="21" width="70" height="7" rx="3.5" fill="${p.text}"/>
    <rect x="20" y="34" width="110" height="5" rx="2.5" fill="${p.textDim}"/>
    <rect x="20" y="45" width="52" height="5" rx="2.5" fill="${p.textFaint}"/>
    <rect x="20" y="60" width="38" height="11" rx="5.5" fill="${p.accent}"/>
    <rect x="64" y="60" width="29" height="11" rx="5.5" fill="${p.bronzeSoft}" stroke="${p.bronze}"/>
    ${scale.map((t, i) => `<circle cx="${162 + i * 17}" cy="29" r="6.5" fill="${t}"/>`).join('')}
    <polygon points="162,72 180,57 208,61 234,51 252,68" fill="none" stroke="${p.marbleLight}" stroke-width="1.6"/>
    <polygon points="162,78 180,66 208,70 234,62 252,76" fill="none" stroke="${p.bronze}" stroke-width="1" stroke-dasharray="3 3"/>
  </svg>`;
}

const themeScreen = `
  <div class="modalhead">${ic('chevron', 18, C.accent, 1.9)}<span style="color:${C.accent}">Back</span><span class="mtitle">Appearance</span></div>
  <p class="note" style="padding:0 20px">Four materials, one app. Colour means the same thing in all of them — accent for a muscle that needs work, bronze for one that is recovering or a set that is done.</p>
  ${THEME_ORDER.map((n) => {
    const p = PALETTES[n];
    const on = n === 'obsidian';
    return `<div class="themerow${on ? ' on' : ''}">
      <div class="th"><div><b>${p.label}</b><span>${p.blurb}</span></div>${on ? ic('check', 20, C.bronze, 2.2) : '<i class="radio"></i>'}</div>
      <div class="mini">${themeMini(p)}</div>
    </div>`;
  }).join('')}`;

const startQuote = quoteByTheme(['action', 'discipline'], Math.floor(NOW / 86_400_000) + 1);
const workoutScreen = `
  ${justUnlocked.length ? `<div class="unlockbanner">🏆<div><b>${justUnlocked.length === 1 ? 'Milestone unlocked' : `${justUnlocked.length} milestones unlocked`}</b><span>${justUnlocked.map((a) => esc(a.tier.label)).join(' · ')}</span></div></div>` : ''}
  <div class="emptystate">
    <h1 class="title" style="font-size:22px">Ready to train</h1>
    <p class="note" style="margin-top:6px">Start an empty session, or pick up one of your routines.</p>
  </div>
  <button class="cta" style="margin-top:16px">Start Empty Workout</button>
  <div class="sect"><span class="sect-t" style="font-size:12px;letter-spacing:1.1px;color:${C.textFaint}">YOUR ROUTINES</span></div>
  ${['Push', 'Pull', 'Legs', 'Upper'].map((n) => `<div class="lrow"><div><b>${n}</b><span>${PLAN.find((p) => p.name === n)!.lifts.length} exercises</span></div>${ic('chevron', 16, C.textFaint)}</div>`).join('')}
  <div class="quoteblock card" style="margin-top:20px">
    <i class="qrule"></i>
    <div><p>${esc(startQuote.text)}</p><span>${startQuote.author.toUpperCase()} · ${esc(startQuote.source)}</span></div>
  </div>`;

const CATEGORY_ORDER: AchievementCategory[] = ['sessions', 'volume', 'streak', 'records', 'exercises'];
const achievementsScreen = `
  <div class="modalhead">${ic('chevron', 18, C.accent, 1.9)}<span style="color:${C.accent}">Back</span><span class="mtitle">Achievements</span></div>
  <div class="card">
    <div class="achv-total">${achievements.unlockedCount} <small>of ${achievements.totalCount}</small></div>
    <p class="note">Milestones unlocked</p>
    <div class="achv-track"><i style="width:${Math.round((achievements.unlockedCount / achievements.totalCount) * 100)}%"></i></div>
  </div>
  <div class="sect"><span class="sect-t" style="font-size:12px;letter-spacing:1.1px;color:${C.textFaint}">CLOSEST TO UNLOCKING</span></div>
  <div class="card" style="padding:0">
    ${achievements.nextUp.slice(0, 3).map((n) => `<div class="lrow"><div><b>${esc(n.tier.label)}</b><span>${esc(n.tier.detail)}</span></div><b style="color:${C.bronze};font-size:13px">${n.pct}%</b></div>`).join('')}
  </div>
  ${CATEGORY_ORDER.slice(0, 2).map((cat) => `
    <div class="sect"><span class="sect-t" style="font-size:12px;letter-spacing:1.1px;color:${C.textFaint}">${CATEGORY_LABELS[cat].toUpperCase()}</span></div>
    <div class="card" style="padding:0">
      ${achievements.byCategory[cat].map((a) => `<div class="lrow achv-row${a.unlocked ? '' : ' locked'}">
        <div class="achv-badge${a.unlocked ? ' on' : ''}">${a.unlocked ? ic('check', 13, C.bronze, 2.4) : '·'}</div>
        <div><b>${esc(a.tier.label)}</b><span>${esc(a.tier.detail)}${a.achievedAt ? ' · ' + new Date(a.achievedAt).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' }) : ''}</span></div>
      </div>`).join('')}
    </div>`).join('')}`;

/* ------------------------------------------------------------------ */

const html = `<title>ATLAS — The App</title>
<style>
  :root{
    --bg:${C.bg}; --elev:${C.bgElevated}; --card:${C.card}; --alt:${C.cardAlt};
    --line:${C.border}; --lineS:${C.borderStrong}; --ink:${C.text}; --sec:${C.textSecondary};
    --dim:${C.textDim}; --faint:${C.textFaint}; --accent:${C.accent}; --bronze:${C.bronze};
    --onAccent:${C.onAccent};
  }
  *{box-sizing:border-box}
  body{margin:0;background:#08080A;color:var(--ink);
    font-family:-apple-system,BlinkMacSystemFont,"SF Pro Text","Segoe UI",system-ui,sans-serif}
  .page{max-width:1500px;margin:0 auto;padding:46px 28px 90px}
  h1.wm{font-size:30px;font-weight:700;letter-spacing:7px;margin:0}
  h1.wm b{color:var(--bronze)}
  .lede{color:var(--dim);font-size:14.5px;line-height:1.7;margin:16px 0 0;max-width:78ch}
  .grid{display:flex;flex-wrap:wrap;gap:40px 34px;margin-top:44px;align-items:flex-start}
  .slot{margin:0;width:393px}
  figcaption{margin-top:14px;font-size:13px;color:var(--dim);line-height:1.6}
  figcaption b{color:var(--ink);font-size:14px}
  figcaption span{color:var(--faint);font-size:12px}

  .phone{width:393px;height:852px;background:var(--bg);border-radius:52px;
    border:1px solid var(--lineS);box-shadow:0 0 0 9px #16151a,0 34px 70px rgba(0,0,0,.62);
    position:relative;overflow:hidden}
  .island{position:absolute;top:11px;left:50%;transform:translateX(-50%);width:122px;height:35px;
    background:#000;border-radius:20px;z-index:30}
  .statusbar{position:absolute;top:0;left:0;right:0;height:56px;display:flex;align-items:center;
    justify-content:space-between;padding:16px 30px 0;font-size:14px;font-weight:600;z-index:20;
    background:linear-gradient(var(--bg) 0 46px,transparent 56px)}
  .statusbar .glyphs{display:flex;gap:5px;align-items:center}
  .statusbar i{width:3px;background:var(--ink);border-radius:1px;display:block}
  .screen{position:absolute;inset:0;padding:60px 20px 96px;overflow:hidden}
  .tabbar{position:absolute;left:0;right:0;bottom:0;height:84px;background:var(--elev);
    border-top:1px solid var(--line);display:flex;padding-top:10px;z-index:20}
  .tab{flex:1;display:flex;flex-direction:column;align-items:center;gap:4px;font-size:10.5px;
    font-weight:600;color:var(--faint)}
  .tab.on{color:var(--accent)}
  .home-indicator{position:absolute;bottom:9px;left:50%;transform:translateX(-50%);width:138px;
    height:5px;border-radius:3px;background:#3A3833;z-index:25}

  .greetrow{display:flex;align-items:flex-start;justify-content:space-between;gap:12px}
  .streakchip{display:flex;align-items:center;gap:5px;background:${C.bronzeSoft};border:1px solid rgba(192,138,62,.35);
    border-radius:99px;padding:7px 12px;font-size:13px;font-weight:700;color:${C.bronze};margin-top:2px}
  .streakchip.risk{background:rgba(180,71,47,.14);border-color:rgba(180,71,47,.4);color:${C.accent}}
  .quoteblock{display:flex;gap:10px;align-items:stretch}
  .quoteblock.card{padding:16px}
  .quoteblock .qrule{width:2px;border-radius:1px;background:${C.bronze};align-self:stretch;display:block}
  .quoteblock p{font-size:14px;font-style:italic;color:var(--sec);line-height:1.5;margin:0}
  .quoteblock span{display:block;font-size:10px;font-weight:700;letter-spacing:1.1px;color:${C.bronze};margin-top:7px}
  .unlockbanner{display:flex;align-items:center;gap:12px;background:${C.bronzeSoft};border:1px solid rgba(192,138,62,.4);
    border-radius:16px;padding:15px;font-size:19px;margin-bottom:16px}
  .unlockbanner b{display:block;font-size:14.5px;font-weight:600;color:var(--ink)}
  .unlockbanner span{display:block;font-size:12.5px;color:${C.bronze};margin-top:2px}
  .emptystate{text-align:center;padding:26px 8px 6px}
  .achv-total{font-size:30px;font-weight:700}
  .achv-total small{font-size:17px;font-weight:400;color:var(--dim)}
  .achv-track{height:6px;border-radius:3px;background:var(--alt);overflow:hidden;margin-top:10px}
  .achv-track i{display:block;height:100%;border-radius:3px;background:${C.bronze}}
  .achv-row{gap:12px}
  .lrow .achv-badge{flex:0 0 auto;width:24px;height:24px;border-radius:12px;border:1px solid var(--line);
    background:var(--alt);display:flex;align-items:center;justify-content:center;font-size:11px;color:var(--faint)}
  .lrow .achv-badge.on{background:${C.bronzeSoft};border-color:${C.bronze}}
  .achv-row.locked b{color:var(--dim)}
  .greeting{font-size:30px;font-weight:700;letter-spacing:-.6px;margin:0}
  .title{font-size:32px;font-weight:700;letter-spacing:-.6px;margin:0}
  .sub{color:var(--dim);font-size:14px;margin:6px 0 0;line-height:1.45}
  .card{background:var(--card);border:1px solid var(--line);border-radius:16px;padding:16px}
  .row3{display:flex}
  .stat{flex:1}
  .stat .v{font-size:26px;font-weight:700;letter-spacing:-.5px;font-variant-numeric:tabular-nums}
  .stat .v small{font-size:13px;color:var(--dim);font-weight:500;margin-left:3px}
  .stat .l{font-size:13px;color:var(--dim);margin-top:2px}
  .cta{display:flex;align-items:center;justify-content:center;gap:6px;width:100%;background:var(--accent);
    color:var(--onAccent);border:0;border-radius:12px;padding:15px;font:inherit;font-size:15px;font-weight:700}
  .libraryRow{display:flex;align-items:center;gap:10px;margin-top:12px;padding:13px 16px;
    background:var(--card);border:1px solid var(--line);border-radius:16px;font-size:14px;font-weight:500}
  .libraryRow span{flex:1;color:var(--sec)}
  .sect{display:flex;align-items:center;justify-content:space-between;margin:24px 0 12px}
  .sect-t{font-size:16px;font-weight:600;letter-spacing:-.2px}
  .bodies{display:flex;justify-content:center;gap:12px}
  .bodycol{text-align:center}
  .blabel{font-size:10px;font-weight:700;letter-spacing:1.1px;color:var(--faint);margin-top:6px}
  .legend{display:flex;justify-content:center;gap:12px;margin-top:14px;flex-wrap:wrap}
  .lg{display:flex;align-items:center;gap:5px;font-size:11px;color:var(--dim)}
  .lg i{width:8px;height:8px;border-radius:4px;display:block}
  .mrow{display:flex;align-items:center;gap:10px;padding:7px 0;font-size:13px}
  .mrow span:first-child{width:78px;color:var(--ink)}
  .mrow .bar{flex:1;height:6px;border-radius:3px;background:var(--alt);overflow:hidden;display:block}
  .mrow .bar i{display:block;height:100%;border-radius:3px}
  .mrow b{width:36px;text-align:right;font-size:12.5px;font-variant-numeric:tabular-nums}

  .range{display:flex;background:var(--alt);border:1px solid var(--line);border-radius:99px;padding:3px;margin-top:16px}
  .range span{flex:1;text-align:center;padding:7px 0;border-radius:99px;font-size:13px;font-weight:600;color:var(--dim)}
  .range span.on{background:${C.cardPressed};color:var(--ink)}
  .headline{background:var(--card);border:1px solid rgba(192,138,62,.32);border-radius:16px;padding:16px}
  .kicker{display:flex;align-items:center;gap:7px;font-size:10px;font-weight:700;letter-spacing:1.1px;color:var(--bronze)}
  .praise{font-size:19px;font-weight:600;line-height:1.32;margin-top:12px}
  .tease{font-size:15px;color:var(--sec);line-height:1.4;margin-top:6px}
  .insight{background:var(--card);border:1px solid var(--line);border-radius:16px;padding:16px;margin-top:8px}
  .itop{display:flex;align-items:center;gap:7px;margin-bottom:10px;font-size:10px;font-weight:700;letter-spacing:1.1px}
  .itop .dot{width:6px;height:6px;border-radius:3px;display:block}
  .itop .grow{flex:1}
  .insight h3{font-size:16px;font-weight:600;margin:0;line-height:1.35}
  .insight p{font-size:13px;color:var(--dim);margin:5px 0 0;line-height:1.45}
  .lockfoot{display:flex;align-items:center;gap:8px;margin-top:12px;padding-top:12px;border-top:1px solid var(--line)}
  .lockfoot span{flex:1;font-size:13px;color:var(--faint)}
  .lockfoot b{background:${C.bronzeSoft};color:var(--bronze);border-radius:8px;padding:2px 6px;font-size:9px;letter-spacing:1.1px}
  .note{font-size:13px;color:var(--dim);line-height:1.46;margin:0}
  .scorerow{display:flex;align-items:center;gap:12px;margin-top:12px}
  .scorerow .n{font-size:34px;font-weight:700;letter-spacing:-.9px;min-width:56px}
  .scorerow .lbl{font-size:11px;font-weight:700;letter-spacing:1.1px;color:var(--dim)}
  .scorerow .hint{font-size:13px;color:var(--faint);margin-top:2px}

  .modalhead{display:flex;align-items:center;gap:2px;font-size:15px;font-weight:600;margin-bottom:14px}
  .modalhead .mtitle{flex:1;text-align:center;color:var(--ink);font-size:16px;margin-right:56px}
  .chips{display:flex;gap:7px;flex-wrap:wrap;margin-top:12px}
  .chips span{font-size:12px;color:var(--sec);background:var(--alt);border:1px solid var(--line);
    border-radius:99px;padding:5px 11px;text-transform:capitalize}
  .chips .pat{color:var(--bronze);border-color:rgba(192,138,62,.4)}
  .ctitle{font-size:11px;font-weight:700;letter-spacing:1.1px;color:var(--dim);margin-bottom:6px}
  .mistake{display:flex;gap:11px;margin-top:12px}
  .mistake i{flex:0 0 auto;width:18px;height:18px;border-radius:9px;margin-top:2px;background:${C.accentSoft};
    color:var(--accent);font-size:10px;font-weight:700;display:flex;align-items:center;justify-content:center;font-style:normal}
  .mistake p{margin:0;font-size:13px;color:var(--sec);line-height:1.55}
  .mistake.spec i{background:${C.bronzeSoft};color:var(--bronze)}
  .mistake.spec p{color:var(--ink)}
  .mnote{font-size:11.5px;color:var(--faint);margin:14px 0 0;line-height:1.5}
  .lrow{display:flex;align-items:center;gap:12px;padding:10px 0;border-bottom:1px solid var(--line)}
  .lrow div{flex:1}
  .lrow b{display:block;font-size:14.5px;font-weight:600}
  .lrow span{display:block;font-size:12.5px;color:var(--faint);margin-top:2px}

  .libhead{display:flex;align-items:baseline;justify-content:space-between}
  .count{font-size:13px;color:var(--dim)}
  .searchwrap{display:flex;align-items:center;gap:8px;margin-top:12px;padding:11px 12px;
    background:var(--alt);border-radius:12px}
  .searchwrap .ph{color:var(--faint);font-size:15px}
  .chiprow{display:flex;gap:8px;margin-top:12px;overflow:hidden}
  .chiprow span{flex:0 0 auto;font-size:12.5px;color:var(--sec);background:var(--alt);
    border:1px solid var(--line);border-radius:99px;padding:6px 12px}
  .chiprow span.on{background:var(--accent);border-color:var(--accent);color:var(--onAccent);font-weight:700}
  .morerow{display:flex;justify-content:space-between;margin-top:14px;font-size:13px;font-weight:600}
  .exrow{display:flex;align-items:center;gap:12px;padding:12px 0;border-bottom:1px solid var(--line)}
  .thumb{width:46px;height:46px;border-radius:12px;background:rgba(122,110,94,.13);
    border:1px solid rgba(122,110,94,.35);display:flex;align-items:center;justify-content:center;
    font-size:14px;font-weight:800;color:#7A6E5E}
  .exbody{flex:1;min-width:0}
  .exbody b{display:block;font-size:15px;font-weight:600}
  .exbody span{display:block;font-size:12.5px;color:var(--sec);margin-top:2px}
  .exbody em{display:block;font-size:12px;color:var(--faint);font-style:normal;margin-top:3px;text-transform:capitalize}

  .sharecard{position:relative;border-radius:22px;overflow:hidden;flex:0 0 auto}
  .sharecard .bg{position:absolute;inset:0;width:100%;height:100%}
  .cframe{position:absolute;inset:0;border:1px solid rgba(240,238,233,.14)}
  .ccontent{position:absolute;inset:0;display:flex;flex-direction:column}
  .chead{display:flex;justify-content:space-between;align-items:baseline}
  .csample{position:absolute;top:14%;right:9%;font-size:9px;font-weight:700;letter-spacing:1.6px;
    color:var(--bronze);border:1px solid rgba(192,138,62,.5);border-radius:5px;padding:3px 6px}
  .fmtlabel{font-size:11px;font-weight:700;letter-spacing:1.1px;color:var(--dim);margin:20px 20px 10px}
  .formats{display:flex;gap:8px;padding:0 20px}
  .fmt{flex:1;padding:12px;border-radius:12px;background:var(--card);border:1px solid var(--line)}
  .fmt.on{border-color:var(--bronze);background:var(--alt)}
  .fmt b{display:block;font-size:13px;font-weight:700;color:var(--sec)}
  .fmt.on b{color:var(--ink)}
  .fmt span{display:block;font-size:11px;color:var(--faint);margin-top:2px}

  .pips{display:flex;gap:6px;margin-bottom:18px}
  .pips i{flex:1;height:3px;border-radius:2px;display:block}
  .extag{display:inline-block;border:1px solid var(--bronze);border-radius:8px;padding:2px 7px;
    font-size:9px;font-weight:700;letter-spacing:1.1px;color:var(--bronze);margin:18px 0 8px}
  .ibody{margin-top:16px;display:flex;flex-direction:column;gap:12px}
  .metrics{display:flex;gap:16px;padding-bottom:12px;border-bottom:1px solid var(--line)}
  .metrics div{min-width:60px}
  .metrics b{display:block;font-size:16px;font-weight:600}
  .metrics span{display:block;font-size:11px;color:var(--faint);margin-top:1px}
  .detail{font-size:14px;color:var(--sec);line-height:1.55;margin:0}
  .action{background:var(--alt);border-radius:12px;padding:12px;border-left:2px solid var(--bronze)}
  .ak{font-size:10px;font-weight:700;letter-spacing:1.1px;color:var(--bronze)}
  .action p{font-size:14px;color:var(--ink);margin:5px 0 0;line-height:1.5}

  .themerow{background:var(--card);border:1px solid var(--line);border-radius:16px;padding:16px;margin:12px 20px 0}
  .themerow.on{border-color:var(--bronze)}
  .th{display:flex;align-items:center;gap:12px}
  .th div{flex:1}
  .th b{display:block;font-size:16px;font-weight:600}
  .th span{display:block;font-size:13px;color:var(--dim);margin-top:3px}
  .radio{width:20px;height:20px;border-radius:10px;border:1.5px solid var(--lineS);display:block}
  .mini{margin-top:12px;border-radius:8px;overflow:hidden}
</style>
<div class="page">
  <h1 class="wm">ATL<b>A</b>S</h1>
  <p class="lede">
    The app as it stands, in Obsidian. Every screen is rendered from the real modules — the recovery
    figure uses the app's own anatomy paths and deltoid split, the insights come out of the insight
    engine, the balance polygon out of the radar geometry, the exercise coaching out of the movement
    pattern taxonomy, today's quote out of the 52-quote Stoic library, and the streak and milestones
    out of the same achievement engine that ships in the app. The training history behind it is 24
    weeks of four-day push/pull/legs/upper with a deliberately stalled squat and no calf work, so
    what ATLAS says about it is what ATLAS worked out.
  </p>
  <div class="grid">
    ${phone('Home', `Recovery map from the fatigue model, today's Stoic quote, and a ${streak.weekStreak}-week streak chip.`, homeScreen, { tab: 'Home' })}
    ${phone('Progress', 'The insight engine reading real logs, then the balance polygon.', progressScreen, { tab: 'Progress' })}
    ${phone('Exercise detail', 'Mistakes from the movement pattern, variations and substitutions scored from the data.', detailScreen)}
    ${phone('Exercise library', `All ${EXERCISES.length}, with the second filter row open.`, libraryScreen)}
    ${phone('Workout — empty', 'The milestone-unlocked banner firing on the session that actually crossed a tier, plus a start-training quote.', workoutScreen, { tab: 'Workout' })}
    ${phone('Achievements', `${achievements.unlockedCount} of ${achievements.totalCount} milestones, derived from the same logs — no stored badge list.`, achievementsScreen)}
    ${phone('Share progress', 'Procedural marble backdrop — the Met photograph drops into the same slot.', shareScreen)}
    ${phone('Onboarding — proof', 'A complete real insight on example numbers, badged, before anyone is asked to pay.', onboardingScreen)}
    ${phone('Appearance', 'Each row previews its own palette on the surfaces that encode meaning.', themeScreen)}
  </div>
</div>`;

const out = path.resolve(process.cwd(), '../preview/atlas-app.html');
fs.writeFileSync(out, html);
console.log(`Wrote ${out} (${(fs.statSync(out).size / 1024).toFixed(0)} KB)`);
console.log(`artwork images present: ${artworkImage('wreath') ? 'yes' : 'no — procedural marble'}`);
