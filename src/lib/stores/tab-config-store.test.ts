jest.mock('@/lib/storage', () => {
  const store: Record<string, string> = {};
  return {
    __esModule: true,
    getItem: <T>(key: string): T | null => (store[key] ? JSON.parse(store[key]) : null),
    setItem: (key: string, value: unknown) => {
      store[key] = JSON.stringify(value);
    },
    __store: store,
  };
});

const mockStorage: Record<string, string> = jest.requireMock('@/lib/storage').__store;

import { useTabConfigStore } from './tab-config-store';

beforeEach(() => {
  for (const key of Object.keys(mockStorage)) delete mockStorage[key];
  useTabConfigStore.setState({
    tabs: { search: true, following: true, library: true },
  });
});

describe('tab-config-store', () => {
  it('defaults to all optional tabs enabled', () => {
    expect(useTabConfigStore.getState().tabs).toEqual({
      search: true,
      following: true,
      library: true,
    });
  });

  it('toggles a tab and persists', () => {
    useTabConfigStore.getState().setTab('following', false);

    expect(useTabConfigStore.getState().tabs.following).toBe(false);
    expect(useTabConfigStore.getState().tabs.search).toBe(true);

    const stored = JSON.parse(mockStorage.enabled_tabs);
    expect(stored.following).toBe(false);
  });

  it('only persists the toggled tab, leaving the rest intact', () => {
    useTabConfigStore.getState().setTab('library', false);
    useTabConfigStore.getState().setTab('search', false);

    expect(useTabConfigStore.getState().tabs).toEqual({
      search: false,
      following: true,
      library: false,
    });
  });
});
