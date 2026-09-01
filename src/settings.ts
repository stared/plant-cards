export interface Settings {
  apiKey: string;
  model: string;
  descLang: 'pl' | 'en';
}

const KEY = 'plant-cards-settings';

export const DEFAULT_MODEL = 'google/gemini-3.7-flash';

export function getSettings(): Settings {
  try {
    const raw = localStorage.getItem(KEY);
    if (raw) return { apiKey: '', model: DEFAULT_MODEL, descLang: 'pl', ...JSON.parse(raw) };
  } catch {
    /* ignore */
  }
  return { apiKey: '', model: DEFAULT_MODEL, descLang: 'pl' };
}

export function saveSettings(s: Settings) {
  localStorage.setItem(KEY, JSON.stringify(s));
}
