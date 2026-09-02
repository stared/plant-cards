export interface Settings {
  apiKey: string;
  model: string; // may be empty → DEFAULT_MODEL
  descLang: 'pl' | 'en';
}

const KEY = 'plant-cards-settings';

export const DEFAULT_MODEL = 'google/gemini-3.7-flash';

const DEFAULTS: Settings = { apiKey: '', model: DEFAULT_MODEL, descLang: 'pl' };

export function getSettings(): Settings {
  try {
    const raw = localStorage.getItem(KEY);
    if (raw) return { ...DEFAULTS, ...JSON.parse(raw) };
  } catch {
    /* ignore */
  }
  return { ...DEFAULTS };
}

export function saveSettings(s: Settings) {
  localStorage.setItem(KEY, JSON.stringify(s));
}

export function modelOf(s: Settings): string {
  return s.model.trim() || DEFAULT_MODEL;
}
