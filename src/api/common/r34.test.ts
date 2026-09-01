import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import { r34Client } from './r34';

const fixturesDir = join(__dirname, '..', '..', '..', '__mocks__', 'fixtures');
const loadFixture = (name: string) => readFileSync(join(fixturesDir, name), 'utf-8');

jest.mock('@/lib/r34/scraper', () => {
  const actual = jest.requireActual('@/lib/r34/scraper');
  return { ...actual, fetchPage: jest.fn() };
});

const { fetchPage } = jest.requireMock('@/lib/r34/scraper') as { fetchPage: jest.Mock };

beforeEach(() => {
  fetchPage.mockClear();
});

describe('r34Client', () => {
  describe('search', () => {
    it('fetches the search URL and returns parsed videos', async () => {
      fetchPage.mockResolvedValueOnce(loadFixture('video-list-search.html'));
      const result = await r34Client.search({ query: 'zone' });

      expect(fetchPage).toHaveBeenCalledWith('https://rule34video.com/search/zone/');
      expect(result.data.length).toBeGreaterThan(0);
      expect(result.data[0]).toEqual(expect.objectContaining({ id: '3064849' }));
    });

    it('encodes the query', async () => {
      fetchPage.mockResolvedValueOnce(loadFixture('video-list-search.html'));
      await r34Client.search({ query: 'big breasts' });

      expect(fetchPage).toHaveBeenCalledWith('https://rule34video.com/search/big%20breasts/');
    });
  });

  describe('getByTag', () => {
    it('fetches the tag URL and returns parsed videos', async () => {
      fetchPage.mockResolvedValueOnce(loadFixture('video-list-tag.html'));
      const result = await r34Client.getByTag({ tag: '12345' });

      expect(fetchPage).toHaveBeenCalledWith('https://rule34video.com/tags/12345/1/');
      expect(result.data[0]).toEqual(expect.objectContaining({ id: '4398873' }));
    });
  });

  describe('getVideoDetail', () => {
    it('parses id and slug from the canonical video URL', async () => {
      fetchPage.mockResolvedValueOnce(loadFixture('video-detail.html'));
      const result = await r34Client.getVideoDetail(
        'https://rule34video.com/video/4406161/starfire-quick-hot-encounter/'
      );

      expect(result.id).toBe('4406161');
      expect(result.slug).toBe('starfire-quick-hot-encounter');
    });

    it('returns parsed rich metadata', async () => {
      fetchPage.mockResolvedValueOnce(loadFixture('video-detail.html'));
      const result = await r34Client.getVideoDetail(
        'https://rule34video.com/video/4406161/starfire-quick-hot-encounter/'
      );

      expect(result.uploader).toBe('TestUser');
      expect(result.uploaderMemberId).toBe('99999');
      expect(result.artists).toEqual([
        { name: 'Starfire', slug: 'starfire' },
        { name: 'OpenNSFW (VA)', slug: 'opennsfw' },
      ]);
      expect(result.formats.length).toBeGreaterThan(0);
    });
  });
});
