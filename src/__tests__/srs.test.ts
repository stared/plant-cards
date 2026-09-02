import { describe, expect, it } from 'vitest';
import { isLearning, newSrs, nextSrs } from '../srs';

const DAY = 86_400_000;

describe('nextSrs', () => {
  const t0 = 1_000_000;
  it('first correct answer → 1 day, then ×2.5', () => {
    let s = nextSrs(newSrs('x', t0), true, t0);
    expect(s).toMatchObject({ correct: 1, intervalDays: 1, due: t0 + DAY });
    s = nextSrs(s, true, t0 + DAY);
    expect(s).toMatchObject({ correct: 2, intervalDays: 3, due: t0 + DAY + 3 * DAY });
    s = nextSrs(s, true, t0);
    expect(s.intervalDays).toBe(8);
  });
  it('wrong answer → 10 minutes, back to learning', () => {
    const s = nextSrs({ latin: 'x', due: 0, intervalDays: 8, correct: 3, wrong: 0 }, false, t0);
    expect(s).toMatchObject({ wrong: 1, intervalDays: 0, due: t0 + 600_000 });
    expect(isLearning(s)).toBe(true);
    expect(isLearning(nextSrs(s, true, t0))).toBe(false);
    expect(isLearning(newSrs('y'))).toBe(false);
  });
  it('does not mutate its input', () => {
    const s = newSrs('x', t0);
    nextSrs(s, true, t0);
    expect(s.correct).toBe(0);
  });
});
