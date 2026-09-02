import type { Candidate } from './db';
import { modelOf, type Settings } from './settings';
import { blobToDataURL } from './image';
import { normalizeLatin } from './species';

export interface IdResult {
  candidates: Candidate[];
  description: string;
}

const TIMEOUT_MS = 60_000;

function prompt(descLang: 'pl' | 'en'): string {
  const lang = descLang === 'pl' ? 'Polish' : 'English';
  return (
    'Identify the plant in this photo. Reply ONLY with JSON, no markdown, matching exactly:\n' +
    '{"candidates":[{"latin":"Genus species","namePl":"polish common name","nameEn":"english common name","confidence":0.0}],"description":"..."}\n' +
    'Rules: up to 3 candidates, most likely first, confidence in [0,1]. ' +
    '"latin" is the scientific species name (use it consistently; no author abbreviations). ' +
    `"description": 2-3 sentences in ${lang} about the most likely species: key features to recognize it and one interesting fact. ` +
    'If no plant is clearly visible, return {"candidates":[],"description":""}.'
  );
}

export async function identify(photo: Blob, settings: Settings): Promise<IdResult> {
  if (!settings.apiKey) throw new Error('No API key — set it in Settings.');
  const dataUrl = await blobToDataURL(photo);
  let resp: Response;
  try {
    resp = await fetch('https://openrouter.ai/api/v1/chat/completions', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${settings.apiKey}`,
        'Content-Type': 'application/json',
      },
      signal: AbortSignal.timeout(TIMEOUT_MS),
      body: JSON.stringify({
        model: modelOf(settings),
        temperature: 0.2,
        response_format: { type: 'json_object' },
        messages: [
          {
            role: 'user',
            content: [
              { type: 'text', text: prompt(settings.descLang) },
              { type: 'image_url', image_url: { url: dataUrl } },
            ],
          },
        ],
      }),
    });
  } catch (e) {
    if (e instanceof DOMException && e.name === 'TimeoutError') throw new Error('OpenRouter did not answer within a minute.');
    throw e;
  }
  if (!resp.ok) {
    const text = await resp.text().catch(() => '');
    throw new Error(`OpenRouter ${resp.status}: ${text.slice(0, 200)}`);
  }
  const data = await resp.json();
  if (data.error) throw new Error(`OpenRouter: ${data.error.message ?? JSON.stringify(data.error).slice(0, 200)}`);
  const content: string = data.choices?.[0]?.message?.content ?? '';
  return parseResult(content);
}

/** Tolerant parse: takes the outermost {...} in case the model wrapped it in prose or fences. */
export function parseResult(content: string): IdResult {
  const start = content.indexOf('{');
  const end = content.lastIndexOf('}');
  if (start < 0 || end <= start) throw new Error(`Unparseable response: ${content.slice(0, 120)}`);
  const obj = JSON.parse(content.slice(start, end + 1));
  const seen = new Set<string>();
  const candidates: Candidate[] = [];
  for (const c of Array.isArray(obj.candidates) ? obj.candidates : []) {
    const latin = typeof c?.latin === 'string' ? normalizeLatin(c.latin) : '';
    if (!latin || seen.has(latin)) continue;
    seen.add(latin);
    candidates.push({
      latin,
      namePl: String(c.namePl ?? '').trim(),
      nameEn: String(c.nameEn ?? '').trim(),
      confidence: Math.max(0, Math.min(1, Number(c.confidence) || 0)),
    });
    if (candidates.length === 3) break;
  }
  return { candidates, description: String(obj.description ?? '').trim() };
}
