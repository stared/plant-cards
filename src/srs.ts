import { db, type Srs } from './db';

const DAY = 24 * 60 * 60 * 1000;
const LEARN_AGAIN_MS = 10 * 60 * 1000; // wrong answer → see again in 10 min
const EASE = 2.5;

export function newSrs(latin: string, now = Date.now()): Srs {
  return { latin, due: now, intervalDays: 0, correct: 0, wrong: 0 };
}

/** Pure scheduling step: the record after answering. */
export function nextSrs(s: Srs, correct: boolean, now = Date.now()): Srs {
  if (correct) {
    const intervalDays = s.intervalDays <= 0 ? 1 : Math.round(s.intervalDays * EASE);
    return { ...s, correct: s.correct + 1, intervalDays, due: now + intervalDays * DAY };
  }
  return { ...s, wrong: s.wrong + 1, intervalDays: 0, due: now + LEARN_AGAIN_MS };
}

/** Still in the learning phase (answered wrong, not yet answered right since). */
export function isLearning(s: Srs): boolean {
  return s.intervalDays === 0 && s.wrong > 0;
}

export async function grade(latin: string, correct: boolean): Promise<void> {
  const s = (await db.srs.get(latin)) ?? newSrs(latin);
  await db.srs.put(nextSrs(s, correct));
}

export async function ensureSrs(latin: string): Promise<void> {
  const existing = await db.srs.get(latin);
  if (!existing) await db.srs.put(newSrs(latin));
}
