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

import type { Post } from '@/lib/r34/extractor';
import { useFavoritesStore } from './favorites-store';

beforeEach(() => {
  for (const key of Object.keys(mockStorage)) delete mockStorage[key];
  useFavoritesStore.setState({ favorites: [] });
});

describe('favorites-store', () => {
  const mockPost: Post = {
    id: 'post-1',
    slug: 'test-post',
    title: 'Test Post',
    thumbnail: 'https://example.com/thumb.jpg',
    duration: '5:00',
    views: '',
    rating: '',
  };

  describe('addFavorite', () => {
    it('adds a favorite with addedAt timestamp', () => {
      const now = 1700000000000;
      jest.spyOn(Date, 'now').mockReturnValue(now);

      useFavoritesStore.getState().addFavorite(mockPost);

      const { favorites } = useFavoritesStore.getState();
      expect(favorites).toHaveLength(1);
      expect(favorites[0]).toEqual({
        id: 'post-1',
        slug: 'test-post',
        title: 'Test Post',
        url: 'https://rule34video.com/video/post-1/test-post/',
        thumbnail: 'https://example.com/thumb.jpg',
        duration: '5:00',
        addedAt: now,
      });

      jest.restoreAllMocks();
    });

    it('prevents duplicate favorites by id', () => {
      useFavoritesStore.getState().addFavorite(mockPost);
      useFavoritesStore.getState().addFavorite(mockPost);

      expect(useFavoritesStore.getState().favorites).toHaveLength(1);
    });

    it('prepends new favorites to the front', () => {
      useFavoritesStore.getState().addFavorite(mockPost);
      useFavoritesStore.getState().addFavorite({ ...mockPost, id: 'post-2', slug: 'second' });

      const { favorites } = useFavoritesStore.getState();
      expect(favorites[0].id).toBe('post-2');
      expect(favorites[1].id).toBe('post-1');
    });

    it('persists to storage', () => {
      useFavoritesStore.getState().addFavorite(mockPost);

      const stored = JSON.parse(mockStorage.favorites);
      expect(stored).toHaveLength(1);
      expect(stored[0].id).toBe('post-1');
    });
  });

  describe('removeFavorite', () => {
    it('removes a favorite by id', () => {
      useFavoritesStore.getState().addFavorite(mockPost);
      useFavoritesStore.getState().addFavorite({ ...mockPost, id: 'post-2', slug: 'second' });

      useFavoritesStore.getState().removeFavorite('post-1');

      const { favorites } = useFavoritesStore.getState();
      expect(favorites).toHaveLength(1);
      expect(favorites[0].id).toBe('post-2');
    });

    it('does nothing if id does not match', () => {
      useFavoritesStore.getState().addFavorite(mockPost);

      useFavoritesStore.getState().removeFavorite('nonexistent');

      expect(useFavoritesStore.getState().favorites).toHaveLength(1);
    });

    it('persists removal to storage', () => {
      useFavoritesStore.getState().addFavorite(mockPost);
      useFavoritesStore.getState().removeFavorite('post-1');

      const stored = JSON.parse(mockStorage.favorites);
      expect(stored).toHaveLength(0);
    });
  });

  describe('isFavorite', () => {
    it('returns true for an existing favorite', () => {
      useFavoritesStore.getState().addFavorite(mockPost);

      expect(useFavoritesStore.getState().isFavorite('post-1')).toBe(true);
    });

    it('returns false for a non-existing favorite', () => {
      expect(useFavoritesStore.getState().isFavorite('post-1')).toBe(false);
    });

    it('returns false after removal', () => {
      useFavoritesStore.getState().addFavorite(mockPost);
      useFavoritesStore.getState().removeFavorite('post-1');

      expect(useFavoritesStore.getState().isFavorite('post-1')).toBe(false);
    });
  });

  describe('getFavoriteCount', () => {
    it('returns 0 when empty', () => {
      expect(useFavoritesStore.getState().getFavoriteCount()).toBe(0);
    });

    it('returns correct count', () => {
      useFavoritesStore.getState().addFavorite(mockPost);
      useFavoritesStore.getState().addFavorite({ ...mockPost, id: 'post-2', slug: 'second' });

      expect(useFavoritesStore.getState().getFavoriteCount()).toBe(2);
    });

    it('updates after removal', () => {
      useFavoritesStore.getState().addFavorite(mockPost);
      useFavoritesStore.getState().addFavorite({ ...mockPost, id: 'post-2', slug: 'second' });
      useFavoritesStore.getState().removeFavorite('post-1');

      expect(useFavoritesStore.getState().getFavoriteCount()).toBe(1);
    });
  });
});
