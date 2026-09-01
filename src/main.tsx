import { render } from 'preact';
import { registerSW } from 'virtual:pwa-register';
import { App, type Route } from './app';
import { getSettings, saveSettings } from './settings';
import './style.css';

registerSW({ immediate: true });

// One-time key import: open the app as https://.../#key=sk-or-... and the key is
// stored in settings and removed from the URL (the hash never reaches any server).
const hashKey = new URLSearchParams(location.hash.slice(1)).get('key');
if (hashKey) {
  saveSettings({ ...getSettings(), apiKey: hashKey.trim() });
  history.replaceState(null, '', location.pathname + location.search);
}

// Ask the browser to protect our storage from eviction.
navigator.storage?.persist?.().catch(() => {});

async function start() {
  let initial: Route | undefined;
  if (import.meta.env.DEV) {
    const dev = await import('./dev');
    if (location.hash.includes('seed')) await dev.seed();
    initial = dev.routeFromHash() ?? undefined;
  }
  render(<App initial={initial} />, document.getElementById('app')!);
}
start();
