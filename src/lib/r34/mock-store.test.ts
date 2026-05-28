import { cacheHtml, clearMockCache, getCachedHtml } from './mock-store';

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

describe('mock-store', () => {
  beforeEach(() => {
    clearMockCache();
  });

  describe('cacheHtml / getCachedHtml', () => {
    it('caches and retrieves HTML', () => {
      const url = 'https://rule34video.com/';
      const html = '<html>test</html>';

      cacheHtml(url, html);
      const result = getCachedHtml(url);

      expect(result).toBe(html);
    });

    it('returns null for uncached URL', () => {
      const result = getCachedHtml('https://rule34video.com/uncached');

      expect(result).toBeNull();
    });

    it('uses different keys for different URLs', () => {
      cacheHtml('https://rule34video.com/page1', '<html>1</html>');
      cacheHtml('https://rule34video.com/page2', '<html>2</html>');

      expect(getCachedHtml('https://rule34video.com/page1')).toBe('<html>1</html>');
      expect(getCachedHtml('https://rule34video.com/page2')).toBe('<html>2</html>');
    });
  });

  describe('clearMockCache', () => {
    it('clears all cached HTML', () => {
      cacheHtml('https://rule34video.com/page1', '<html>1</html>');
      cacheHtml('https://rule34video.com/page2', '<html>2</html>');

      clearMockCache();

      expect(getCachedHtml('https://rule34video.com/page1')).toBeNull();
      expect(getCachedHtml('https://rule34video.com/page2')).toBeNull();
    });
  });
});
