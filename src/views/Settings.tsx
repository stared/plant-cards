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
      const used = est?.usage ? `${(est.usage / 1e6).toFixed(1)} MB` : '';
      setStorageInfo([used, persisted ? 'persistent' : 'not persistent'].filter(Boolean).join(' · '));
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
    const zipped = zipSync(files, { level: 0 });
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
      <div class="title">Settings</div>
      <div class="field">
        <div class="label">OpenRouter API key</div>
        <input
          type="password"
          value={s.apiKey}
          placeholder="sk-or-…"
          onInput={(e) => set('apiKey', (e.currentTarget as HTMLInputElement).value.trim())}
        />
      </div>
      <div class="field">
        <div class="label">Model</div>
        <input
          type="text"
          value={s.model}
          placeholder={DEFAULT_MODEL}
          autocapitalize="off"
          autocorrect="off"
          onInput={(e) => set('model', (e.currentTarget as HTMLInputElement).value.trim() || DEFAULT_MODEL)}
        />
      </div>
      <div class="field">
        <div class="label">Description language</div>
        <select value={s.descLang} onChange={(e) => set('descLang', (e.currentTarget as HTMLSelectElement).value as 'pl' | 'en')}>
          <option value="pl">Polski</option>
          <option value="en">English</option>
        </select>
      </div>

      <div class="section">
        <div class="row spread" style="margin-bottom:12px">
          <div class="label" style="margin:0">
            Data
          </div>
          <span class="muted">{storageInfo}</span>
        </div>
        {msg && <div class="notice">{msg}</div>}
        <div class="row">
          <button class="btn sm" onClick={exportZip}>
            Export backup
          </button>
          <label class="btn sm file-btn">
            Import backup
            <input type="file" accept=".zip,application/zip" onChange={importZip} />
          </label>
          <button class="btn sm ghost danger" onClick={wipe} style="margin-left:auto">
            Delete all
          </button>
        </div>
      </div>

      <div class="section">
        <p class="hint">
          Everything is stored on this device. Add the app to your home screen so iOS never auto-cleans it, and export a
          backup now and then.
        </p>
      </div>
    </div>
  );
}
