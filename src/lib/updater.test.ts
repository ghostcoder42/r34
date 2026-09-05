jest.mock('@/lib/storage', () => {
  const store: Record<string, string> = {};
  return {
    __esModule: true,
    getItem: <T>(key: string): T | null => (key in store ? JSON.parse(store[key]) : null),
    setItem: (key: string, value: unknown) => {
      store[key] = JSON.stringify(value);
    },
  };
});

import { fetchLatestRelease, isNewerVersion } from './updater';

const jsonResponse = (body: unknown, status = 200) =>
  ({ ok: status >= 200 && status < 300, status, json: async () => body }) as unknown as Response;

describe('isNewerVersion', () => {
  it('compares numerically per component', () => {
    expect(isNewerVersion('0.4.0', '0.3.0')).toBe(true);
    expect(isNewerVersion('0.3.0', '0.3.0')).toBe(false);
    expect(isNewerVersion('0.3.0', '0.4.0')).toBe(false);
    expect(isNewerVersion('0.10.0', '0.9.0')).toBe(true); // not lexicographic
    expect(isNewerVersion('1.0', '0.99.9')).toBe(true);
  });

  it('treats malformed components as zero', () => {
    expect(isNewerVersion('abc', '0.0.1')).toBe(false);
    expect(isNewerVersion('0.0.2', '0.0.x')).toBe(true);
  });
});

describe('fetchLatestRelease', () => {
  const realFetch = global.fetch;
  const mockFetch = (r: Response) => {
    global.fetch = jest.fn(() => r) as unknown as typeof fetch;
  };

  afterEach(() => {
    global.fetch = realFetch;
    jest.restoreAllMocks();
  });

  it('normalizes the tag, keeps the title and flattens markdown links', async () => {
    mockFetch(
      jsonResponse({
        tag_name: 'v0.4.0',
        name: 'v0.4.0',
        body: '## What\u2019s Changed\n* fix by [@me](https://github.com/me) in [PR](https://github.com/x)',
      })
    );

    const release = await fetchLatestRelease();

    expect(release.version).toBe('0.4.0');
    expect(release.title).toBe('v0.4.0');
    expect(release.notes).toContain('fix by @me in PR');
    expect(release.notes).not.toContain('](http');
  });

  it('normalizes CRLF bodies and strips headings/emphasis/list markers', async () => {
    // GitHub release bodies really use \r\n; without normalization the stray
    // \r glues lines together on Android.
    mockFetch(
      jsonResponse({
        tag_name: 'v0.4.0',
        body: "## What's Changed\r\n\r\n* fix one\r\n* fix two\r\n\r\nsome **bold** and `code`\r\n",
      })
    );

    const release = await fetchLatestRelease();

    expect(release.notes).not.toContain('\r');
    expect(release.notes.split('\n')).toEqual([
      "What's Changed",
      '',
      '• fix one',
      '• fix two',
      '',
      'some bold and code',
    ]);
  });

  it('throws with the HTTP status attached for non-OK responses', async () => {
    mockFetch(jsonResponse({ message: 'rate limited' }, 403));

    await expect(fetchLatestRelease()).rejects.toMatchObject({ status: 403 });
  });

  it('extracts the release page URL, APK asset link/size and publish date', async () => {
    mockFetch(
      jsonResponse({
        tag_name: 'v0.4.0',
        html_url: 'https://github.com/ghostcoder42/r34/releases/tag/v0.4.0',
        published_at: '2026-09-05T10:00:00Z',
        assets: [
          { name: 'source.zip', browser_download_url: 'https://x/source.zip' },
          { name: 'r34-0.4.0.apk', size: 42000000, browser_download_url: 'https://x/r34.apk' },
        ],
      })
    );

    const release = await fetchLatestRelease();

    expect(release.releaseUrl).toBe('https://github.com/ghostcoder42/r34/releases/tag/v0.4.0');
    expect(release.apkUrl).toBe('https://x/r34.apk');
    expect(release.apkSize).toBe(42000000);
    expect(release.publishedAt).toBe('2026-09-05T10:00:00Z');
  });

  it('keeps apkUrl null when the release ships no APK asset', async () => {
    mockFetch(jsonResponse({ tag_name: 'v0.4.0', assets: [] }));

    const release = await fetchLatestRelease();

    expect(release.apkUrl).toBeNull();
    expect(release.apkSize).toBeUndefined();
    expect(release.releaseUrl).toBe('https://github.com/ghostcoder42/r34/releases/latest');
  });

  it('rejects payloads without a numeric dotted tag', async () => {
    mockFetch(jsonResponse({ tag_name: 'nightly', name: 'Nightly', body: 'x' }));

    await expect(fetchLatestRelease()).rejects.toThrow('Unexpected release payload');
  });
});
