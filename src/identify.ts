import type { Candidate } from './db';
import type { Settings } from './settings';
import { blobToDataURL } from './image';

export interface IdResult {
  candidates: Candidate[];
  description: string;
}

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
  const resp = await fetch('https://openrouter.ai/api/v1/chat/completions', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${settings.apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model: settings.model,
      temperature: 0.2,
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
  if (!resp.ok) {
    const text = await resp.text().catch(() => '');
    throw new Error(`OpenRouter ${resp.status}: ${text.slice(0, 200)}`);
  }
  const data = await resp.json();
  const content: string = data.choices?.[0]?.message?.content ?? '';
  return parseResult(content);
}

function parseResult(content: string): IdResult {
  const start = content.indexOf('{');
  const end = content.lastIndexOf('}');
  if (start < 0 || end <= start) throw new Error(`Unparseable response: ${content.slice(0, 120)}`);
  const obj = JSON.parse(content.slice(start, end + 1));
  const candidates: Candidate[] = (Array.isArray(obj.candidates) ? obj.candidates : [])
    .filter((c: any) => typeof c?.latin === 'string' && c.latin.trim())
    .slice(0, 3)
    .map((c: any) => ({
      latin: String(c.latin).trim(),
      namePl: String(c.namePl ?? '').trim(),
      nameEn: String(c.nameEn ?? '').trim(),
      confidence: Math.max(0, Math.min(1, Number(c.confidence) || 0)),
    }));
  return { candidates, description: String(obj.description ?? '').trim() };
}
