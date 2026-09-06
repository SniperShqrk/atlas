/**
 * Regenerates backend/src/data/exercises.js from the app's TypeScript source
 * so the plan generator can never drift from the exercise ids the app knows.
 * Run from the backend folder:  npm run sync-exercises
 */
import { execSync } from 'child_process';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const appDir = path.resolve(__dirname, '../../app');
const appData = path.join(appDir, 'src/data/exercises.ts');
const outDir = path.resolve(__dirname, '../.tmp-gen');
const target = path.resolve(__dirname, '../src/data/exercises.js');

execSync(
  `npx tsc "${appData}" --outDir "${outDir}" --module esnext --target es2020 --moduleResolution bundler`,
  { stdio: 'inherit', cwd: appDir }
);

const header = `/**
 * GENERATED FILE - do not edit by hand.
 * Mirrors app/src/data/exercises.ts so the server-side plan generator uses
 * exactly the same exercise ids and muscle mappings as the app.
 * Regenerate with:  npm run sync-exercises   (from the backend folder)
 */
`;

const body = fs.readFileSync(path.join(outDir, 'exercises.js'), 'utf8');
fs.writeFileSync(target, header + body);
fs.rmSync(outDir, { recursive: true, force: true });
console.log(`Synced ${target}`);
