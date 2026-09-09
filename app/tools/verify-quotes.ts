/**
 * Checks the Stoic quote library and its selectors.
 *
 * The failure mode worth catching here isn't a typo — it's a selector that
 * quietly always returns the same quote (a bad seed, a filter that matches
 * nothing so it silently falls back every time), which would make a feature
 * that's supposed to feel alive feel like a static caption instead.
 *
 *   npx tsx tools/verify-quotes.ts
 */
import { QUOTES, Quote, StoicTheme, quoteOfTheDay, quoteByTheme, quotesForTheme } from '../src/data/quotes';

let failures = 0;
function check(name: string, ok: boolean, detail = '') {
  if (!ok) failures += 1;
  console.log(`  ${ok ? 'ok   ' : 'FAIL '} ${name}${ok || !detail ? '' : ` — ${detail}`}`);
}

console.log(`\nQuote library — ${QUOTES.length} quotes\n`);

check('at least 35 quotes', QUOTES.length >= 35, `${QUOTES.length}`);
check('ids are unique', new Set(QUOTES.map((q) => q.id)).size === QUOTES.length);
check('quote text is unique', new Set(QUOTES.map((q) => q.text)).size === QUOTES.length);
check(
  'every quote has text, author and source',
  QUOTES.every((q) => q.text.trim().length > 0 && q.author.trim().length > 0 && q.source.trim().length > 0)
);
check(
  'every quote has at least one theme',
  QUOTES.every((q) => q.themes.length > 0),
  QUOTES.filter((q) => !q.themes.length).map((q) => q.id).join(', ')
);
check(
  'no quote runs long enough to break a card layout (≤220 chars)',
  QUOTES.every((q) => q.text.length <= 220),
  QUOTES.filter((q) => q.text.length > 220).map((q) => `${q.id} (${q.text.length})`).join(', ')
);
check(
  'attribution is one of the three sourced authors',
  QUOTES.every((q) => ['Marcus Aurelius', 'Epictetus', 'Seneca'].includes(q.author))
);

const byAuthor: Record<string, number> = {};
for (const q of QUOTES) byAuthor[q.author] = (byAuthor[q.author] ?? 0) + 1;
console.log('\n  By author:');
Object.entries(byAuthor).forEach(([a, n]) => console.log(`    ${a.padEnd(16)} ${n}`));

/* ---- theme coverage ---- */

console.log('\nTheme coverage\n');

const ALL_THEMES: StoicTheme[] = [
  'discipline', 'action', 'adversity', 'patience', 'effort',
  'endurance', 'control', 'mortality', 'perspective', 'habit',
];
const thin = ALL_THEMES.filter((t) => quotesForTheme(t).length < 2);
check(
  'every theme has at least 2 quotes',
  thin.length === 0,
  thin.join(', ')
);
ALL_THEMES.forEach((t) => console.log(`  ${t.padEnd(12)} ${quotesForTheme(t).length}`));

/* ---- quoteOfTheDay ---- */

console.log('\nquoteOfTheDay\n');

const d0 = new Date('2026-01-01T12:00:00Z');
const days = Array.from({ length: 10 }, (_, i) => new Date(d0.getTime() + i * 86_400_000));
const daily = days.map((d) => quoteOfTheDay(d));

check(
  'same calendar day always returns the same quote',
  quoteOfTheDay(new Date('2026-01-01T00:05:00Z')).id === quoteOfTheDay(new Date('2026-01-01T23:55:00Z')).id
);
check(
  'consecutive days are not identical back-to-back across a 10-day sample',
  daily.every((q, i) => i === 0 || q.id !== daily[i - 1].id)
);
daily.forEach((q, i) => console.log(`  day ${i}: ${q.id.padEnd(6)} "${q.text.slice(0, 50)}..."`));

/* ---- quoteByTheme ---- */

console.log('\nquoteByTheme\n');

check(
  'same seed always returns the same quote',
  quoteByTheme(['patience'], 12345).id === quoteByTheme(['patience'], 12345).id
);
const spread = new Set(Array.from({ length: 20 }, (_, i) => quoteByTheme(['discipline', 'action'], i).id));
check(
  '20 different seeds produce more than one distinct quote (not stuck on a single fallback)',
  spread.size > 1,
  `${spread.size} distinct`
);
check(
  'every returned quote actually matches a requested theme',
  Array.from({ length: 30 }, (_, i) => quoteByTheme(['mortality'], i)).every((q) =>
    q.themes.includes('mortality')
  )
);
check(
  'an empty theme list falls back to the full library rather than throwing',
  (() => {
    try {
      quoteByTheme([], 1);
      return true;
    } catch {
      return false;
    }
  })()
);

console.log(`\n${failures === 0 ? 'ALL CHECKS PASSED' : `${failures} CHECK(S) FAILED`}\n`);
process.exit(failures === 0 ? 0 : 1);
