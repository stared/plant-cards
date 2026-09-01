// Dev-only helpers: `#seed` fills the DB with fake entries, `#view=cards` / `#view=entry&id=1`
// opens a screen directly. Tree-shaken out of production builds (guarded by import.meta.env.DEV).
import { zlibSync } from 'fflate';
import { db } from './db';
import type { Route } from './app';

function hsl(h: number, s: number, l: number): [number, number, number] {
  const a = (s * Math.min(l, 1 - l)) / 100;
  const f = (n: number) => {
    const k = (n + h / 30) % 12;
    return Math.round(255 * (l - a * Math.max(-1, Math.min(k - 3, 9 - k, 1))));
  };
  return [f(0), f(8), f(4)];
}

// Hand-rolled PNG (no canvas — canvas.toBlob hangs in headless screenshots).
function fakePhoto(hue: number): Promise<Blob> {
  const W = 400;
  const H = 500;
  const raw = new Uint8Array(H * (W * 3 + 1));
  const bg0 = hsl(hue, 40, 0.3);
  const bg1 = hsl(hue + 40, 50, 0.15);
  const leaf = hsl(hue + 20, 60, 0.55);
  for (let y = 0; y < H; y++) {
    const row = y * (W * 3 + 1);
    raw[row] = 0;
    for (let x = 0; x < W; x++) {
      const t = (x + y) / (W + H);
      let px: [number, number, number] = [0, 1, 2].map((i) => Math.round(bg0[i] + (bg1[i] - bg0[i]) * t)) as [number, number, number];
      for (let i = 0; i < 12; i++) {
        const cx = 75 + (i % 4) * 85;
        const cy = 100 + Math.floor(i / 4) * 125;
        const dx = (x - cx) / 30;
        const dy = (y - cy) / 55;
        if (dx * dx + dy * dy < 1) px = leaf;
      }
      raw.set(px, row + 1 + x * 3);
    }
  }
  const crcTable = new Uint32Array(256).map((_, n) => {
    let c = n;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    return c >>> 0;
  });
  const crc = (b: Uint8Array) => {
    let c = 0xffffffff;
    for (const x of b) c = crcTable[(c ^ x) & 0xff] ^ (c >>> 8);
    return (c ^ 0xffffffff) >>> 0;
  };
  const u32 = (n: number) => new Uint8Array([n >>> 24, (n >>> 16) & 255, (n >>> 8) & 255, n & 255]);
  const chunk = (type: string, data: Uint8Array) => {
    const t = new TextEncoder().encode(type);
    const td = new Uint8Array(t.length + data.length);
    td.set(t);
    td.set(data, t.length);
    return [u32(data.length), td, u32(crc(td))];
  };
  const ihdr = new Uint8Array([...u32(W), ...u32(H), 8, 2, 0, 0, 0]);
  const parts = [
    new Uint8Array([137, 80, 78, 71, 13, 10, 26, 10]),
    ...chunk('IHDR', ihdr),
    ...chunk('IDAT', zlibSync(raw, { level: 1 })),
    ...chunk('IEND', new Uint8Array()),
  ];
  return Promise.resolve(new Blob(parts as BlobPart[], { type: 'image/png' }));
}

export async function seed() {
  if ((await db.entries.count()) > 0) return;
  const species = [
    { latin: 'Quercus robur', namePl: 'dąb szypułkowy', nameEn: 'pedunculate oak', hue: 100 },
    { latin: 'Urtica dioica', namePl: 'pokrzywa zwyczajna', nameEn: 'stinging nettle', hue: 140 },
    { latin: 'Taraxacum officinale', namePl: 'mniszek lekarski', nameEn: 'dandelion', hue: 60 },
    { latin: 'Acer platanoides', namePl: 'klon zwyczajny', nameEn: 'Norway maple', hue: 20 },
  ];
  let t = Date.now();
  for (const s of species) {
    for (let k = 0; k < 2; k++) {
      t -= 3_600_000 * 7;
      await db.entries.add({
        latin: s.latin,
        namePl: s.namePl,
        nameEn: s.nameEn,
        description:
          'Rozpoznasz go po klapowanych liściach i żołędziach na długich szypułkach. Potrafi żyć kilkaset lat; stare dęby są często pomnikami przyrody i domem dla setek gatunków owadów.',
        candidates: [
          { latin: s.latin, namePl: s.namePl, nameEn: s.nameEn, confidence: 0.82 },
          { latin: 'Quercus petraea', namePl: 'dąb bezszypułkowy', nameEn: 'sessile oak', confidence: 0.14 },
          { latin: 'Quercus rubra', namePl: 'dąb czerwony', nameEn: 'red oak', confidence: 0.04 },
        ],
        confidence: 0.82,
        takenAt: t,
        lat: 52.2297 + Math.random() * 0.01,
        lon: 21.0122 + Math.random() * 0.01,
        locSource: 'gps',
        photo: await fakePhoto(s.hue + k * 15),
        model: 'dev',
        review: k === 1,
      });
    }
  }
}

export function routeFromHash(): Route | null {
  const p = new URLSearchParams(location.hash.slice(1));
  const view = p.get('view');
  if (view === 'entry') return { view: 'entry', id: Number(p.get('id') ?? 1) };
  if (view === 'species') return { view: 'species', latin: p.get('latin') ?? 'Quercus robur' };
  if (view === 'cards' || view === 'collection' || view === 'settings' || view === 'capture') return { view };
  return null;
}
