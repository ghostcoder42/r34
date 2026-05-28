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

import { useTagStore } from './tag-store';

beforeEach(() => {
  for (const key of Object.keys(mockStorage)) delete mockStorage[key];
  useTagStore.setState({ favoriteTags: [] });
});

describe('tag-store', () => {
  describe('addTag', () => {
    it('adds a tag to favoriteTags', () => {
      useTagStore.getState().addTag('anime');

      expect(useTagStore.getState().favoriteTags).toEqual(['anime']);
    });

    it('prevents duplicate tags', () => {
      useTagStore.getState().addTag('anime');
      useTagStore.getState().addTag('anime');

      expect(useTagStore.getState().favoriteTags).toEqual(['anime']);
    });

    it('allows multiple distinct tags', () => {
      useTagStore.getState().addTag('anime');
      useTagStore.getState().addTag('manga');

      expect(useTagStore.getState().favoriteTags).toEqual(['anime', 'manga']);
    });

    it('persists to storage', () => {
      useTagStore.getState().addTag('anime');

      const stored = JSON.parse(mockStorage.favorite_tags);
      expect(stored).toEqual(['anime']);
    });
  });

  describe('removeTag', () => {
    it('removes a tag', () => {
      useTagStore.getState().addTag('anime');
      useTagStore.getState().addTag('manga');

      useTagStore.getState().removeTag('anime');

      expect(useTagStore.getState().favoriteTags).toEqual(['manga']);
    });

    it('does nothing if tag does not exist', () => {
      useTagStore.getState().addTag('anime');

      useTagStore.getState().removeTag('nonexistent');

      expect(useTagStore.getState().favoriteTags).toEqual(['anime']);
    });

    it('persists removal to storage', () => {
      useTagStore.getState().addTag('anime');
      useTagStore.getState().removeTag('anime');

      const stored = JSON.parse(mockStorage.favorite_tags);
      expect(stored).toEqual([]);
    });
  });

  describe('isFavorite', () => {
    it('returns true for a favorited tag', () => {
      useTagStore.getState().addTag('anime');

      expect(useTagStore.getState().isFavorite('anime')).toBe(true);
    });

    it('returns false for a non-favorited tag', () => {
      expect(useTagStore.getState().isFavorite('anime')).toBe(false);
    });

    it('returns false after removal', () => {
      useTagStore.getState().addTag('anime');
      useTagStore.getState().removeTag('anime');

      expect(useTagStore.getState().isFavorite('anime')).toBe(false);
    });
  });
});
