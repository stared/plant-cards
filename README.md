# Plant Cards

Minimal local-first PWA: photograph a plant, an LLM (via OpenRouter) identifies it
(Polish/English/Latin names + short description), the photo is saved with datetime and
location. Browse your collection grouped by species, or drill them as flashcards with
simple spaced repetition.

## Run

```sh
pnpm install
pnpm dev          # http://localhost:5173
pnpm test         # unit tests (vitest)
pnpm build        # typecheck + tests + static output in dist/
```

Then open **Settings** in the app and paste your OpenRouter API key
(default model: `google/gemini-3.7-flash`, editable).

## Using it on iPhone

Camera and geolocation require HTTPS, so deploy `dist/` anywhere static
(GitHub Pages, Cloudflare Pages, Netlify — `base` is set to `./` so any path works).
Then on the iPhone: open the URL in Safari → Share → **Add to Home Screen**.

Notes:

- All data (photos, metadata, flashcard progress) lives in IndexedDB **on the device** —
  Mac and iPhone don't sync. Use Settings → Export/Import backup (zip) to move data.
- Adding to the home screen matters: it exempts the app from Safari's 7-day storage
  auto-cleanup for unused sites.
- iOS strips GPS EXIF before a web page ever sees a photo, so location comes from
  browser geolocation at capture time (EXIF is still tried for library picks).

## Stack

Vite · Preact · TypeScript · Dexie (IndexedDB) · vite-plugin-pwa · exifr · fflate.
No backend; the browser calls OpenRouter directly with your key (stored in localStorage).
