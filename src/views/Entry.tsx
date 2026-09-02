import { useEffect, useState } from 'preact/hooks';
import type { Nav } from '../app';
import { db, renameSpecies, UNIDENTIFIED, type Entry } from '../db';
import { identify } from '../identify';
import { getSettings, modelOf } from '../settings';
import { applyIdentification, displayName, normalizeLatin, type Names } from '../species';
import { ensureSrs } from '../srs';
import { BlobImg, fmtDate } from './util';
import { Icon } from './icons';

export function EntryView({ id, nav }: { id: number; nav: Nav }) {
  const [entry, setEntry] = useState<Entry | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [fit, setFit] = useState(false); // tap photo: cropped ↔ whole photo
  const lang = getSettings().descLang;

  useEffect(() => {
    db.entries.get(id).then((e) => setEntry(e ?? null));
  }, [id]);

  if (!entry) return <div class="busy">Loading…</div>;
  const e = entry;

  async function update(patch: Partial<Entry>) {
    await db.entries.update(id, patch);
    setEntry({ ...e, ...patch });
  }

  /** Re-label this photo; if the species has other photos, offer to re-label them too. */
  async function relabel(to: Names, extra: Partial<Entry> = {}) {
    await ensureSrs(to.latin);
    const others = e.latin === UNIDENTIFIED ? 0 : (await db.entries.where('latin').equals(e.latin).count()) - 1;
    if (
      others > 0 &&
      to.latin !== e.latin &&
      window.confirm(`Also relabel the other ${others} photo${others > 1 ? 's' : ''} of ${displayName(e, lang)}? (Cancel = only this one)`)
    ) {
      await renameSpecies(e.latin, to);
    }
    await update({ ...to, ...extra, review: false });
  }

  function pickCandidate(i: number) {
    const c = e.candidates[i];
    return relabel({ latin: c.latin, namePl: c.namePl, nameEn: c.nameEn }, { confidence: c.confidence });
  }

  async function editManually() {
    const raw = window.prompt('Scientific (Latin) name:', e.latin === UNIDENTIFIED ? '' : e.latin);
    const latin = raw ? normalizeLatin(raw) : '';
    if (!latin) return;
    const namePl = (window.prompt('Polish name:', e.namePl) ?? e.namePl).trim();
    const nameEn = (window.prompt('English name:', e.nameEn) ?? e.nameEn).trim();
    await relabel({ latin, namePl, nameEn });
  }

  async function reIdentify() {
    setBusy(true);
    setError(null);
    try {
      const settings = getSettings();
      const r = await identify(e.photo, settings);
      if (r.candidates.length === 0) {
        setError('Still no plant recognized.');
      } else {
        await ensureSrs(r.candidates[0].latin);
        await update(applyIdentification(r, modelOf(settings)));
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    }
    setBusy(false);
  }

  async function remove() {
    if (!window.confirm('Delete this photo?')) return;
    await db.entries.delete(id);
    nav.back({ view: 'collection' });
  }

  const unidentified = e.latin === UNIDENTIFIED;
  const pct = e.confidence > 0 ? `${Math.round(e.confidence * 100)}%` : '';
  const otherName = lang === 'pl' ? e.nameEn : e.namePl;

  return (
    <div>
      <button class="back" onClick={() => nav.back(unidentified ? { view: 'collection' } : { view: 'species', latin: e.latin })}>
        <Icon name="back" size={18} /> {unidentified ? 'Plants' : displayName(e, lang)}
      </button>
      <BlobImg blob={e.photo} class={fit ? 'hero fit' : 'hero'} onClick={() => setFit(!fit)} />
      {error && <div class="notice error">{error}</div>}

      <div class="headline">{unidentified ? 'Unidentified' : displayName(e, lang)}</div>
      {!unidentified && (
        <div class="sub">
          <i>{e.latin}</i>
          {otherName ? ` · ${otherName}` : ''}
          {pct && (
            <span class="muted">
              {' '}
              · {e.review && <span class="dot" />}
              {pct}
            </span>
          )}
        </div>
      )}

      {e.candidates.length > 1 && (
        <div class="chips">
          {e.candidates.map((c, i) => (
            <button key={c.latin} class={c.latin === e.latin ? 'chip selected' : 'chip'} onClick={() => pickCandidate(i)}>
              {displayName(c, lang)} · {Math.round(c.confidence * 100)}%
            </button>
          ))}
        </div>
      )}

      <div class="meta">
        <span>{fmtDate(e.takenAt)}</span>
        {e.lat != null && e.lon != null ? (
          <a
            href={`https://maps.apple.com/?ll=${e.lat},${e.lon}&q=${encodeURIComponent(displayName(e, lang))}`}
            target="_blank"
            rel="noreferrer"
          >
            <Icon name="pin" size={13} />
            {e.lat.toFixed(4)}, {e.lon.toFixed(4)}
          </a>
        ) : (
          <span>no location</span>
        )}
      </div>

      {e.description && <p class="desc">{e.description}</p>}

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
