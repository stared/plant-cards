import { useEffect, useState } from 'preact/hooks';
import type { Nav } from '../app';
import { speciesGroups, UNIDENTIFIED, type SpeciesGroup } from '../db';
import { getSettings } from '../settings';
import { displayName } from '../species';
import { BlobImg } from './util';

export function Collection({ nav }: { nav: Nav }) {
  const [groups, setGroups] = useState<SpeciesGroup[] | null>(null);
  const lang = getSettings().descLang;

  useEffect(() => {
    speciesGroups().then(setGroups);
  }, []);

  if (!groups) return <div class="busy">Loading…</div>;

  const photos = groups.reduce((n, g) => n + g.entries.length, 0);

  return (
    <div>
      <div class="row spread" style="margin-bottom:10px">
        <div class="title" style="margin:0">
          Plants
        </div>
        <span class="muted">
          {groups.length} species · {photos} photos
        </span>
      </div>
      {groups.length === 0 && <p class="hint">Nothing here yet — snap your first plant.</p>}
      {groups.map((g) => {
        const unidentified = g.latin === UNIDENTIFIED;
        const needsReview = !unidentified && g.entries.some((e) => e.review);
        return (
          <div key={g.latin} class="list-row" onClick={() => nav.go({ view: 'species', latin: g.latin })}>
            <BlobImg blob={g.entries[0].photo} />
            <div class="names">
              <div>
                {needsReview && <span class="dot" />}
                {unidentified ? 'Unidentified' : displayName(g, lang)}
              </div>
              {!unidentified && <div class="latin">{g.latin}</div>}
            </div>
            <div class="count">{g.entries.length}</div>
          </div>
        );
      })}
    </div>
  );
}
