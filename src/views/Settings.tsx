import { useEffect, useState } from 'preact/hooks';
import { zipSync, unzipSync, strToU8, strFromU8 } from 'fflate';
import { db, type Entry, type Srs } from '../db';
import { getSettings, saveSettings, DEFAULT_MODEL, type Settings } from '../settings';

export function SettingsView() {
  const [s, setS] = useState<Settings>(getSettings());
  const [storageInfo, setStorageInfo] = useState('');
  const [msg, setMsg] = useState('');

  useEffect(() => {
    (async () => {
      const persisted = (await navigator.storage?.persisted?.()) ?? false;
      const est = await navigator.storage?.estimate?.();
      const used = est?.usage ? `${(est.usage / 1e6).toFixed(1)} MB used` : '';
      setStorageInfo(`${persisted ? 'persistent storage granted' : 'storage not marked persistent'}${used ? ` · ${used}` : ''}`);
    })();
  }, []);

  function set<K extends keyof Settings>(key: K, value: Settings[K]) {
    const next = { ...s, [key]: value };
    setS(next);
    saveSettings(next);
  }

  async function exportZip() {
    setMsg('Exporting…');
    const entries = await db.entries.toArray();
    const srs = await db.srs.toArray();
    const files: Record<string, Uint8Array> = {};
    const metaEntries = [];
    for (const e of entries) {
      const path = `photos/${e.id}.jpg`;
      files[path] = new Uint8Array(await e.photo.arrayBuffer());
      const { photo, ...rest } = e;
      metaEntries.push({ ...rest, photo: path });
    }
    files['data.json'] = strToU8(
      JSON.stringify({ version: 1, exportedAt: new Date().toISOString(), entries: metaEntries, srs }, null, 1),
    );
    const zipped = zipSync(files, { level: 0 }); // photos are already JPEG-compressed
    const blob = new Blob([zipped.buffer as ArrayBuffer], { type: 'application/zip' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `plant-cards-${new Date().toISOString().slice(0, 10)}.zip`;
    a.click();
    setTimeout(() => URL.revokeObjectURL(a.href), 30_000);
    setMsg(`Exported ${entries.length} entries.`);
  }

  async function importZip(ev: Event) {
    const input = ev.currentTarget as HTMLInputElement;
    const file = input.files?.[0];
    input.value = '';
    if (!file) return;
    setMsg('Importing…');
    try {
      const unzipped = unzipSync(new Uint8Array(await file.arrayBuffer()));
      const data = JSON.parse(strFromU8(unzipped['data.json']));
      let added = 0;
      for (const m of data.entries as (Omit<Entry, 'photo'> & { photo: string })[]) {
        const bytes = unzipped[m.photo];
        if (!bytes) continue;
        const { id, photo, ...rest } = m;
        await db.entries.add({ ...rest, photo: new Blob([bytes.buffer as ArrayBuffer], { type: 'image/jpeg' }) } as Entry);
        added++;
      }
      for (const sr of (data.srs ?? []) as Srs[]) {
        const existing = await db.srs.get(sr.latin);
        if (!existing) await db.srs.put(sr);
      }
      setMsg(`Imported ${added} entries.`);
    } catch (e) {
      setMsg(`Import failed: ${e instanceof Error ? e.message : e}`);
    }
  }

  async function wipe() {
    if (!window.confirm('Delete ALL photos and data? This cannot be undone.')) return;
    if (!window.confirm('Really sure? Consider exporting a backup first.')) return;
    await db.delete();
    location.reload();
  }

  return (
    <div>
      <h1>Settings</h1>
      <div class="field">
        <label>OpenRouter API key</label>
        <input
          type="password"
          value={s.apiKey}
          placeholder="sk-or-..."
          onInput={(e) => set('apiKey', (e.currentTarget as HTMLInputElement).value.trim())}
        />
      </div>
      <div class="field">
        <label>Model (OpenRouter id)</label>
        <input
          type="text"
          value={s.model}
          placeholder={DEFAULT_MODEL}
          onInput={(e) => set('model', (e.currentTarget as HTMLInputElement).value.trim() || DEFAULT_MODEL)}
        />
      </div>
      <div class="field">
        <label>Description language</label>
        <select value={s.descLang} onChange={(e) => set('descLang', (e.currentTarget as HTMLSelectElement).value as 'pl' | 'en')}>
          <option value="pl">polski</option>
          <option value="en">English</option>
        </select>
      </div>

      <div class="section">
        <h2>Data</h2>
        <p class="hint" style="margin:8px 0 12px">
          {storageInfo}
        </p>
        {msg && <p class="hint" style="margin-bottom:12px">{msg}</p>}
        <div class="row-buttons" style="margin-top:0">
          <button class="small" onClick={exportZip}>
            ⬇️ Export backup (zip)
          </button>
          <label class="small" style="display:inline-block;cursor:pointer;padding:8px 14px;background:var(--panel2);border-radius:10px;font-size:14px">
            ⬆️ Import backup
            <input type="file" accept=".zip,application/zip" hidden onChange={importZip} />
          </label>
          <button class="small danger" onClick={wipe}>
            🗑 Delete everything
          </button>
        </div>
      </div>

      <div class="section">
        <p class="hint">
          Everything is stored locally on this device (IndexedDB). Add the app to your home screen
          on iPhone so iOS never auto-cleans the data. Export a backup now and then.
        </p>
      </div>
    </div>
  );
}
