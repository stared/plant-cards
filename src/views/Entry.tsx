import { useEffect, useState } from 'preact/hooks';
import type { Route } from '../app';
import { db, UNIDENTIFIED, type Entry } from '../db';
import { identify } from '../identify';
import { getSettings } from '../settings';
import { ensureSrs } from '../srs';
import { BlobImg, fmtDate } from './util';
import { Icon } from './icons';

export function EntryView({ id, navigate }: { id: number; navigate: (r: Route) => void }) {
  const [entry, setEntry] = useState<Entry | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [fit, setFit] = useState(false); // tap photo: cropped ↔ whole photo

  useEffect(() => {
    db.entries.get(id).then((e) => setEntry(e ?? null));
  }, [id]);

  if (!entry) return <div class="busy">Loading…</div>;

  async function update(patch: Partial<Entry>) {
    await db.entries.update(id, patch);
    setEntry({ ...entry!, ...patch });
  }

  async function pickCandidate(i: number) {
    const c = entry!.candidates[i];
    await ensureSrs(c.latin);
    await update({ latin: c.latin, namePl: c.namePl, nameEn: c.nameEn, confidence: c.confidence, review: false });
  }

  async function editManually() {
    const latin = window.prompt('Scientific (Latin) name:', entry!.latin === UNIDENTIFIED ? '' : entry!.latin);
    if (!latin?.trim()) return;
    const namePl = window.prompt('Polish name:', entry!.namePl) ?? entry!.namePl;
    const nameEn = window.prompt('English name:', entry!.nameEn) ?? entry!.nameEn;
    await ensureSrs(latin.trim());
    await update({ latin: latin.trim(), namePl: namePl.trim(), nameEn: nameEn.trim(), review: false });
  }

  async function reIdentify() {
    setBusy(true);
    setError(null);
    try {
      const settings = getSettings();
      const r = await identify(entry!.photo, settings);
      if (r.candidates.length === 0) {
        setError('Still no plant recognized.');
      } else {
        const top = r.candidates[0];
        await ensureSrs(top.latin);
        await update({
          latin: top.latin,
          namePl: top.namePl,
          nameEn: top.nameEn,
          confidence: top.confidence,
          candidates: r.candidates,
          description: r.description,
          model: settings.model,
          review: top.confidence < 0.75,
        });
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    }
    setBusy(false);
  }

  async function remove() {
    if (!window.confirm('Delete this photo?')) return;
    await db.entries.delete(id);
    navigate({ view: 'collection' });
  }

  const unidentified = entry.latin === UNIDENTIFIED;
  const pct = entry.confidence > 0 ? `${Math.round(entry.confidence * 100)}%` : '';

  return (
    <div>
      <button class="back" onClick={() => navigate(unidentified ? { view: 'collection' } : { view: 'species', latin: entry.latin })}>
        <Icon name="back" size={18} /> {unidentified ? 'Plants' : entry.namePl || entry.latin}
      </button>
      <BlobImg blob={entry.photo} class={fit ? 'hero fit' : 'hero'} onClick={() => setFit(!fit)} />
      {error && <div class="notice error">{error}</div>}

      <div class="headline">{unidentified ? 'Unidentified' : entry.namePl || entry.nameEn || entry.latin}</div>
      {!unidentified && (
        <div class="sub">
          <i>{entry.latin}</i>
          {entry.nameEn ? ` · ${entry.nameEn}` : ''}
          {pct && (
            <span class="muted">
              {' '}
              · {entry.review && <span class="dot" />}
              {pct}
            </span>
          )}
        </div>
      )}

      {entry.candidates.length > 1 && (
        <div class="chips">
          {entry.candidates.map((c, i) => (
            <button key={c.latin} class={c.latin === entry.latin ? 'chip selected' : 'chip'} onClick={() => pickCandidate(i)}>
              {c.namePl || c.latin} · {Math.round(c.confidence * 100)}%
            </button>
          ))}
        </div>
      )}

      <div class="meta">
        <span>{fmtDate(entry.takenAt)}</span>
        {entry.lat != null && entry.lon != null ? (
          <a
            href={`https://maps.apple.com/?ll=${entry.lat},${entry.lon}&q=${encodeURIComponent(entry.namePl || entry.latin)}`}
            target="_blank"
            rel="noreferrer"
          >
            <Icon name="pin" size={13} />
            {entry.lat.toFixed(4)}, {entry.lon.toFixed(4)}
          </a>
        ) : (
          <span>no location</span>
        )}
      </div>

      {entry.description && <p class="desc">{entry.description}</p>}

      <div class="divider" />
      <div class="row">
        {busy ? (
          <span class="muted">Identifying…</span>
        ) : (
          <>
            <button class="btn sm" onClick={reIdentify}>
              <Icon name="refresh" size={15} /> Re-identify
            </button>
            <button class="btn sm" onClick={editManually}>
              <Icon name="edit" size={15} /> Edit
            </button>
            <button class="btn sm ghost danger" onClick={remove} style="margin-left:auto">
              <Icon name="trash" size={15} />
            </button>
          </>
        )}
      </div>
    </div>
  );
}
