import { useEffect, useRef, useState } from 'preact/hooks';
import type { Nav } from '../app';
import { db, UNIDENTIFIED, type Entry } from '../db';
import { downscale } from '../image';
import { getPosition, exifLocation, exifDate, type Loc } from '../geo';
import { identify } from '../identify';
import { getSettings, modelOf } from '../settings';
import { applyIdentification } from '../species';
import { ensureSrs } from '../srs';
import { BlobImg } from './util';
import { Icon } from './icons';

// A library photo without EXIF GPS gets the current position only if it was taken just now;
// otherwise we would tag an old photo with wherever the phone is today.
const RECENT_MS = 60 * 60 * 1000;

async function locate(file: File, fromLibrary: boolean): Promise<{ loc: Loc | null; takenAt: number }> {
  if (!fromLibrary) return { loc: await getPosition(), takenAt: Date.now() };
  const [exifLoc, exifTakenAt] = await Promise.all([exifLocation(file), exifDate(file)]);
  const takenAt = exifTakenAt ?? Date.now();
  if (exifLoc) return { loc: exifLoc, takenAt };
  const recent = Math.abs(Date.now() - takenAt) < RECENT_MS;
  return { loc: recent ? await getPosition() : null, takenAt };
}

export function Capture({ nav }: { nav: Nav }) {
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
      const locPromise = locate(file, fromLibrary);
      const photo = await downscale(file);
      setBusy('Identifying');
      const idPromise = identify(photo, settings).catch((e: Error) => e);

      // Save first so the photo survives a failed/aborted identification (or an app reload).
      const { loc, takenAt } = await locPromise;
      const id = (await db.entries.add({
        latin: UNIDENTIFIED,
        namePl: '',
        nameEn: '',
        description: '',
        candidates: [],
        confidence: 0,
        takenAt,
        lat: loc?.lat ?? null,
        lon: loc?.lon ?? null,
        locSource: loc?.source ?? 'none',
        photo,
        model: modelOf(settings),
        review: true,
      })) as number;

      const result = await idPromise;
      if (result instanceof Error) {
        setError(`Identification failed — photo saved, retry from the entry. ${result.message}`);
      } else {
        if (result.candidates.length === 0) setError('No plant recognized. Saved as unidentified.');
        else await ensureSrs(result.candidates[0].latin);
        await db.entries.update(id, applyIdentification(result, modelOf(settings)));
      }
      setBusy(null);
      nav.go({ view: 'entry', id });
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
              <BlobImg key={e.id} blob={e.photo} onClick={() => nav.go({ view: 'entry', id: e.id! })} />
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
