import { useEffect, useState } from 'preact/hooks';
import type { Nav } from '../app';
import { db, UNIDENTIFIED, type Entry } from '../db';
import { getSettings } from '../settings';
import { displayName } from '../species';
import { BlobImg } from './util';
import { Icon } from './icons';

export function Species({ latin, nav }: { latin: string; nav: Nav }) {
  const [entries, setEntries] = useState<Entry[] | null>(null);
  const [expanded, setExpanded] = useState(false);
  const lang = getSettings().descLang;

  useEffect(() => {
    db.entries.where('latin').equals(latin).sortBy('takenAt').then((e) => setEntries(e.reverse()));
  }, [latin]);

  if (!entries) return <div class="busy">Loading…</div>;
  const first = entries[0];
  const unidentified = latin === UNIDENTIFIED;
  const otherName = first && (lang === 'pl' ? first.nameEn : first.namePl);

  return (
    <div>
      <button class="back" onClick={() => nav.back({ view: 'collection' })}>
        <Icon name="back" size={18} /> Plants
      </button>
      <div class="headline">{unidentified ? 'Unidentified' : first ? displayName(first, lang) : latin}</div>
      {!unidentified && (
        <div class="sub">
          <i>{latin}</i>
          {otherName ? ` · ${otherName}` : ''}
        </div>
      )}
      {first?.description && (
        <p class={expanded ? 'desc' : 'desc clamp-3'} style="margin-top:8px" onClick={() => setExpanded(!expanded)}>
          {first.description}
        </p>
      )}
      <div class="label" style="margin-top:14px">
        {entries.length} photo{entries.length === 1 ? '' : 's'}
      </div>
      {entries.length === 0 && <p class="hint">No photos left under this name.</p>}
      <div class="grid">
        {entries.map((e) => (
          <BlobImg key={e.id} blob={e.photo} onClick={() => nav.go({ view: 'entry', id: e.id! })} />
        ))}
      </div>
    </div>
  );
}
