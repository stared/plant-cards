import { useRef, useState } from 'preact/hooks';
import type { Route } from '../app';
import { db, UNIDENTIFIED, type Entry } from '../db';
import { downscale } from '../image';
import { getPosition, exifLocation, exifDate } from '../geo';
import { identify } from '../identify';
import { getSettings } from '../settings';
import { ensureSrs } from '../srs';

const REVIEW_THRESHOLD = 0.75;

export function Capture({ navigate }: { navigate: (r: Route) => void }) {
  const camRef = useRef<HTMLInputElement>(null);
  const libRef = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const settings = getSettings();

  async function handleFile(file: File, fromLibrary: boolean) {
    setError(null);
    setBusy('Reading photo…');
    try {
      // Location + capture time (EXIF first for library picks, then browser GPS).
      const locPromise = (async () => {
        if (fromLibrary) {
          const fromExif = await exifLocation(file);
          if (fromExif) return fromExif;
        }
        return getPosition();
      })();
      const takenAtPromise = fromLibrary ? exifDate(file) : Promise.resolve(null);

      const photo = await downscale(file);
      setBusy('Identifying…');
      const idPromise = identify(photo, settings).catch((e: Error) => e);

      const [loc, exifTakenAt, result] = await Promise.all([locPromise, takenAtPromise, idPromise]);

      const entry: Entry = {
        latin: UNIDENTIFIED,
        namePl: '',
        nameEn: '',
        description: '',
        candidates: [],
        confidence: 0,
        takenAt: exifTakenAt ?? Date.now(),
        lat: loc?.lat ?? null,
        lon: loc?.lon ?? null,
        locSource: loc?.source ?? 'none',
        photo,
        model: settings.model,
        review: true,
      };

      if (result instanceof Error) {
        setError(`Identification failed (photo saved anyway — retry from the entry): ${result.message}`);
      } else if (result.candidates.length === 0) {
        setError('No plant recognized in the photo. Saved as unidentified.');
        entry.description = result.description;
      } else {
        const top = result.candidates[0];
        entry.latin = top.latin;
        entry.namePl = top.namePl;
        entry.nameEn = top.nameEn;
        entry.confidence = top.confidence;
        entry.candidates = result.candidates;
        entry.description = result.description;
        entry.review = top.confidence < REVIEW_THRESHOLD;
        await ensureSrs(top.latin);
      }

      const id = await db.entries.add(entry);
      setBusy(null);
      navigate({ view: 'entry', id: id as number });
    } catch (e) {
      setBusy(null);
      setError(e instanceof Error ? e.message : String(e));
    }
  }

  function onChange(fromLibrary: boolean) {
    return (ev: Event) => {
      const input = ev.currentTarget as HTMLInputElement;
      const file = input.files?.[0];
      input.value = '';
      if (file) handleFile(file, fromLibrary);
    };
  }

  if (busy) {
    return (
      <div class="busy">
        <div class="spinner" />
        {busy}
      </div>
    );
  }

  return (
    <div>
      <h1>Plant Cards</h1>
      {error && <div class="error">{error}</div>}
      {!settings.apiKey && (
        <div class="error">No OpenRouter API key set — add it in Settings before identifying.</div>
      )}
      <button class="big" onClick={() => camRef.current?.click()}>
        📷 Take a photo
      </button>
      <button class="big secondary" onClick={() => libRef.current?.click()}>
        🖼 Pick from library
      </button>
      <p class="hint">
        The photo is identified via OpenRouter, then saved locally with date and location. Allow
        location access for the map to work.
      </p>
      <input ref={camRef} type="file" accept="image/*" capture="environment" hidden onChange={onChange(false)} />
      <input ref={libRef} type="file" accept="image/*" hidden onChange={onChange(true)} />
    </div>
  );
}
