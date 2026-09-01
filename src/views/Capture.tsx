import { useEffect, useRef, useState } from 'preact/hooks';
import type { Route } from '../app';
import { db, UNIDENTIFIED, type Entry } from '../db';
import { downscale } from '../image';
import { getPosition, exifLocation, exifDate } from '../geo';
import { identify } from '../identify';
import { getSettings } from '../settings';
import { ensureSrs } from '../srs';
import { BlobImg } from './util';
import { Icon } from './icons';

const REVIEW_THRESHOLD = 0.75;

export function Capture({ navigate }: { navigate: (r: Route) => void }) {
  const camRef = useRef<HTMLInputElement>(null);
  const libRef = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [recent, setRecent] = useState<Entry[]>([]);

  const settings = getSettings();

  useEffect(() => {
    db.entries.orderBy('takenAt').reverse().limit(4).toArray().then(setRecent);
  }, []);

  async function handleFile(file: File, fromLibrary: boolean) {
    setError(null);
    setBusy('Reading photo');
    try {
      const locPromise = (async () => {
        if (fromLibrary) {
          const fromExif = await exifLocation(file);
          if (fromExif) return fromExif;
        }
        return getPosition();
      })();
      const takenAtPromise = fromLibrary ? exifDate(file) : Promise.resolve(null);

      const photo = await downscale(file);
      setBusy('Identifying');
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
        setError(`Identification failed — photo saved, retry from the entry. ${result.message}`);
      } else if (result.candidates.length === 0) {
        setError('No plant recognized. Saved as unidentified.');
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
        <span>{busy}…</span>
      </div>
    );
  }

  return (
    <div class="capture">
      <div class="title">Plant Cards</div>
      {error && <div class="notice error">{error}</div>}
      {!settings.apiKey && <div class="notice">No OpenRouter API key yet — add it in Settings.</div>}

      {recent.length > 0 && (
        <div>
          <div class="label">Recent</div>
          <div class="recent">
            {recent.map((e) => (
              <BlobImg key={e.id} blob={e.photo} onClick={() => navigate({ view: 'entry', id: e.id! })} />
            ))}
          </div>
        </div>
      )}

      <div class="actions">
        <button class="btn primary block lg" onClick={() => camRef.current?.click()}>
          <Icon name="camera" /> Take a photo
        </button>
        <button class="btn ghost block" onClick={() => libRef.current?.click()}>
          <Icon name="image" size={18} /> Choose from library
        </button>
      </div>

      <input ref={camRef} type="file" accept="image/*" capture="environment" hidden onChange={onChange(false)} />
      <input ref={libRef} type="file" accept="image/*" hidden onChange={onChange(true)} />
    </div>
  );
}
