/**
 * Renders the new Friends & Groups screens as phone frames in a browser.
 *
 * There's no live Supabase project behind this preview, so the "friend" and
 * "group" numbers are invented — clearly marked as example data, the same
 * way onboardingScreen in preview-app.ts marks its sample insight. Colours,
 * type scale and phone chrome are the real Obsidian tokens; exercise names
 * come from the real exercise library.
 *
 *   npx tsx tools/preview-social.ts
 */
import fs from 'node:fs';
import path from 'node:path';

import { PALETTES, Palette } from '../src/theme/palettes';
import { getExerciseById } from '../src/data/exercises';

const C: Palette = PALETTES.obsidian;
const esc = (s: string) => String(s).replace(/[&<>]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;' }[c]!));

/* ------------------------------------------------------------------ */
/* Icons — same single-path "Classical Line" set as the app             */
/* ------------------------------------------------------------------ */

const ICON = {
  chevron: 'M9,5 L16,12 L9,19',
  check: 'M5,12.5 L9.5,17 L19,7',
  close: 'M6,6 L18,18 M18,6 L6,18',
  friends:
    'M9,4.2 C10.7,4.2 12.1,5.6 12.1,7.3 C12.1,9 10.7,10.4 9,10.4 C7.3,10.4 5.9,9 5.9,7.3 C5.9,5.6 7.3,4.2 9,4.2 Z ' +
    'M2.5,19.5 C2.5,15.9 5.4,13.4 9,13.4 C12.6,13.4 15.5,15.9 15.5,19.5 ' +
    'M15.5,5 C16.9,5.3 18,6.6 18,8.1 C18,9.6 16.9,10.9 15.5,11.2 ' +
    'M17,13.7 C19.6,14.3 21.5,16.5 21.5,19.5',
};
const ic = (n: keyof typeof ICON, size: number, color: string, sw = 1.6) =>
  `<svg width="${size}" height="${size}" viewBox="0 0 24 24" fill="none" stroke="${color}" stroke-width="${sw}" stroke-linecap="round" stroke-linejoin="round"><path d="${ICON[n]}"/></svg>`;

function phone(title: string, note: string, body: string): string {
  return `<figure class="slot">
    <div class="phone">
      <div class="island"></div>
      <div class="statusbar"><span>9:41</span><span class="glyphs">
        <i style="height:5px"></i><i style="height:8px"></i><i style="height:11px"></i><i style="height:14px"></i>
        <svg width="26" height="13" viewBox="0 0 26 13" style="margin-left:5px"><rect x=".5" y=".5" width="21" height="12" rx="3.5" fill="none" stroke="${C.text}" opacity=".45"/><rect x="2" y="2" width="18" height="9" rx="2" fill="${C.text}"/><path d="M23.5 4.5v4a2.2 2.2 0 0 0 0-4z" fill="${C.text}" opacity=".45"/></svg>
      </span></div>
      <main class="screen">${body}</main>
      <div class="home-indicator"></div>
    </div>
    <figcaption><b>${esc(title)}</b><br><span>${note}</span></figcaption>
  </figure>`;
}

function modalHead(title: string, right?: string): string {
  return `<div class="modalhead">${ic('chevron', 18, C.accent, 1.9)}<span style="color:${C.accent}">Back</span><span class="mtitle">${esc(title)}</span><span class="mright">${right ?? ''}</span></div>`;
}

function avatar(emoji: string, size = 44): string {
  return `<div class="avatar" style="width:${size}px;height:${size}px;border-radius:${size / 2}px;font-size:${size * 0.48}px">${emoji}</div>`;
}

/* ------------------------------------------------------------------ */
/* Example data — clearly marked as such, not a real account            */
/* ------------------------------------------------------------------ */

const bench = getExerciseById('barbell_bench_press')!;
const squat = getExerciseById('back_squat')!;

type Compare = { exercise: string; mine: [number, number, number]; theirs: [number, number, number] };
// [e1RM, heaviest weight, best set volume] in kg — only two exercises here so
// both cards sit fully inside the static phone frame; a third would need to
// scroll, same as the real screen would, but this mockup doesn't simulate that
const COMPARE: Compare[] = [
  { exercise: bench.name, mine: [118, 110, 1650], theirs: [112, 108, 1720] },
  { exercise: squat.name, mine: [152, 145, 2100], theirs: [140, 135, 1980] },
];
const winsMe = COMPARE.filter((c) => c.mine[0] > c.theirs[0]).length;
const winsThem = COMPARE.filter((c) => c.theirs[0] > c.mine[0]).length;
const badge = winsMe > winsThem ? 'STRONGER' : winsThem > winsMe ? 'WEAKER' : 'EVEN';
const badgeColor = badge === 'STRONGER' ? C.success : badge === 'WEAKER' ? C.danger : C.textDim;

type Member = { name: string; emoji: string; volume: number; streak: number; me?: boolean };
const MEMBERS: Member[] = [
  { name: 'nacho_baracho', emoji: '💪', volume: 52900, streak: 9 },
  { name: 'you', emoji: '🏋️', volume: 48200, streak: 6, me: true },
  { name: 'lifts_with_lily', emoji: '🦾', volume: 39750, streak: 4 },
  { name: 'quiet_gains', emoji: '🧘', volume: 31200, streak: 12 },
  { name: 'benchpress_ben', emoji: '🐻', volume: 28600, streak: 2 },
].sort((a, b) => b.volume - a.volume);

const FRIENDS = [
  { name: 'nacho_baracho', emoji: '💪' },
  { name: 'lifts_with_lily', emoji: '🦾' },
  { name: 'quiet_gains', emoji: '🧘' },
];
const INCOMING = { name: 'benchpress_ben', emoji: '🐻' };

function fmtKg(n: number): string {
  return `${n.toLocaleString('en-GB')}kg`;
}

/* ------------------------------------------------------------------ */
/* Screens                                                             */
/* ------------------------------------------------------------------ */

const authScreen = `
  <div class="authcenter">
    <div class="iconcircle">${ic('friends', 30, C.accent, 1.6)}</div>
    <p class="tagline">Add friends, build a group, and compare lifts on a shared leaderboard.</p>
    <div class="fieldlabel">EMAIL</div>
    <div class="fakeinput">you@example.com</div>
    <div class="fieldlabel" style="margin-top:14px">PASSWORD</div>
    <div class="fakeinput">••••••••</div>
    <button class="cta" style="margin-top:22px">Create Account</button>
    <div class="ghostlink">Already have an account? Sign in</div>
  </div>`;

const friendsScreen = `
  ${modalHead('Friends & Groups', '<span class="signout">Sign Out</span>')}
  <div class="merow">${avatar('🏋️', 36)}<span class="mename">@you</span></div>
  <div class="segmented"><span class="seg on">Friends</span><span class="seg">Groups</span></div>

  <div class="sect"><span class="sect-t sm">Add a friend</span></div>
  <div class="addrow"><div class="fakeinput grow">username</div><span class="minibtn">Add</span></div>

  <div class="sect"><span class="sect-t sm">Requests</span></div>
  <div class="card" style="padding:0">
    <div class="lrow social">
      ${avatar(INCOMING.emoji, 40)}
      <div class="grow"><b>@${INCOMING.name}</b></div>
      <span class="iconbtn ok">${ic('check', 18, C.success, 2.2)}</span>
      <span class="iconbtn no">${ic('close', 18, C.danger, 2.2)}</span>
    </div>
  </div>

  <div class="sect"><span class="sect-t sm">Friends (${FRIENDS.length})</span></div>
  <div class="card" style="padding:0">
    ${FRIENDS.map(
      (f, i) => `<div class="lrow social${i > 0 ? ' bt' : ''}">
        ${avatar(f.emoji, 40)}
        <div class="grow"><b>@${f.name}</b></div>
        ${ic('chevron', 16, C.textFaint)}
      </div>`
    ).join('')}
  </div>`;

const groupScreen = `
  ${modalHead('Gym Bros')}
  <div class="card codecard">
    <div class="codelabel">INVITE CODE</div>
    <div class="code">K7QX2M</div>
    <p class="note center" style="margin-top:8px">Share this with a friend so they can join from Groups → Join with a code.</p>
  </div>

  <div class="sortrow">
    <span class="sect-t sm">Leaderboard</span>
    <div class="segmented sm"><span class="seg on">Volume</span><span class="seg">Streak</span></div>
  </div>
  <div class="card" style="padding:0">
    ${MEMBERS.map((m, i) => {
      const rankStyle = i === 0 ? `color:${C.gold}` : '';
      return `<div class="lrow social${i > 0 ? ' bt' : ''}">
        <span class="ranknum" style="${rankStyle}">${i + 1}</span>
        ${avatar(m.emoji, 32)}
        <div class="grow"><b>@${m.name}${m.me ? '<span class="youtag"> (you)</span>' : ''}</b></div>
        <b class="rowvalue">${fmtKg(m.volume)}</b>
      </div>`;
    }).join('')}
  </div>`;

function metricRow(label: string, mine: number, theirs: number): string {
  const max = Math.max(mine, theirs, 1);
  const pct = theirs > 0 ? Math.round(((mine - theirs) / theirs) * 100) : 0;
  const ahead = pct > 0;
  const arrowColor = ahead ? C.success : C.danger;
  return `<div class="metric">
    <div class="metrichead"><span class="metriclabel">${label}</span>${
      pct !== 0 ? `<span class="pcttag" style="color:${arrowColor}">${ahead ? '↑' : '↓'} ${Math.abs(pct)}%</span>` : ''
    }</div>
    <div class="barrow"><span class="bartrack"><i style="width:${(mine / max) * 100}%;background:${C.accent}"></i></span><span class="barval">${fmtKg(mine)}</span></div>
    <div class="barrow"><span class="bartrack"><i style="width:${(theirs / max) * 100}%;background:${C.textFaint}"></i></span><span class="barval">${fmtKg(theirs)}</span></div>
  </div>`;
}

const compareScreen = `
  ${modalHead('Compare')}
  <div class="comparehead">
    <div class="comparecol">${avatar('🏋️', 64)}<span class="comparename">You</span></div>
    <span class="vslabel">VS</span>
    <div class="comparecol">${avatar('💪', 64)}<span class="comparename">@nacho_baracho</span></div>
  </div>
  <div class="badgepill" style="background:${badgeColor}22;border-color:${badgeColor}55;color:${badgeColor}">${badge}</div>
  ${COMPARE.map(
    (c) => `<div class="card exercisecard">
      <div class="exname">${esc(c.exercise)}</div>
      ${metricRow('One Rep Max', c.mine[0], c.theirs[0])}
      ${metricRow('Heaviest Weight', c.mine[1], c.theirs[1])}
      ${metricRow('Best Set (Volume)', c.mine[2], c.theirs[2])}
    </div>`
  ).join('')}`;

/* ------------------------------------------------------------------ */

const html = `<title>ATLAS — Friends & Groups</title>
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
  .page{max-width:1300px;margin:0 auto;padding:46px 28px 90px}
  h1.wm{font-size:30px;font-weight:700;letter-spacing:7px;margin:0}
  h1.wm b{color:var(--bronze)}
  .lede{color:var(--dim);font-size:14.5px;line-height:1.7;margin:16px 0 0;max-width:78ch}
  .tag{display:inline-block;border:1px solid var(--bronze);border-radius:8px;padding:2px 7px;
    font-size:9px;font-weight:700;letter-spacing:1.1px;color:var(--bronze);margin-top:14px}
  .grid{display:flex;flex-wrap:wrap;gap:40px 34px;margin-top:30px;align-items:flex-start}
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
  .screen{position:absolute;inset:0;padding:60px 20px 40px;overflow:hidden}
  .home-indicator{position:absolute;bottom:9px;left:50%;transform:translateX(-50%);width:138px;
    height:5px;border-radius:3px;background:#3A3833;z-index:25}

  .modalhead{display:flex;align-items:center;gap:2px;font-size:15px;font-weight:600;margin-bottom:16px}
  .modalhead .mtitle{flex:1;text-align:center;color:var(--ink);font-size:16px}
  .modalhead .mright{min-width:56px;text-align:right}
  .signout{color:${C.danger};font-size:13px;font-weight:600}

  .card{background:var(--card);border:1px solid var(--line);border-radius:16px;padding:16px}
  .sect{display:flex;align-items:center;justify-content:space-between;margin:20px 0 10px}
  .sect-t{font-size:16px;font-weight:600;letter-spacing:-.2px}
  .sect-t.sm{font-size:14px}
  .note{font-size:13px;color:var(--dim);line-height:1.46;margin:0}
  .note.center{text-align:center}
  .cta{display:flex;align-items:center;justify-content:center;gap:6px;width:100%;background:var(--accent);
    color:var(--onAccent);border:0;border-radius:12px;padding:15px;font:inherit;font-size:15px;font-weight:700}

  .avatar{background:var(--alt);border:1px solid var(--line);display:flex;align-items:center;
    justify-content:center;flex:0 0 auto}
  .merow{display:flex;align-items:center;gap:10px;margin-bottom:16px}
  .mename{font-size:17px;font-weight:600}

  .segmented{display:flex;background:var(--alt);border:1px solid var(--line);border-radius:12px;
    padding:3px;margin-bottom:6px}
  .segmented.sm{width:150px}
  .seg{flex:1;padding:9px 0;border-radius:9px;text-align:center;font-size:14px;font-weight:600;color:var(--dim)}
  .segmented.sm .seg{padding:6px 0;font-size:12px}
  .seg.on{background:var(--accent);color:var(--onAccent)}

  .fieldlabel{font-size:11px;font-weight:700;letter-spacing:1.1px;color:var(--faint);margin-bottom:8px}
  .fakeinput{background:var(--alt);border:1px solid var(--line);border-radius:12px;color:var(--faint);
    padding:14px 16px;font-size:15px}
  .fakeinput.grow{flex:1;padding:13px 16px}
  .authcenter{padding:40px 4px 0}
  .iconcircle{width:64px;height:64px;border-radius:32px;background:var(--alt);border:1px solid var(--line);
    display:flex;align-items:center;justify-content:center;margin:0 auto 16px}
  .tagline{font-size:15px;color:var(--sec);text-align:center;line-height:1.4;margin:0 0 24px}
  .ghostlink{text-align:center;color:var(--accent);font-size:14px;font-weight:600;margin-top:14px}

  .addrow{display:flex;gap:8px;align-items:center;margin-bottom:8px}
  .minibtn{background:var(--accent);color:var(--onAccent);border-radius:12px;padding:13px 20px;
    font-size:14px;font-weight:700;flex:0 0 auto}
  .grow{flex:1;min-width:0}

  .lrow.social{display:flex;align-items:center;gap:12px;padding:12px 16px}
  .lrow.social.bt{border-top:1px solid var(--line)}
  .lrow.social b{font-size:14.5px;font-weight:600}
  .iconbtn{width:32px;height:32px;border-radius:16px;background:var(--alt);display:flex;
    align-items:center;justify-content:center;flex:0 0 auto}

  .codecard{align-items:center;text-align:center;margin-bottom:20px}
  .codelabel{font-size:11px;font-weight:700;letter-spacing:1.1px;color:var(--faint)}
  .code{font-size:26px;font-weight:700;letter-spacing:4px;color:var(--accent);margin-top:4px}
  .sortrow{display:flex;align-items:center;justify-content:space-between;margin:6px 0 10px}
  .ranknum{width:20px;text-align:center;font-size:15px;font-weight:600;color:var(--faint);flex:0 0 auto}
  .youtag{color:var(--dim);font-weight:400}
  .rowvalue{font-size:14.5px;font-weight:600;font-variant-numeric:tabular-nums}

  .comparehead{display:flex;align-items:center;justify-content:center;gap:26px;margin-bottom:12px}
  .comparecol{display:flex;flex-direction:column;align-items:center;gap:6px}
  .comparename{font-size:14.5px;font-weight:600}
  .vslabel{font-size:12px;font-weight:700;color:var(--faint);letter-spacing:.5px}
  .badgepill{align-self:center;margin:0 auto 20px;display:block;width:max-content;padding:6px 20px;
    border-radius:99px;border:1px solid;font-size:11px;font-weight:800;letter-spacing:1.1px}
  .exercisecard{margin-bottom:12px}
  .exname{font-size:16px;font-weight:600;margin-bottom:10px}
  .metric{margin-top:8px}
  .metrichead{display:flex;justify-content:space-between;margin-bottom:5px}
  .metriclabel{font-size:13px;color:var(--dim);font-weight:600}
  .pcttag{font-size:13px;font-weight:700}
  .barrow{display:flex;align-items:center;gap:8px;margin-bottom:4px}
  .bartrack{flex:1;height:8px;border-radius:4px;background:var(--alt);overflow:hidden;display:block}
  .bartrack i{display:block;height:100%;border-radius:4px}
  .barval{font-size:12.5px;color:var(--sec);width:62px;text-align:right;font-variant-numeric:tabular-nums}
</style>
<div class="page">
  <h1 class="wm">ATL<b>A</b>S</h1>
  <p class="lede">
    Friends &amp; Groups — accounts, friend requests, groups and shared leaderboards, all optional
    and gated behind Profile → Friends &amp; Groups. Colours and chrome are the real Obsidian
    tokens and every layout is the actual screen code; the friend, group and leaderboard names
    below are invented so the screens have something to show — there's no real Supabase project
    behind this preview.
  </p>
  <span class="tag">EXAMPLE DATA</span>
  <div class="grid">
    ${phone('Sign in', 'Entirely separate from the rest of ATLAS — skipping it leaves a fully working solo log.', authScreen)}
    ${phone('Friends', 'Add by username, accept a request, or open Compare from the list.', friendsScreen)}
    ${phone('Group leaderboard', 'Ranked by total volume or current streak — an invite code to bring people in.', groupScreen)}
    ${phone(
      'Compare',
      `${winsMe} of ${COMPARE.length} exercises ahead on e1RM → ${badge.toLowerCase()}. Bars compare One Rep Max, Heaviest Weight and Best Set Volume per exercise.`,
      compareScreen
    )}
  </div>
</div>`;

const out = path.resolve(process.cwd(), '../preview/atlas-social.html');
fs.writeFileSync(out, html);
console.log(`Wrote ${out} (${(fs.statSync(out).size / 1024).toFixed(0)} KB)`);
