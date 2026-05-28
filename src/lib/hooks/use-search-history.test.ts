import { useSearchHistory } from './use-search-history';

jest.mock('@/lib/storage', () => {
  const store: Record<string, string> = {};
  return {
    storage: {
      set: (key: string, value: string) => {
        store[key] = value;
      },
      getString: (key: string) => store[key],
      getAllKeys: () => Object.keys(store),
      remove: (key: string) => {
        delete store[key];
      },
    },
  };
});

describe('useSearchHistory', () => {
  beforeEach(() => {
    const { storage } = jest.requireMock('@/lib/storage') as {
      storage: { set: (k: string, v: string) => void };
    };
    storage.set('search_history', '[]');
  });

  it('returns empty history initially', () => {
    const { getHistory } = useSearchHistory();

    expect(getHistory()).toEqual([]);
  });

  it('adds query to history', () => {
    const { addHistory, getHistory } = useSearchHistory();

    addHistory('test query');

    expect(getHistory()).toEqual(['test query']);
  });

  it('moves duplicate to front', () => {
    const { addHistory, getHistory } = useSearchHistory();

    addHistory('first');
    addHistory('second');
    addHistory('first');

    expect(getHistory()).toEqual(['first', 'second']);
  });

  it('ignores empty query', () => {
    const { addHistory, getHistory } = useSearchHistory();

    addHistory('');
    addHistory('   ');

    expect(getHistory()).toEqual([]);
  });

  it('limits history to 20 items', () => {
    const { addHistory, getHistory } = useSearchHistory();

    for (let i = 0; i < 25; i++) {
      addHistory(`query-${i}`);
    }

    expect(getHistory().length).toBe(20);
    expect(getHistory()[0]).toBe('query-24');
  });

  it('removes query from history', () => {
    const { addHistory, removeHistory, getHistory } = useSearchHistory();

    addHistory('test');
    removeHistory('test');

    expect(getHistory()).toEqual([]);
  });

  it('clears all history', () => {
    const { addHistory, clearHistory, getHistory } = useSearchHistory();

    addHistory('a');
    addHistory('b');
    clearHistory();

    expect(getHistory()).toEqual([]);
  });
});
