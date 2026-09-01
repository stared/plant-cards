import { useState } from 'preact/hooks';
import { Capture } from './views/Capture';
import { Collection } from './views/Collection';
import { Species } from './views/Species';
import { EntryView } from './views/Entry';
import { Cards } from './views/Cards';
import { SettingsView } from './views/Settings';
import { Icon } from './views/icons';

export type Route =
  | { view: 'capture' }
  | { view: 'collection' }
  | { view: 'species'; latin: string }
  | { view: 'entry'; id: number }
  | { view: 'cards' }
  | { view: 'settings' };

const TABS: { route: Route; icon: string; label: string }[] = [
  { route: { view: 'capture' }, icon: 'camera', label: 'Snap' },
  { route: { view: 'collection' }, icon: 'leaf', label: 'Plants' },
  { route: { view: 'cards' }, icon: 'cards', label: 'Cards' },
  { route: { view: 'settings' }, icon: 'sliders', label: 'Settings' },
];

export function App({ initial }: { initial?: Route }) {
  const [route, setRoute] = useState<Route>(initial ?? { view: 'capture' });

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
          <button key={t.route.view} class={activeTab === t.route.view ? 'tab active' : 'tab'} onClick={() => setRoute(t.route)}>
            <Icon name={t.icon} size={22} />
            <span>{t.label}</span>
          </button>
        ))}
      </nav>
    </div>
  );
}
