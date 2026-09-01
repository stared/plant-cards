import { useEffect, useState } from 'preact/hooks';
import { db, UNIDENTIFIED, speciesGroups, type SpeciesGroup } from '../db';
import { grade, newSrs } from '../srs';
import { BlobImg, shuffle } from './util';

// Distractor pool for when the collection is still small.
const FALLBACK = [
  { latin: 'Taraxacum officinale', namePl: 'mniszek lekarski' },
  { latin: 'Urtica dioica', namePl: 'pokrzywa zwyczajna' },
  { latin: 'Plantago major', namePl: 'babka zwyczajna' },
  { latin: 'Achillea millefolium', namePl: 'krwawnik pospolity' },
  { latin: 'Bellis perennis', namePl: 'stokrotka pospolita' },
  { latin: 'Quercus robur', namePl: 'dąb szypułkowy' },
  { latin: 'Betula pendula', namePl: 'brzoza brodawkowata' },
  { latin: 'Acer platanoides', namePl: 'klon zwyczajny' },
  { latin: 'Tilia cordata', namePl: 'lipa drobnolistna' },
  { latin: 'Trifolium repens', namePl: 'koniczyna biała' },
];

interface Question {
  species: SpeciesGroup;
  photo: Blob;
  options: string[];
  correctOption: string;
  dueCount: number;
}

function displayName(s: { namePl: string; latin: string }): string {
  return s.namePl || s.latin;
}

export function Cards() {
  const [question, setQuestion] = useState<Question | null | 'empty' | 'done'>(null);
  const [picked, setPicked] = useState<string | null>(null);
  const [practiceAnyway, setPracticeAnyway] = useState(false);

  async function nextQuestion(anyway = practiceAnyway) {
    setPicked(null);
    const groups = (await speciesGroups()).filter((g) => g.latin !== UNIDENTIFIED);
    if (groups.length === 0) return setQuestion('empty');

    const now = Date.now();
    const srsMap = new Map((await db.srs.toArray()).map((s) => [s.latin, s]));
    const withDue = groups.map((g) => ({ g, srs: srsMap.get(g.latin) ?? newSrs(g.latin) }));
    const due = withDue.filter((x) => x.srs.due <= now);
    const dueCount = due.length;

    let pool = due;
    if (pool.length === 0) {
      if (!anyway) return setQuestion('done');
      pool = withDue;
    }
    pool.sort((a, b) => a.srs.due - b.srs.due);
    const pick = pool[Math.floor(Math.random() * Math.min(3, pool.length))];
    const species = pick.g;
    const photo = species.entries[Math.floor(Math.random() * species.entries.length)].photo;

    const correctOption = displayName(species);
    const others = groups.filter((g) => g.latin !== species.latin).map(displayName);
    const fallback = FALLBACK.filter(
      (f) => f.latin !== species.latin && !others.includes(f.namePl) && f.namePl !== correctOption,
    ).map(displayName);
    const distractors = [...shuffle(others), ...shuffle(fallback)].slice(0, 3);
    const options = shuffle([correctOption, ...distractors]);

    setQuestion({ species, photo, options, correctOption, dueCount });
  }

  useEffect(() => {
    nextQuestion();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  if (question === null) return <div class="busy">Loading…</div>;
  if (question === 'empty')
    return (
      <div>
        <div class="title">Cards</div>
        <p class="hint">No identified plants yet — snap a few first.</p>
      </div>
    );
  if (question === 'done')
    return (
      <div class="card">
        <div class="title">Cards</div>
        <div class="busy">
          <span>Nothing due right now.</span>
          <button
            class="btn"
            onClick={() => {
              setPracticeAnyway(true);
              nextQuestion(true);
            }}
          >
            Practice anyway
          </button>
        </div>
      </div>
    );

  const q = question;
  const answered = picked !== null;
  const wasRight = picked === q.correctOption;

  async function answer(opt: string) {
    if (answered) return;
    setPicked(opt);
    await grade(q.species.latin, opt === q.correctOption);
  }

  // After answering, collapse to the options that matter.
  const shown = answered ? q.options.filter((o) => o === q.correctOption || o === picked) : q.options;
  const s = q.species;

  return (
    <div class="card">
      <div class="row spread">
        <div class="title" style="margin:0">
          {answered ? (wasRight ? 'Correct' : 'Not quite') : 'What plant is this?'}
        </div>
        <span class="muted">{q.dueCount > 0 ? `${q.dueCount} due` : 'practice'}</span>
      </div>
      <BlobImg blob={q.photo} class="card-photo" />
      {shown.map((opt) => {
        let cls = 'option';
        if (answered && opt === q.correctOption) cls += ' correct';
        else if (answered && opt === picked) cls += ' wrong';
        return (
          <button key={opt} class={cls} onClick={() => answer(opt)}>
            {opt}
          </button>
        );
      })}
      {answered && (
        <div class="reveal">
          <div class="sub">
            <i>{s.latin}</i>
            {s.nameEn ? ` · ${s.nameEn}` : ''}
          </div>
          {s.entries[0].description && <p class="desc clamp-3" style="margin-top:6px">{s.entries[0].description}</p>}
        </div>
      )}
      {answered && (
        <div class="next">
          <button class="btn primary block" onClick={() => nextQuestion()}>
            Next
          </button>
        </div>
      )}
    </div>
  );
}
