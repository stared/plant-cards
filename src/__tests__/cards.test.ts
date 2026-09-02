import { describe, expect, it } from 'vitest';
import { pickQuestion } from '../views/Cards';
import type { SpeciesGroup, Srs } from '../db';

const blob = new Blob(['x']);
const group = (latin: string, namePl: string, review = false): SpeciesGroup => ({
  latin,
  namePl,
  nameEn: '',
  entries: [{ latin, namePl, nameEn: '', description: '', candidates: [], confidence: 1, takenAt: 0, lat: null, lon: null, locSource: 'none', photo: blob, model: '', review }],
});
const now = 1_000_000;
const q = (groups: SpeciesGroup[], srs: Srs[] = [], extra = {}) => pickQuestion(groups, srs, { lang: 'pl', anyway: false, now, ...extra });

describe('pickQuestion', () => {
  it('reports empty / done', () => {
    expect(q([])).toBe('empty');
    expect(q([group('unidentified', '')])).toBe('empty');
    expect(q([group('A a', 'a')], [{ latin: 'A a', due: now + 1, intervalDays: 1, correct: 1, wrong: 0 }])).toBe('done');
    expect(q([group('A a', 'a')], [{ latin: 'A a', due: now + 1, intervalDays: 1, correct: 1, wrong: 0 }], { anyway: true })).not.toBe('done');
  });
  it('never shows the same label twice, even when two species share a common name', () => {
    const groups = [group('A a', 'mniszek'), group('B b', 'mniszek'), group('C c', 'c')];
    for (let i = 0; i < 20; i++) {
      const r = q(groups);
      if (typeof r !== 'object') throw new Error('expected question');
      expect(new Set(r.options).size).toBe(4);
      expect(r.options).toContain(r.correctOption);
      expect(r.options.filter((o) => o === 'mniszek')).toHaveLength(1);
    }
  });
  it('keeps learning items due and avoids repeating the previous species', () => {
    const groups = [group('A a', 'a'), group('B b', 'b')];
    const srs: Srs[] = [
      { latin: 'A a', due: now + 600_000, intervalDays: 0, correct: 0, wrong: 1 }, // just answered wrong
      { latin: 'B b', due: now, intervalDays: 0, correct: 0, wrong: 0 },
    ];
    for (let i = 0; i < 10; i++) {
      const r = q(groups, srs, { exclude: 'A a' });
      if (typeof r !== 'object') throw new Error('expected question');
      expect(r.species.latin).toBe('B b');
      expect(r.dueCount).toBe(2);
    }
    // Single species left: repeating is allowed rather than reporting done.
    const r = q([group('A a', 'a')], srs, { exclude: 'A a' });
    expect(typeof r).toBe('object');
  });
});
