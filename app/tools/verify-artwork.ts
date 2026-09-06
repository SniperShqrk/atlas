/**
 * Exercises the artwork pipeline without touching the network.
 *
 * The download is the one step that cannot be tested offline, so everything
 * around it is: the registry's shape, the grade, the crop, and — the part that
 * actually matters — whether a real raster behind the scrim still leaves the
 * card's type readable. A synthetic stand-in stands in for the photograph.
 *
 *   npx tsx tools/verify-artwork.ts
 */
import './nodeAssetShim';
import fs from 'node:fs';
import path from 'node:path';
import sharp from 'sharp';

import { ARTWORK_LIST } from '../src/share/artwork';
import { CARD_PIXELS, grade } from './artworkGrade';
import { CARD_FORMATS } from '../src/share/cards';

let failures = 0;
function check(name: string, ok: boolean, detail = '') {
  console.log(`  ${ok ? 'ok   ' : 'FAIL '} ${name}${ok || !detail ? '' : ` — ${detail}`}`);
  if (!ok) failures += 1;
}

/**
 * A stand-in for a museum photograph: a lit stone gradient with a soft figure
 * mass off-centre and some grain. Not art — just something with the tonal
 * range and composition of the real thing, so the grade has work to do.
 */
async function syntheticPhotograph(w = 900, h = 1400): Promise<Buffer> {
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}">
    <defs>
      <linearGradient id="room" x1="0" y1="0" x2="1" y2="1">
        <stop offset="0%" stop-color="#8d8577"/>
        <stop offset="55%" stop-color="#3a352e"/>
        <stop offset="100%" stop-color="#17140f"/>
      </linearGradient>
      <radialGradient id="body" cx="45%" cy="34%" r="46%">
        <stop offset="0%" stop-color="#efe9dc"/>
        <stop offset="60%" stop-color="#b9b0a0"/>
        <stop offset="100%" stop-color="#4a443b" stop-opacity="0"/>
      </radialGradient>
    </defs>
    <rect width="${w}" height="${h}" fill="url(#room)"/>
    <ellipse cx="${w * 0.45}" cy="${h * 0.36}" rx="${w * 0.27}" ry="${h * 0.3}" fill="url(#body)"/>
    <ellipse cx="${w * 0.45}" cy="${h * 0.72}" rx="${w * 0.17}" ry="${h * 0.24}" fill="#cfc6b4" opacity="0.55"/>
  </svg>`;
  return sharp(Buffer.from(svg)).jpeg({ quality: 92 }).toBuffer();
}

async function main() {
  console.log('\nRegistry\n');
  check('four works registered', ARTWORK_LIST.length === 4, String(ARTWORK_LIST.length));
  check(
    'every work has a Met object id',
    ARTWORK_LIST.every((a) => Number.isInteger(a.objectId) && a.objectId > 0)
  );
  check(
    'every work carries a credit and a source URL',
    ARTWORK_LIST.every((a) => !!a.credit && a.sourceUrl.startsWith('https://www.metmuseum.org/'))
  );
  check(
    'every image URL is on the Met image host',
    ARTWORK_LIST.every((a) => a.imageUrl.startsWith('https://images.metmuseum.org/'))
  );
  check('ids are unique', new Set(ARTWORK_LIST.map((a) => a.id)).size === ARTWORK_LIST.length);
  check(
    'grading parameters are in range',
    ARTWORK_LIST.every(
      (a) =>
        a.tone.desaturate >= 0 &&
        a.tone.desaturate <= 1 &&
        a.tone.brightness > 0 &&
        a.tone.brightness <= 1.5
    )
  );

  console.log('\nGrade\n');
  const source = await syntheticPhotograph();
  const graded: Record<string, Buffer> = {};

  for (const art of ARTWORK_LIST) {
    const out = await grade(source, art);
    graded[art.id] = out;
    const meta = await sharp(out).metadata();
    check(
      `${art.shortName}: cropped to ${CARD_PIXELS.width}x${CARD_PIXELS.height}`,
      meta.width === CARD_PIXELS.width && meta.height === CARD_PIXELS.height,
      `${meta.width}x${meta.height}`
    );
    check(`${art.shortName}: encoded as jpeg`, meta.format === 'jpeg', String(meta.format));
    check(
      `${art.shortName}: under 400 KB`,
      out.length < 400 * 1024,
      `${(out.length / 1024).toFixed(0)} KB`
    );

    // the whole point of the grade: the backdrop must stay dark enough that
    // white type over it is readable once the scrim is applied on top
    const stats = await sharp(out).stats();
    const mean = stats.channels.reduce((n, c) => n + c.mean, 0) / stats.channels.length;
    // A ceiling alone would be passed by a black rectangle, which is exactly
    // the failure this is meant to catch: dark enough for white type, light
    // enough that the sculpture is still visible under it.
    check(
      `${art.shortName}: mean luminance in 34–108 (readable, and not a black box)`,
      mean > 34 && mean < 108,
      mean.toFixed(1)
    );
  }

  /* ---------------------------------------------------------------- */
  /* A card with a real raster behind it                               */
  /* ---------------------------------------------------------------- */

  const outDir = path.resolve(process.cwd(), '../.verify');
  fs.mkdirSync(outDir, { recursive: true });

  const f = CARD_FORMATS.portrait;
  const tiles = await Promise.all(
    ARTWORK_LIST.map(async (art) => {
      // crop the story-format grade down to the portrait card, as the app does
      const portrait = await sharp(graded[art.id])
        .resize(f.w, f.h, { fit: 'cover', position: 'north' })
        .jpeg({ quality: 80 })
        .toBuffer();
      return {
        art,
        uri: `data:image/jpeg;base64,${portrait.toString('base64')}`,
      };
    })
  );

  const html = `<title>ATLAS Artwork Pipeline</title>
<style>
  :root { --bg:#0D0D0E; --ink:#F0EEE9; --dim:#8C887F; --faint:#5A5750; --bronze:#C08A3E; --line:#2A2825; }
  * { box-sizing:border-box; }
  body { margin:0; background:var(--bg); color:var(--ink);
    font-family:-apple-system,BlinkMacSystemFont,"Segoe UI",system-ui,sans-serif; }
  .page { max-width:1200px; margin:0 auto; padding:44px 28px 72px; }
  h1 { font-size:28px; font-weight:700; letter-spacing:6px; margin:0; }
  h1 b { color:var(--bronze); }
  .lede { color:var(--dim); font-size:14px; line-height:1.65; margin:14px 0 0; max-width:74ch; }
  .row { display:flex; flex-wrap:wrap; gap:26px; margin-top:36px; align-items:flex-start; }
  figure { margin:0; width:266px; }
  .card { position:relative; aspect-ratio:1080/1350; border-radius:16px; overflow:hidden;
    box-shadow:0 18px 40px rgba(0,0,0,.55); }
  .card img { position:absolute; inset:0; width:100%; height:100%; object-fit:cover; }
  .scrim { position:absolute; inset:0;
    background:linear-gradient(rgba(0,0,0,.30) 0%, rgba(0,0,0,.10) 42%, rgba(0,0,0,.86) 100%); }
  .frame { position:absolute; inset:12px; border:1px solid rgba(240,238,233,.14); border-radius:7px; }
  .content { position:absolute; inset:0; padding:26px 24px; display:flex; flex-direction:column; }
  .mark { font-size:12px; font-weight:700; letter-spacing:4px; }
  .mark b { color:var(--bronze); }
  .fill { flex:1; }
  .eyebrow { font-size:9px; font-weight:700; letter-spacing:2px; color:var(--bronze); text-transform:uppercase; }
  .hero { font-size:56px; font-weight:700; letter-spacing:-2px; line-height:1; margin-top:8px; }
  .hero span { font-size:15px; font-weight:600; color:rgba(240,238,233,.62); margin-left:5px; letter-spacing:0; }
  .ttl { font-size:17px; font-weight:600; margin-top:10px; }
  .sub { font-size:11.5px; color:rgba(240,238,233,.62); margin-top:3px; }
  figcaption { margin-top:12px; font-size:12px; color:var(--dim); line-height:1.55; }
  figcaption b { color:var(--ink); }
  figcaption span { color:var(--faint); font-size:11px; }
  .note { margin-top:34px; padding:18px 20px; border-left:2px solid var(--bronze);
    background:#181715; border-radius:0 8px 8px 0; font-size:13.5px; color:var(--dim); line-height:1.7; max-width:80ch; }
</style>
<div class="page">
  <h1>ATL<b>A</b>S</h1>
  <p class="lede">
    The artwork pipeline, verified offline. The backdrop below is <strong>not</strong> the museum
    photograph — it is a synthetic stand-in pushed through the identical grade, crop and scrim, to
    prove the raster path works and that type stays readable over a real image rather than over flat
    marble. Running <code>tools/fetch-artwork.ts</code> swaps in the actual sculpture.
  </p>
  <div class="row">
    ${tiles
      .map(
        (t) => `<figure>
      <div class="card">
        <img src="${t.uri}" alt="">
        <div class="scrim"></div>
        <div class="frame"></div>
        <div class="content">
          <div class="mark">ATL<b>A</b>S</div>
          <div class="fill"></div>
          <div class="eyebrow">Personal record</div>
          <div class="hero">102.5<span>kg</span></div>
          <div class="ttl">Barbell Bench Press</div>
          <div class="sub">102.5kg × 5 · Compound</div>
        </div>
      </div>
      <figcaption><b>${t.art.shortName}</b> · Met ${t.art.objectId}<br>
        <span>${t.art.culture}, ${t.art.date} · ${t.art.credit}</span></figcaption>
    </figure>`
      )
      .join('\n')}
  </div>
  <p class="note">
    Each tone is graded differently on purpose — the helmet runs warm, the column cool — but all
    four are pulled to a common black point and saturation so a feed of ATLAS cards reads as one
    product rather than four museum screenshots.
  </p>
</div>`;

  const out = path.join(outDir, 'artwork-pipeline.html');
  fs.writeFileSync(out, html);
  console.log(`\nWrote ${out}`);
  console.log(`\n${failures === 0 ? 'ALL CHECKS PASSED' : `${failures} CHECK(S) FAILED`}\n`);
  process.exit(failures === 0 ? 0 : 1);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
