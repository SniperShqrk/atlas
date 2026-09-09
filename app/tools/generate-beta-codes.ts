/**
 * Prints N fresh beta codes for handing to testers (see src/lib/betaCodes.ts
 * for how they're validated — entirely offline, no backend involved).
 *
 *   npx tsx tools/generate-beta-codes.ts        (defaults to 10)
 *   npx tsx tools/generate-beta-codes.ts 25
 */
import { generateBetaCode } from '../src/lib/betaCodes';

const count = Number(process.argv[2]) || 10;
const codes = new Set<string>();
while (codes.size < count) codes.add(generateBetaCode());

console.log(`\n${count} ATLAS beta codes — Settings/Paywall → "Have a beta code?"\n`);
for (const code of codes) {
  console.log(`  ${code.slice(0, 4)}-${code.slice(4)}`);
}
console.log('');
