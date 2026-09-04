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

import {
  fetchLatestRelease,
  getLastUpdateCheck,
  isNewerVersion,
  recordLastUpdateCheck,
} from './updater';

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

  it('throws with the HTTP status attached for non-OK responses', async () => {
    mockFetch(jsonResponse({ message: 'rate limited' }, 403));

    await expect(fetchLatestRelease()).rejects.toMatchObject({ status: 403 });
  });
});

describe('last-check timestamp', () => {
  it('records and reads back the check time', () => {
    expect(getLastUpdateCheck()).toBeNull();

    recordLastUpdateCheck();

    expect(getLastUpdateCheck()).toBeGreaterThan(0);
  });
});
