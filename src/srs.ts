import { db, type Srs } from './db';

const DAY = 24 * 60 * 60 * 1000;
const LEARN_AGAIN_MS = 10 * 60 * 1000; // wrong answer → see again in 10 min
const EASE = 2.5;

export function newSrs(latin: string): Srs {
  return { latin, due: Date.now(), intervalDays: 0, correct: 0, wrong: 0 };
}

export async function grade(latin: string, correct: boolean): Promise<void> {
  const s = (await db.srs.get(latin)) ?? newSrs(latin);
  if (correct) {
    s.correct += 1;
    s.intervalDays = s.intervalDays <= 0 ? 1 : Math.round(s.intervalDays * EASE);
    s.due = Date.now() + s.intervalDays * DAY;
  } else {
    s.wrong += 1;
    s.intervalDays = 0;
    s.due = Date.now() + LEARN_AGAIN_MS;
  }
  await db.srs.put(s);
}

export async function ensureSrs(latin: string): Promise<void> {
  const existing = await db.srs.get(latin);
  if (!existing) await db.srs.put(newSrs(latin));
}
