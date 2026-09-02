import Dexie, { type Table } from 'dexie';

export const UNIDENTIFIED = 'unidentified';

export interface Candidate {
  latin: string;
  namePl: string;
  nameEn: string;
  confidence: number;
}

export interface Entry {
  id?: number;
  latin: string; // canonical species key (scientific name), UNIDENTIFIED if unknown
  namePl: string;
  nameEn: string;
  description: string;
  candidates: Candidate[];
  confidence: number;
  takenAt: number; // ms epoch
  lat: number | null;
  lon: number | null;
  locSource: 'gps' | 'exif' | 'none';
  photo: Blob; // downscaled JPEG
  model: string;
  review: boolean; // low confidence / failed → worth a second look
}

export interface Srs {
  latin: string;
  due: number; // ms epoch
  intervalDays: number; // 0 = learning
  correct: number;
  wrong: number;
}

class PlantDB extends Dexie {
  entries!: Table<Entry, number>;
  srs!: Table<Srs, string>;
  constructor() {
    super('plant-cards');
    this.version(1).stores({
      entries: '++id, latin, takenAt',
      srs: 'latin, due',
    });
  }
}

export const db = new PlantDB();

/** Re-label every entry of one species (rename / merge into another). */
export async function renameSpecies(from: string, to: { latin: string; namePl: string; nameEn: string }): Promise<number> {
  return db.entries.where('latin').equals(from).modify({ ...to, review: false });
}

export interface SpeciesGroup {
  latin: string;
  namePl: string;
  nameEn: string;
  entries: Entry[];
}

/** All entries grouped by species, newest first inside each group. */
export async function speciesGroups(): Promise<SpeciesGroup[]> {
  const all = await db.entries.orderBy('takenAt').reverse().toArray();
  const map = new Map<string, SpeciesGroup>();
  for (const e of all) {
    let g = map.get(e.latin);
    if (!g) {
      g = { latin: e.latin, namePl: e.namePl, nameEn: e.nameEn, entries: [] };
      map.set(e.latin, g);
    }
    g.entries.push(e);
  }
  return [...map.values()];
}
