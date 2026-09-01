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
  options: string[]; // Polish names (or latin if missing)
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
      pool = withDue; // practice mode: anything goes
    }
    // Most overdue first, with a bit of randomness among the top few.
    pool.sort((a, b) => a.srs.due - b.srs.due);
    const pick = pool[Math.floor(Math.random() * Math.min(3, pool.length))];
    const species = pick.g;
    const photo = species.entries[Math.floor(Math.random() * species.entries.length)].photo;

    const correctOption = displayName(species);
    const others = groups.filter((g) => g.latin !== species.latin).map(displayName);
    const fallback = FALLBACK.filter(
      (f) => f.latin !== species.latin && !others.includes(f.namePl) && f.namePl !== correctOption,
    ).map(displayName);
    const distractors = shuffle([...shuffle(others), ...shuffle(fallback)].slice(0, 20)).slice(0, 3);
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
        <h1>Flashcards</h1>
        <p class="hint">No identified plants yet — snap a few first.</p>
      </div>
    );
  if (question === 'done')
    return (
      <div>
        <h1>Flashcards</h1>
        <p class="hint">All done for now — nothing due. 🎉</p>
        <div class="row-buttons">
          <button
            class="small"
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

  const answered = picked !== null;
  const q = question;

  async function answer(opt: string) {
    if (answered) return;
    setPicked(opt);
    await grade(q.species.latin, opt === q.correctOption);
  }

  const s = question.species;
  return (
    <div>
      <p class="stats-line">
        {question.dueCount > 0 ? `${question.dueCount} due` : 'practice mode'}
      </p>
      <BlobImg blob={question.photo} class="card-photo" />
      <h2 style="margin-bottom:10px">What plant is this?</h2>
      {question.options.map((opt) => {
        let cls = 'option';
        if (answered && opt === question.correctOption) cls += ' correct';
        else if (answered && opt === picked) cls += ' wrong';
        return (
          <button key={opt} class={cls} onClick={() => answer(opt)}>
            {opt}
          </button>
        );
      })}
      {answered && (
        <div class="reveal">
          <b>{displayName(s)}</b>
          <div class="latin-name">
            {s.latin}
            {s.nameEn ? ` · ${s.nameEn}` : ''}
          </div>
          {s.entries[0].description && <div>{s.entries[0].description}</div>}
          <div class="row-buttons">
            <button class="small" onClick={() => nextQuestion()}>
              Next →
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
