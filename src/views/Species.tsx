import { useEffect, useState } from 'preact/hooks';
import type { Route } from '../app';
import { db, UNIDENTIFIED, type Entry } from '../db';
import { BlobImg, fmtDate } from './util';

export function Species({ latin, navigate }: { latin: string; navigate: (r: Route) => void }) {
  const [entries, setEntries] = useState<Entry[] | null>(null);

  useEffect(() => {
    db.entries.where('latin').equals(latin).reverse().sortBy('takenAt').then((e) => setEntries(e.reverse()));
  }, [latin]);

  if (!entries) return <div class="busy">Loading…</div>;
  const first = entries[0];

  return (
    <div>
      <button class="back" onClick={() => navigate({ view: 'collection' })}>
        ‹ Plants
      </button>
      <h1>{latin === UNIDENTIFIED ? 'Unidentified' : first?.namePl || first?.nameEn || latin}</h1>
      {latin !== UNIDENTIFIED && (
        <p class="latin-name">
          {latin}
          {first?.nameEn ? ` · ${first.nameEn}` : ''}
        </p>
      )}
      {first?.description && <p class="desc">{first.description}</p>}
      <div class="grid">
        {entries.map((e) => (
          <BlobImg key={e.id} blob={e.photo} onClick={() => navigate({ view: 'entry', id: e.id! })} />
        ))}
      </div>
      <p class="meta">
        {entries.length} photo{entries.length === 1 ? '' : 's'}
        {entries.length > 0 && ` · latest ${fmtDate(entries[0].takenAt)}`}
      </p>
    </div>
  );
}
