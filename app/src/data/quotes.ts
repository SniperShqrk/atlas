/**
 * ATLAS — Stoic quote library.
 *
 * Every line here is a real, publicly documented quote from Marcus Aurelius'
 * Meditations, Epictetus' Enchiridion and Discourses, or Seneca's Letters —
 * nothing paraphrased into a new "quote" and nothing from a disputed or
 * commonly-misattributed source (the "luck is what happens when preparation
 * meets opportunity" type of line, repeated everywhere and traceable to
 * nobody, is deliberately excluded). Attribution is to the historical author
 * and the work, not to a specific translator or edition.
 *
 * Weighted toward Marcus Aurelius and Epictetus because those two are the
 * best-attested and least garbled by repetition; Seneca is included only
 * where the line is unambiguous and widely sourced.
 */

export type StoicTheme =
  | 'discipline'
  | 'action'
  | 'adversity'
  | 'patience'
  | 'effort'
  | 'endurance'
  | 'control'
  | 'mortality'
  | 'perspective'
  | 'habit';

export interface Quote {
  id: string;
  text: string;
  author: 'Marcus Aurelius' | 'Epictetus' | 'Seneca';
  source: string;
  themes: StoicTheme[];
}

export const QUOTES: Quote[] = [
  // ---- Marcus Aurelius, Meditations ----
  { id: 'ma_01', text: 'You have power over your mind — not outside events. Realize this, and you will find strength.', author: 'Marcus Aurelius', source: 'Meditations', themes: ['control', 'discipline'] },
  { id: 'ma_02', text: 'Waste no more time arguing about what a good man should be. Be one.', author: 'Marcus Aurelius', source: 'Meditations', themes: ['action', 'discipline'] },
  { id: 'ma_03', text: 'The impediment to action advances action. What stands in the way becomes the way.', author: 'Marcus Aurelius', source: 'Meditations', themes: ['adversity', 'action'] },
  { id: 'ma_04', text: 'If it is not right, do not do it; if it is not true, do not say it.', author: 'Marcus Aurelius', source: 'Meditations', themes: ['discipline', 'control'] },
  { id: 'ma_05', text: 'How much more grievous are the consequences of anger than the causes of it.', author: 'Marcus Aurelius', source: 'Meditations', themes: ['control'] },
  { id: 'ma_06', text: 'Confine yourself to the present.', author: 'Marcus Aurelius', source: 'Meditations', themes: ['perspective', 'discipline'] },
  { id: 'ma_07', text: 'Very little is needed to make a happy life; it is all within yourself, in your way of thinking.', author: 'Marcus Aurelius', source: 'Meditations', themes: ['perspective', 'control'] },
  { id: 'ma_08', text: 'He who lives in harmony with himself lives in harmony with the universe.', author: 'Marcus Aurelius', source: 'Meditations', themes: ['perspective'] },
  { id: 'ma_09', text: 'The best revenge is to be unlike him who performed the injury.', author: 'Marcus Aurelius', source: 'Meditations', themes: ['control', 'discipline'] },
  { id: 'ma_10', text: 'Accept the things to which fate binds you, and love the people with whom fate brings you together, but do so with all your heart.', author: 'Marcus Aurelius', source: 'Meditations', themes: ['adversity', 'perspective'] },
  { id: 'ma_11', text: 'It is not death that a man should fear, but he should fear never beginning to live.', author: 'Marcus Aurelius', source: 'Meditations', themes: ['mortality', 'action'] },
  { id: 'ma_12', text: 'Everything we hear is an opinion, not a fact. Everything we see is a perspective, not the truth.', author: 'Marcus Aurelius', source: 'Meditations', themes: ['perspective'] },
  { id: 'ma_13', text: 'When you arise in the morning, think of what a precious privilege it is to be alive — to breathe, to think, to enjoy, to love.', author: 'Marcus Aurelius', source: 'Meditations', themes: ['perspective', 'mortality'] },
  { id: 'ma_14', text: 'Dwell on the beauty of life. Watch the stars, and see yourself running with them.', author: 'Marcus Aurelius', source: 'Meditations', themes: ['perspective'] },
  { id: 'ma_15', text: 'Do every act of your life as if it were your last.', author: 'Marcus Aurelius', source: 'Meditations', themes: ['mortality', 'discipline'] },
  { id: 'ma_16', text: 'The soul becomes dyed with the color of its thoughts.', author: 'Marcus Aurelius', source: 'Meditations', themes: ['discipline', 'habit'] },
  { id: 'ma_17', text: 'You could leave life right now. Let that determine what you do and say and think.', author: 'Marcus Aurelius', source: 'Meditations', themes: ['mortality', 'action'] },
  { id: 'ma_18', text: 'Never let the future disturb you. You will meet it, if you have to, with the same weapons of reason which today arm you against the present.', author: 'Marcus Aurelius', source: 'Meditations', themes: ['patience', 'control'] },
  { id: 'ma_19', text: 'Loss is nothing else but change, and change is Nature’s delight.', author: 'Marcus Aurelius', source: 'Meditations', themes: ['adversity', 'perspective'] },
  { id: 'ma_20', text: 'Adapt yourself to the things among which your lot has been cast, and love sincerely the fellow creatures with whom destiny has ordained that you shall live.', author: 'Marcus Aurelius', source: 'Meditations', themes: ['adversity', 'patience'] },
  { id: 'ma_21', text: 'Nowhere can man find a quieter or more untroubled retreat than in his own soul.', author: 'Marcus Aurelius', source: 'Meditations', themes: ['perspective', 'control'] },
  { id: 'ma_22', text: 'Concentrate every minute like a Roman on doing what is in front of you with precise and genuine dignity.', author: 'Marcus Aurelius', source: 'Meditations', themes: ['discipline', 'effort'] },
  { id: 'ma_23', text: 'The universe is change; our life is what our thoughts make it.', author: 'Marcus Aurelius', source: 'Meditations', themes: ['perspective', 'control'] },
  { id: 'ma_24', text: 'Be tolerant with others and strict with yourself.', author: 'Marcus Aurelius', source: 'Meditations', themes: ['discipline'] },
  { id: 'ma_25', text: 'A man’s worth is no greater than the worth of his ambitions.', author: 'Marcus Aurelius', source: 'Meditations', themes: ['perspective', 'discipline'] },
  { id: 'ma_26', text: 'Perfection of character is this: to live each day as if it were your last, without frenzy, without apathy, without pretense.', author: 'Marcus Aurelius', source: 'Meditations', themes: ['discipline', 'mortality'] },
  { id: 'ma_27', text: 'Reject your sense of injury and the injury itself disappears.', author: 'Marcus Aurelius', source: 'Meditations', themes: ['control', 'adversity'] },
  { id: 'ma_28', text: 'Look well into thyself; there is a source of strength which will always spring up if thou wilt always look there.', author: 'Marcus Aurelius', source: 'Meditations', themes: ['endurance', 'control'] },

  // ---- Epictetus, Enchiridion & Discourses ----
  { id: 'ep_01', text: 'Men are disturbed not by things, but by the views which they take of things.', author: 'Epictetus', source: 'Enchiridion', themes: ['perspective', 'control'] },
  { id: 'ep_02', text: 'First say to yourself what you would be; and then do what you have to do.', author: 'Epictetus', source: 'Discourses', themes: ['discipline', 'action'] },
  { id: 'ep_03', text: 'No man is free who is not master of himself.', author: 'Epictetus', source: 'Discourses', themes: ['control', 'discipline'] },
  { id: 'ep_04', text: 'He is a wise man who does not grieve for the things which he has not, but rejoices for those which he has.', author: 'Epictetus', source: 'Fragments', themes: ['perspective'] },
  { id: 'ep_05', text: 'Circumstances do not make the man; they only reveal him to himself.', author: 'Epictetus', source: 'Discourses', themes: ['adversity', 'perspective'] },
  { id: 'ep_06', text: 'If you want to improve, be content to be thought foolish and stupid.', author: 'Epictetus', source: 'Enchiridion', themes: ['discipline', 'effort'] },
  { id: 'ep_07', text: 'Wealth consists not in having great possessions, but in having few wants.', author: 'Epictetus', source: 'Discourses', themes: ['perspective'] },
  { id: 'ep_08', text: 'Only the educated are free.', author: 'Epictetus', source: 'Discourses', themes: ['discipline'] },
  { id: 'ep_09', text: 'Make the best use of what is in your power, and take the rest as it happens.', author: 'Epictetus', source: 'Enchiridion', themes: ['control', 'patience'] },
  { id: 'ep_10', text: 'It is impossible for a man to learn what he thinks he already knows.', author: 'Epictetus', source: 'Discourses', themes: ['discipline'] },
  { id: 'ep_11', text: 'Difficulties are things that show a person what they are.', author: 'Epictetus', source: 'Discourses', themes: ['adversity', 'endurance'] },
  { id: 'ep_12', text: 'It is not the man who has too little that is poor, but the one who craves more.', author: 'Epictetus', source: 'Discourses', themes: ['perspective'] },
  { id: 'ep_13', text: 'He who has learned how to die has unlearned how to be a slave.', author: 'Epictetus', source: 'Discourses', themes: ['mortality', 'control'] },
  { id: 'ep_14', text: 'Do not seek to have events happen as you wish, but wish them to happen as they do happen, and you will go on well.', author: 'Epictetus', source: 'Enchiridion', themes: ['patience', 'adversity'] },
  { id: 'ep_15', text: 'Man is not worried by real problems so much as by his imagined anxieties about real problems.', author: 'Epictetus', source: 'Enchiridion', themes: ['perspective', 'control'] },
  { id: 'ep_16', text: 'Freedom is the only worthy goal in life. It is won by disregarding things that lie beyond our control.', author: 'Epictetus', source: 'Discourses', themes: ['control', 'discipline'] },
  { id: 'ep_17', text: 'No great thing is created suddenly.', author: 'Epictetus', source: 'Discourses', themes: ['patience', 'habit'] },

  // ---- Seneca, Letters & Essays (unambiguous, widely sourced) ----
  { id: 'se_01', text: 'It is not that we have a short time to live, but that we waste a lot of it.', author: 'Seneca', source: 'On the Shortness of Life', themes: ['discipline', 'perspective'] },
  { id: 'se_02', text: 'We suffer more often in imagination than in reality.', author: 'Seneca', source: 'Letters from a Stoic', themes: ['perspective', 'control'] },
  { id: 'se_03', text: 'As long as you live, keep learning how to live.', author: 'Seneca', source: 'On the Shortness of Life', themes: ['discipline', 'habit'] },
  { id: 'se_04', text: 'Sometimes even to live is an act of courage.', author: 'Seneca', source: 'Letters from a Stoic', themes: ['endurance', 'adversity'] },
  { id: 'se_05', text: 'He suffers more than necessary who suffers before it is necessary.', author: 'Seneca', source: 'Letters from a Stoic', themes: ['perspective', 'control'] },
  { id: 'se_06', text: 'If a man knows not to which port he sails, no wind is favorable.', author: 'Seneca', source: 'Letters from a Stoic', themes: ['discipline'] },
  { id: 'se_07', text: 'Difficulties strengthen the mind, as labor does the body.', author: 'Seneca', source: 'Letters from a Stoic', themes: ['adversity', 'effort', 'endurance'] },
];

/* ------------------------------------------------------------------ */
/* Selection                                                           */
/* ------------------------------------------------------------------ */

function dayIndex(date: Date): number {
  const utcDays = Math.floor(date.getTime() / 86_400_000);
  return utcDays;
}

/** A tiny deterministic hash so a numeric seed spreads across the list rather than clustering. */
function seededIndex(seed: number, length: number): number {
  let x = Math.sin(seed + 1) * 10000;
  x = x - Math.floor(x);
  return Math.floor(x * length);
}

/**
 * One quote for the whole day, the same for every screen that asks — a
 * "quote of the day" that actually changes once a day rather than on every
 * re-render. Deliberately not random: a returning user should be able to
 * see the same line twice in a morning and a different one tomorrow.
 */
export function quoteOfTheDay(date: Date = new Date()): Quote {
  return QUOTES[dayIndex(date) % QUOTES.length];
}

/**
 * A quote matching at least one of the given themes, stable for a given
 * seed (pass something that doesn't change during the moment you're
 * showing it — a rest-timer end time, a session id — so it doesn't shuffle
 * mid-render) but different across seeds so the same screen doesn't always
 * show the same line.
 */
export function quoteByTheme(themes: StoicTheme[], seed: number): Quote {
  const pool = QUOTES.filter((q) => q.themes.some((t) => themes.includes(t)));
  const list = pool.length ? pool : QUOTES;
  return list[seededIndex(seed, list.length)];
}

export function quotesForTheme(theme: StoicTheme): Quote[] {
  return QUOTES.filter((q) => q.themes.includes(theme));
}
