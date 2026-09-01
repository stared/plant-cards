import { useState } from 'preact/hooks';
import { Capture } from './views/Capture';
import { Collection } from './views/Collection';
import { Species } from './views/Species';
import { EntryView } from './views/Entry';
import { Cards } from './views/Cards';
import { SettingsView } from './views/Settings';

export type Route =
  | { view: 'capture' }
  | { view: 'collection' }
  | { view: 'species'; latin: string }
  | { view: 'entry'; id: number }
  | { view: 'cards' }
  | { view: 'settings' };

const TABS: { route: Route; icon: string; label: string }[] = [
  { route: { view: 'capture' }, icon: '📷', label: 'Snap' },
  { route: { view: 'collection' }, icon: '🌿', label: 'Plants' },
  { route: { view: 'cards' }, icon: '🃏', label: 'Cards' },
  { route: { view: 'settings' }, icon: '⚙️', label: 'Settings' },
];

export function App() {
  const [route, setRoute] = useState<Route>({ view: 'capture' });

  let page;
  switch (route.view) {
    case 'capture':
      page = <Capture navigate={setRoute} />;
      break;
    case 'collection':
      page = <Collection navigate={setRoute} />;
      break;
    case 'species':
      page = <Species latin={route.latin} navigate={setRoute} />;
      break;
    case 'entry':
      page = <EntryView id={route.id} navigate={setRoute} />;
      break;
    case 'cards':
      page = <Cards />;
      break;
    case 'settings':
      page = <SettingsView />;
      break;
  }

  const activeTab = route.view === 'species' || route.view === 'entry' ? 'collection' : route.view;

  return (
    <div class="app">
      <main class="page">{page}</main>
      <nav class="tabbar">
        {TABS.map((t) => (
          <button
            key={t.route.view}
            class={activeTab === t.route.view ? 'tab active' : 'tab'}
            onClick={() => setRoute(t.route)}
          >
            <span class="tab-icon">{t.icon}</span>
            <span class="tab-label">{t.label}</span>
          </button>
        ))}
      </nav>
    </div>
  );
}
