import { useEffect, useState } from 'preact/hooks';
import type { Route } from '../app';
import { speciesGroups, UNIDENTIFIED, type SpeciesGroup } from '../db';
import { BlobImg } from './util';

export function Collection({ navigate }: { navigate: (r: Route) => void }) {
  const [groups, setGroups] = useState<SpeciesGroup[] | null>(null);

  useEffect(() => {
    speciesGroups().then(setGroups);
  }, []);

  if (!groups) return <div class="busy">Loading…</div>;
  if (groups.length === 0)
    return (
      <div>
        <h1>Plants</h1>
        <p class="hint">Nothing here yet — snap your first plant!</p>
      </div>
    );

  return (
    <div>
      <h1>Plants ({groups.length} species)</h1>
      {groups.map((g) => (
        <div key={g.latin} class="species-row" onClick={() => navigate({ view: 'species', latin: g.latin })}>
          <BlobImg blob={g.entries[0].photo} />
          <div class="names">
            <div>{g.latin === UNIDENTIFIED ? 'Unidentified' : g.namePl || g.nameEn || g.latin}</div>
            {g.latin !== UNIDENTIFIED && <div class="latin">{g.latin}</div>}
          </div>
          <div class="count">×{g.entries.length}</div>
        </div>
      ))}
    </div>
  );
}
