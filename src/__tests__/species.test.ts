import { describe, expect, it } from 'vitest';
import { displayName, normalizeLatin } from '../species';

describe('normalizeLatin', () => {
  it('keeps a clean binomial', () => {
    expect(normalizeLatin('Quercus robur')).toBe('Quercus robur');
  });
  it('drops authors, aggregates and infraspecific ranks', () => {
    expect(normalizeLatin('Taraxacum officinale L.')).toBe('Taraxacum officinale');
    expect(normalizeLatin('Taraxacum officinale agg.')).toBe('Taraxacum officinale');
    expect(normalizeLatin('Rubus fruticosus s.l.')).toBe('Rubus fruticosus');
    expect(normalizeLatin('Acer platanoides subsp. platanoides')).toBe('Acer platanoides');
  });
  it('normalizes case and whitespace', () => {
    expect(normalizeLatin('  quercus   ROBUR ')).toBe('Quercus robur');
  });
  it('handles hybrids and lone genera', () => {
    expect(normalizeLatin('Platanus × acerifolia')).toBe('Platanus acerifolia');
    expect(normalizeLatin('Platanus x acerifolia')).toBe('Platanus acerifolia');
    expect(normalizeLatin('Rosa')).toBe('Rosa');
    expect(normalizeLatin('Rosa sp.')).toBe('Rosa sp.');
    expect(normalizeLatin('')).toBe('');
  });
});

describe('displayName', () => {
  const n = { latin: 'Urtica dioica', namePl: 'pokrzywa', nameEn: 'nettle' };
  it('prefers the chosen language, then the other, then Latin', () => {
    expect(displayName(n, 'pl')).toBe('pokrzywa');
    expect(displayName(n, 'en')).toBe('nettle');
    expect(displayName({ ...n, nameEn: '' }, 'en')).toBe('pokrzywa');
    expect(displayName({ ...n, namePl: '', nameEn: '' }, 'pl')).toBe('Urtica dioica');
  });
});
