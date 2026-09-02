import type { Candidate, Entry } from './db';
import type { IdResult } from './identify';

/** Below this confidence an identification is flagged for review. */
export const REVIEW_THRESHOLD = 0.75;

/**
 * Canonical species key: "Genus epithet" — first two words, normalized case,
 * dropping authors ("L."), ranks ("subsp. x", "var. y") and aggregates ("agg.", "s.l.")
 * so the same plant never splits into several groups.
 */
export function normalizeLatin(raw: string): string {
  const words = raw
    .trim()
    .split(/\s+/)
    .filter((w) => w && w !== '×' && w.toLowerCase() !== 'x')
    .slice(0, 2)
    .map((w) => w.toLowerCase().replace(/[,;]+$/, ''));
  if (words.length === 0) return '';
  words[0] = words[0][0].toUpperCase() + words[0].slice(1);
  return words.join(' ');
}

export interface Names {
  latin: string;
  namePl: string;
  nameEn: string;
}

/** Common name in the chosen language, falling back to the other one, then Latin. */
export function displayName(n: Names, lang: 'pl' | 'en'): string {
  return (lang === 'pl' ? n.namePl || n.nameEn : n.nameEn || n.namePl) || n.latin;
}

/** Entry fields set by an identification result (top candidate wins). */
export function applyIdentification(result: IdResult, model: string): Partial<Entry> {
  const top: Candidate | undefined = result.candidates[0];
  if (!top) return { description: result.description, candidates: [], model };
  return {
    latin: top.latin,
    namePl: top.namePl,
    nameEn: top.nameEn,
    confidence: top.confidence,
    candidates: result.candidates,
    description: result.description,
    model,
    review: top.confidence < REVIEW_THRESHOLD,
  };
}
