import { useEffect, useState } from 'preact/hooks';
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

export interface Nav {
  /** Go to a screen (pushes browser history, so back-swipe / back button work). */
  go: (r: Route) => void;
  /** Go back; `fallback` is used when there is nothing to go back to (deep link). */
  back: (fallback: Route) => void;
}

interface HistState {
  route: Route;
  depth: number;
}

const TABS: { route: Route; icon: string; label: string }[] = [
  { route: { view: 'capture' }, icon: 'camera', label: 'Snap' },
  { route: { view: 'collection' }, icon: 'leaf', label: 'Plants' },
  { route: { view: 'cards' }, icon: 'cards', label: 'Cards' },
  { route: { view: 'settings' }, icon: 'sliders', label: 'Settings' },
];

export function App({ initial }: { initial?: Route }) {
  const [route, setRoute] = useState<Route>(() => {
    const r = initial ?? { view: 'capture' };
    history.replaceState({ route: r, depth: 0 } satisfies HistState, '');
    return r;
  });

  useEffect(() => {
    const onPop = (ev: PopStateEvent) => setRoute((ev.state as HistState | null)?.route ?? { view: 'capture' });
    addEventListener('popstate', onPop);
    return () => removeEventListener('popstate', onPop);
  }, []);

  const nav: Nav = {
    go(r) {
      const depth = ((history.state as HistState | null)?.depth ?? 0) + 1;
      history.pushState({ route: r, depth } satisfies HistState, '');
      setRoute(r);
    },
    back(fallback) {
      if (((history.state as HistState | null)?.depth ?? 0) > 0) history.back();
      else nav.go(fallback);
    },
  };

  let page;
  switch (route.view) {
    case 'capture':
      page = <Capture nav={nav} />;
      break;
    case 'collection':
      page = <Collection nav={nav} />;
      break;
    case 'species':
      page = <Species latin={route.latin} nav={nav} />;
      break;
    case 'entry':
      page = <EntryView id={route.id} nav={nav} />;
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
            onClick={() => route.view !== t.route.view && nav.go(t.route)}
          >
            <Icon name={t.icon} size={22} />
            <span>{t.label}</span>
          </button>
        ))}
      </nav>
    </div>
  );
}
