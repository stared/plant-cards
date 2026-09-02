import { useEffect, useRef, useState } from 'preact/hooks';
import { db, UNIDENTIFIED, speciesGroups, type SpeciesGroup, type Srs } from '../db';
import { getSettings } from '../settings';
import { displayName, type Names } from '../species';
import { grade, isLearning, newSrs } from '../srs';
import { BlobImg, shuffle } from './util';

// Distractor pool for when the collection is still small.
const FALLBACK: Names[] = [
  { latin: 'Taraxacum officinale', namePl: 'mniszek lekarski', nameEn: 'dandelion' },
  { latin: 'Urtica dioica', namePl: 'pokrzywa zwyczajna', nameEn: 'stinging nettle' },
  { latin: 'Plantago major', namePl: 'babka zwyczajna', nameEn: 'greater plantain' },
  { latin: 'Achillea millefolium', namePl: 'krwawnik pospolity', nameEn: 'yarrow' },
  { latin: 'Bellis perennis', namePl: 'stokrotka pospolita', nameEn: 'daisy' },
  { latin: 'Quercus robur', namePl: 'dąb szypułkowy', nameEn: 'pedunculate oak' },
  { latin: 'Betula pendula', namePl: 'brzoza brodawkowata', nameEn: 'silver birch' },
  { latin: 'Acer platanoides', namePl: 'klon zwyczajny', nameEn: 'Norway maple' },
  { latin: 'Tilia cordata', namePl: 'lipa drobnolistna', nameEn: 'small-leaved lime' },
  { latin: 'Trifolium repens', namePl: 'koniczyna biała', nameEn: 'white clover' },
];

export interface Question {
  species: SpeciesGroup;
  photo: Blob;
  options: string[];
  correctOption: string;
  dueCount: number;
}

export interface PickOpts {
  lang: 'pl' | 'en';
  anyway: boolean; // practice even if nothing is due
  exclude?: string; // latin of the previous question, avoided when possible
  now?: number;
}

/** Next question, or 'empty' (no species) / 'done' (nothing due and not practicing anyway). */
export function pickQuestion(groups: SpeciesGroup[], srsList: Srs[], opts: PickOpts): Question | 'empty' | 'done' {
  const now = opts.now ?? Date.now();
  groups = groups.filter((g) => g.latin !== UNIDENTIFIED);
  if (groups.length === 0) return 'empty';

  const srsMap = new Map(srsList.map((s) => [s.latin, s]));
  const withSrs = groups.map((g) => ({ g, srs: srsMap.get(g.latin) ?? newSrs(g.latin, now) }));
  // Learning items (answered wrong) stay in the session instead of vanishing for 10 minutes.
  const due = withSrs.filter((x) => x.srs.due <= now || isLearning(x.srs));
  const dueCount = due.length;

  let pool = due.length > 0 ? due : opts.anyway ? withSrs : [];
  if (pool.length === 0) return 'done';
  if (pool.length > 1 && opts.exclude) pool = pool.filter((x) => x.g.latin !== opts.exclude);
  pool.sort((a, b) => a.srs.due - b.srs.due);
  const species = pool[Math.floor(Math.random() * Math.min(3, pool.length))].g;
  const photo = species.entries[Math.floor(Math.random() * species.entries.length)].photo;

  // Distractors: other species first, then the fallback list; never a duplicate label.
  const name = (n: Names) => displayName(n, opts.lang);
  const correctOption = name(species);
  const taken = new Set([correctOption]);
  const distractors: string[] = [];
  for (const n of [...shuffle(groups), ...shuffle(FALLBACK)]) {
    if (n.latin === species.latin) continue;
    const label = name(n);
    if (taken.has(label)) continue;
    taken.add(label);
    distractors.push(label);
    if (distractors.length === 3) break;
  }

  return { species, photo, options: shuffle([correctOption, ...distractors]), correctOption, dueCount };
}

export function Cards() {
  const [question, setQuestion] = useState<Question | null | 'empty' | 'done'>(null);
  const [picked, setPicked] = useState<string | null>(null);
  const [practiceAnyway, setPracticeAnyway] = useState(false);
  const lastLatin = useRef<string | undefined>(undefined);
  const lang = getSettings().descLang;

  async function nextQuestion(anyway = practiceAnyway) {
    setPicked(null);
    const [groups, srsList] = await Promise.all([speciesGroups(), db.srs.toArray()]);
    const q = pickQuestion(groups, srsList, { lang, anyway, exclude: lastLatin.current });
    if (typeof q === 'object') lastLatin.current = q.species.latin;
    setQuestion(q);
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
  const otherName = lang === 'pl' ? s.nameEn : s.namePl;

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
            {otherName ? ` · ${otherName}` : ''}
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
