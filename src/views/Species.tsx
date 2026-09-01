import { useEffect, useState } from 'preact/hooks';
import type { Route } from '../app';
import { db, UNIDENTIFIED, type Entry } from '../db';
import { BlobImg } from './util';
import { Icon } from './icons';

export function Species({ latin, navigate }: { latin: string; navigate: (r: Route) => void }) {
  const [entries, setEntries] = useState<Entry[] | null>(null);
  const [expanded, setExpanded] = useState(false);

  useEffect(() => {
    db.entries.where('latin').equals(latin).sortBy('takenAt').then((e) => setEntries(e.reverse()));
  }, [latin]);

  if (!entries) return <div class="busy">Loading…</div>;
  const first = entries[0];
  const unidentified = latin === UNIDENTIFIED;

  return (
    <div>
      <button class="back" onClick={() => navigate({ view: 'collection' })}>
        <Icon name="back" size={18} /> Plants
      </button>
      <div class="headline">{unidentified ? 'Unidentified' : first?.namePl || first?.nameEn || latin}</div>
      {!unidentified && (
        <div class="sub">
          <i>{latin}</i>
          {first?.nameEn ? ` · ${first.nameEn}` : ''}
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
      <div class="grid">
        {entries.map((e) => (
          <BlobImg key={e.id} blob={e.photo} onClick={() => navigate({ view: 'entry', id: e.id! })} />
        ))}
      </div>
    </div>
  );
}
