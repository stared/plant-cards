import { describe, expect, it } from 'vitest';
import { parseResult } from '../identify';

describe('parseResult', () => {
  it('parses clean JSON', () => {
    const r = parseResult('{"candidates":[{"latin":"Urtica dioica","namePl":"pokrzywa","nameEn":"nettle","confidence":0.9}],"description":"d"}');
    expect(r.candidates).toEqual([{ latin: 'Urtica dioica', namePl: 'pokrzywa', nameEn: 'nettle', confidence: 0.9 }]);
    expect(r.description).toBe('d');
  });
  it('tolerates fences and prose around the JSON', () => {
    const r = parseResult('Sure!\n```json\n{"candidates":[],"description":""}\n```');
    expect(r.candidates).toEqual([]);
  });
  it('normalizes Latin, dedupes, clamps confidence, caps at 3', () => {
    const r = parseResult(
      JSON.stringify({
        candidates: [
          { latin: 'quercus robur L.', confidence: 1.7 },
          { latin: 'Quercus robur', confidence: 0.5 },
          { latin: 'Quercus petraea', confidence: -1 },
          { latin: '  ', confidence: 0.2 },
          { latin: 'Quercus rubra', confidence: 'x' },
          { latin: 'Quercus cerris', confidence: 0.1 },
        ],
      }),
    );
    expect(r.candidates.map((c) => c.latin)).toEqual(['Quercus robur', 'Quercus petraea', 'Quercus rubra']);
    expect(r.candidates.map((c) => c.confidence)).toEqual([1, 0, 0]);
    expect(r.candidates[0].namePl).toBe('');
  });
  it('rejects non-JSON', () => {
    expect(() => parseResult('I cannot see a plant.')).toThrow(/Unparseable/);
  });
});
