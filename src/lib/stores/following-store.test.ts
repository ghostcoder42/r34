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

import { useFollowingStore } from './following-store';

beforeEach(() => {
  for (const key of Object.keys(mockStorage)) delete mockStorage[key];
  useFollowingStore.setState({ following: [] });
});

describe('following-store', () => {
  describe('follow', () => {
    it('adds an author with followedAt timestamp', () => {
      const now = 1700000000000;
      jest.spyOn(Date, 'now').mockReturnValue(now);

      useFollowingStore.getState().follow('Author Name', 'author-name');

      const { following } = useFollowingStore.getState();
      expect(following).toHaveLength(1);
      expect(following[0]).toEqual({ name: 'Author Name', slug: 'author-name', followedAt: now });

      jest.restoreAllMocks();
    });

    it('prevents duplicate follows by slug', () => {
      useFollowingStore.getState().follow('Author Name', 'author-name');
      useFollowingStore.getState().follow('Author Name 2', 'author-name');

      expect(useFollowingStore.getState().following).toHaveLength(1);
    });

    it('prepends new follows to the front', () => {
      useFollowingStore.getState().follow('First', 'first');
      useFollowingStore.getState().follow('Second', 'second');

      const { following } = useFollowingStore.getState();
      expect(following[0].slug).toBe('second');
      expect(following[1].slug).toBe('first');
    });

    it('persists to storage', () => {
      useFollowingStore.getState().follow('Author Name', 'author-name');

      const stored = JSON.parse(mockStorage.following_authors);
      expect(stored).toHaveLength(1);
      expect(stored[0].slug).toBe('author-name');
    });
  });

  describe('unfollow', () => {
    it('removes an author by slug', () => {
      useFollowingStore.getState().follow('First', 'first');
      useFollowingStore.getState().follow('Second', 'second');

      useFollowingStore.getState().unfollow('first');

      const { following } = useFollowingStore.getState();
      expect(following).toHaveLength(1);
      expect(following[0].slug).toBe('second');
    });

    it('does nothing if slug does not match', () => {
      useFollowingStore.getState().follow('Author', 'author');

      useFollowingStore.getState().unfollow('nonexistent');

      expect(useFollowingStore.getState().following).toHaveLength(1);
    });

    it('persists removal to storage', () => {
      useFollowingStore.getState().follow('Author', 'author');
      useFollowingStore.getState().unfollow('author');

      const stored = JSON.parse(mockStorage.following_authors);
      expect(stored).toHaveLength(0);
    });
  });

  describe('isFollowing', () => {
    it('returns true for a followed author', () => {
      useFollowingStore.getState().follow('Author', 'author');

      expect(useFollowingStore.getState().isFollowing('author')).toBe(true);
    });

    it('returns false for an unfollowed author', () => {
      expect(useFollowingStore.getState().isFollowing('author')).toBe(false);
    });

    it('returns false after unfollowing', () => {
      useFollowingStore.getState().follow('Author', 'author');
      useFollowingStore.getState().unfollow('author');

      expect(useFollowingStore.getState().isFollowing('author')).toBe(false);
    });
  });
});
