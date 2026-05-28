import { storage } from '@/lib/storage';

const MOCK_PREFIX = 'mock_html_';

function hashUrl(url: string): string {
  let hash = 0;
  for (let i = 0; i < url.length; i++) {
    const char = url.charCodeAt(i);
    hash = ((hash << 5) - hash + char) | 0;
  }
  return Math.abs(hash).toString(36);
}

export function cacheHtml(url: string, html: string): void {
  const key = `${MOCK_PREFIX}${hashUrl(url)}`;
  storage.set(key, html);
}

export function getCachedHtml(url: string): string | null {
  const key = `${MOCK_PREFIX}${hashUrl(url)}`;
  return storage.getString(key) ?? null;
}

export function clearMockCache(): void {
  const allKeys = storage.getAllKeys();
  for (const key of allKeys) {
    if (key.startsWith(MOCK_PREFIX)) {
      storage.remove(key);
    }
  }
}

export function fetchWithCache(url: string): Promise<string> {
  const cached = getCachedHtml(url);
  if (cached) {
    return Promise.resolve(cached);
  }

  return fetch(url, {
    headers: {
      'User-Agent':
        'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125.0.0.0 Safari/537.36',
      Referer: 'https://rule34video.com/',
    },
  })
    .then((res) => res.text())
    .then((html) => {
      cacheHtml(url, html);
      return html;
    });
}
