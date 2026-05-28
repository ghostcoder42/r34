jest.mock('@/lib/storage', () => {
  const store: Record<string, string> = {};
  return {
    __esModule: true,
    getItem: (key: string) => (store[key] ? JSON.parse(store[key]) : null),
    setItem: (key: string, value: unknown) => {
      store[key] = JSON.stringify(value);
    },
    __store: store,
  };
});

const mockStorage: Record<string, string> = jest.requireMock('@/lib/storage').__store;

import { useHistoryStore } from './history-store';

beforeEach(() => {
  for (const key of Object.keys(mockStorage)) delete mockStorage[key];
  useHistoryStore.setState({ history: [] });
});

describe('history-store', () => {
  const baseItem = {
    id: 'h-1',
    slug: 'test-video',
    title: 'Test Video',
    thumbnail: 'https://example.com/thumb.jpg',
    duration: '3:00',
  };

  describe('addHistory', () => {
    it('adds an item with viewedAt timestamp', () => {
      const now = 1700000000000;
      jest.spyOn(Date, 'now').mockReturnValue(now);

      useHistoryStore.getState().addHistory(baseItem);

      const { history } = useHistoryStore.getState();
      expect(history).toHaveLength(1);
      expect(history[0]).toEqual({ ...baseItem, viewedAt: now });

      jest.restoreAllMocks();
    });

    it('removes duplicates and moves to front', () => {
      useHistoryStore.getState().addHistory(baseItem);
      useHistoryStore.getState().addHistory({ ...baseItem, id: 'h-2', slug: 'other' });
      useHistoryStore.getState().addHistory(baseItem);

      const { history } = useHistoryStore.getState();
      expect(history).toHaveLength(2);
      expect(history[0].id).toBe('h-1');
    });

    it('caps history at 200 items', () => {
      for (let i = 0; i < 210; i++) {
        useHistoryStore.getState().addHistory({ ...baseItem, id: `h-${i}`, slug: `s-${i}` });
      }

      expect(useHistoryStore.getState().history).toHaveLength(200);
    });

    it('persists to storage', () => {
      useHistoryStore.getState().addHistory(baseItem);

      const stored = JSON.parse(mockStorage.watch_history);
      expect(stored).toHaveLength(1);
      expect(stored[0].id).toBe('h-1');
    });
  });

  describe('removeHistory', () => {
    it('removes an item by id', () => {
      useHistoryStore.getState().addHistory(baseItem);
      useHistoryStore.getState().addHistory({ ...baseItem, id: 'h-2', slug: 'other' });

      useHistoryStore.getState().removeHistory('h-1');

      const { history } = useHistoryStore.getState();
      expect(history).toHaveLength(1);
      expect(history[0].id).toBe('h-2');
    });

    it('does nothing if id does not match', () => {
      useHistoryStore.getState().addHistory(baseItem);

      useHistoryStore.getState().removeHistory('nonexistent');

      expect(useHistoryStore.getState().history).toHaveLength(1);
    });

    it('persists removal to storage', () => {
      useHistoryStore.getState().addHistory(baseItem);
      useHistoryStore.getState().removeHistory('h-1');

      const stored = JSON.parse(mockStorage.watch_history);
      expect(stored).toHaveLength(0);
    });
  });

  describe('clearHistory', () => {
    it('empties the history array', () => {
      useHistoryStore.getState().addHistory(baseItem);
      useHistoryStore.getState().addHistory({ ...baseItem, id: 'h-2', slug: 'other' });

      useHistoryStore.getState().clearHistory();

      expect(useHistoryStore.getState().history).toHaveLength(0);
    });

    it('persists empty array to storage', () => {
      useHistoryStore.getState().addHistory(baseItem);
      useHistoryStore.getState().clearHistory();

      const stored = JSON.parse(mockStorage.watch_history);
      expect(stored).toHaveLength(0);
    });
  });
});
