import { render } from 'preact';
import { registerSW } from 'virtual:pwa-register';
import { App } from './app';
import './style.css';

registerSW({ immediate: true });

// Ask the browser to protect our storage from eviction.
navigator.storage?.persist?.().catch(() => {});

render(<App />, document.getElementById('app')!);
