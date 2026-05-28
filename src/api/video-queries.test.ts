import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import { useModelVideos, useVideoDetail, useVideos } from './video-queries';

const fixturesDir = join(__dirname, '..', '..', '__mocks__', 'fixtures');
const loadFixture = (name: string) => readFileSync(join(fixturesDir, name), 'utf-8');

jest.mock('@/lib/r34/scraper', () => {
  const actual = jest.requireActual('@/lib/r34/scraper');
  return {
    ...actual,
    fetchPage: jest.fn(),
  };
});

describe('video-queries', () => {
  describe('useVideos fetcher', () => {
    it('fetches and parses video list', async () => {
      const { fetchPage } = jest.requireMock('@/lib/r34/scraper') as {
        fetchPage: jest.Mock;
      };
      fetchPage.mockResolvedValueOnce(loadFixture('video-list.html'));

      const fetcher = useVideos.fetcher as (
        vars: unknown,
        context: { pageParam: unknown }
      ) => Promise<unknown>;
      const result = await fetcher({}, { pageParam: 1 });

      expect(result).toEqual({
        data: expect.arrayContaining([expect.objectContaining({ id: '4406161' })]),
        nextCursor: 2,
      });
    });

    it('returns undefined nextCursor when no videos', async () => {
      const { fetchPage } = jest.requireMock('@/lib/r34/scraper') as {
        fetchPage: jest.Mock;
      };
      fetchPage.mockResolvedValueOnce(loadFixture('empty.html'));

      const fetcher = useVideos.fetcher as (
        vars: unknown,
        context: { pageParam: unknown }
      ) => Promise<unknown>;
      const result = await fetcher({}, { pageParam: 1 });

      expect(result).toEqual({
        data: [],
        nextCursor: undefined,
      });
    });
  });

  describe('useVideos fetcher pagination', () => {
    it('returns empty result without fetching for search page >1 (AJAX-only)', async () => {
      const { fetchPage } = jest.requireMock('@/lib/r34/scraper') as {
        fetchPage: jest.Mock;
      };
      fetchPage.mockClear();
      const fetcher = useVideos.fetcher as (
        vars: unknown,
        context: { pageParam: unknown }
      ) => Promise<unknown>;

      const result = await fetcher({ search: 'straight' }, { pageParam: 2 });

      expect(fetchPage).not.toHaveBeenCalled();
      expect(result).toEqual({ data: [], nextCursor: undefined });
    });

    it('search page 1 parses results but exposes no nextCursor', async () => {
      const { fetchPage } = jest.requireMock('@/lib/r34/scraper') as {
        fetchPage: jest.Mock;
      };
      fetchPage.mockClear();
      fetchPage.mockResolvedValueOnce(loadFixture('video-list-search.html'));
      const fetcher = useVideos.fetcher as (
        vars: unknown,
        context: { pageParam: unknown }
      ) => Promise<unknown>;

      const result = (await fetcher({ search: 'zone' }, { pageParam: 1 })) as {
        data: unknown[];
        nextCursor?: number;
      };

      expect(fetchPage).toHaveBeenCalledTimes(1);
      expect(result.data.length).toBeGreaterThan(0);
      expect(result.nextCursor).toBeUndefined();
    });

    it('category (search-backed) page 1 returns no nextCursor', async () => {
      const { fetchPage } = jest.requireMock('@/lib/r34/scraper') as {
        fetchPage: jest.Mock;
      };
      fetchPage.mockClear();
      fetchPage.mockResolvedValueOnce(loadFixture('video-list-search.html'));
      const fetcher = useVideos.fetcher as (
        vars: unknown,
        context: { pageParam: unknown }
      ) => Promise<unknown>;

      const result = (await fetcher({ category: 'gay' }, { pageParam: 1 })) as {
        nextCursor?: number;
      };
      expect(result.nextCursor).toBeUndefined();
    });
  });

  describe('useVideoDetail fetcher', () => {
    it('fetches and parses video detail', async () => {
      const { fetchPage } = jest.requireMock('@/lib/r34/scraper') as {
        fetchPage: jest.Mock;
      };
      fetchPage.mockResolvedValueOnce(loadFixture('video-detail.html'));

      const fetcher = useVideoDetail.fetcher as (vars: unknown) => Promise<unknown>;
      const result = await fetcher({
        id: '4406161',
        slug: 'starfire-quick-hot-encounter',
      });

      expect(result).toEqual(
        expect.objectContaining({
          id: '4406161',
          slug: 'starfire-quick-hot-encounter',
        })
      );
    });
  });

  describe('useModelVideos fetcher', () => {
    it('fetches model videos', async () => {
      const { fetchPage } = jest.requireMock('@/lib/r34/scraper') as {
        fetchPage: jest.Mock;
      };
      fetchPage.mockResolvedValueOnce(loadFixture('video-list.html'));

      const fetcher = useModelVideos.fetcher as (
        vars: unknown,
        context: { pageParam: unknown }
      ) => Promise<unknown>;
      const result = await fetcher({ modelSlug: 'jackerman' }, { pageParam: 1 });

      expect(result).toEqual({
        data: expect.arrayContaining([expect.objectContaining({ id: '4406161' })]),
        nextCursor: 2,
      });
    });
  });
});
