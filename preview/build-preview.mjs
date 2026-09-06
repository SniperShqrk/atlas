/**
 * Regenerates preview/body-data.js from app/src/data/bodyPaths.ts so the
 * browser preview always renders the same geometry as the app.
 * Run:  node preview/build-preview.mjs
 */
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const src = path.resolve(__dirname, '../app/src/data/bodyPaths.ts');
const out = path.resolve(__dirname, 'body-data.js');

let ts = fs.readFileSync(src, 'utf8');
ts = ts.replace(/\/\*\*[\s\S]*?\*\//g, '');
ts = ts.replace(/export interface BodyRegion \{[\s\S]*?\n\}/, '');
ts = ts.replace(/^export /gm, '');
ts = ts.replace(/const (FRONT_REGIONS|BACK_REGIONS): BodyRegion\[\] =/g, 'const $1 =');

fs.writeFileSync(
  out,
  '/* GENERATED from app/src/data/bodyPaths.ts — run node preview/build-preview.mjs */\n' +
    ts +
    '\nwindow.BODY={FRONT_VIEW_BOX,BACK_VIEW_BOX,DELTOID_SPLIT,FRONT_REGIONS,BACK_REGIONS};'
);
console.log(`Wrote ${out}`);
