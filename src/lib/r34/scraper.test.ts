import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import { useOrientationStore } from '@/lib/stores/orientation-store';
import { buildListUrl, buildVideoUrl, parseVideoDetail, parseVideoList } from './scraper';

const fixturesDir = join(__dirname, '..', '..', '..', '__mocks__', 'fixtures');

const loadFixture = (name: string) => readFileSync(join(fixturesDir, name), 'utf-8');

describe('scraper', () => {
  describe('parseVideoList', () => {
    it('parses video list from homepage HTML', () => {
      const html = loadFixture('video-list.html');
      const videos = parseVideoList(html);

      expect(videos.length).toBe(2);
      expect(videos[0].id).toBe('4406161');
      expect(videos[0].slug).toBe('starfire-quick-hot-encounter');
      expect(videos[0].title).toBe('Starfire - Quick hot encounter');
      expect(videos[0].thumbnail).toBe(
        'https://rule34video.com/contents/videos_screenshots/4406000/4406161/320x180/10.jpg'
      );
      expect(videos[0].duration).toBe('1:23');
      expect(videos[0].views).toBe('5K');
      expect(videos[0].rating).toBe('85%');
      expect(videos[0].previewUrl).toBe('https://rule34video.com/get_file/51/4406161_preview.mp4/');
      expect(videos[1].id).toBe('4405998');
    });

    it('parses video list from search results HTML', () => {
      const html = loadFixture('video-list-search.html');
      const videos = parseVideoList(html);

      expect(videos.length).toBe(1);
      expect(videos[0].id).toBe('3064849');
      expect(videos[0].title).toBe('Zone - Test Sisters');
    });

    it('parses video list from tag page HTML', () => {
      const html = loadFixture('video-list-tag.html');
      const videos = parseVideoList(html);

      expect(videos.length).toBe(1);
      expect(videos[0].id).toBe('4398873');
    });

    it('returns empty array for empty HTML', () => {
      const html = loadFixture('empty.html');
      const videos = parseVideoList(html);

      expect(videos).toEqual([]);
    });

    it('returns empty array for random text', () => {
      const videos = parseVideoList('<html><body>no videos here</body></html>');

      expect(videos).toEqual([]);
    });

    // Regression guard: uses a snapshot of the real site's current HTML
    // structure. If the parser silently returns 0 (e.g. site markup changed,
    // or someone reintroduces named-capture `.groups` which Hermes ignores),
    // this test fails against real markup.
    it('parses a real-site HTML snapshot and populates every field', () => {
      const html = loadFixture('video-list-real.html');
      const videos = parseVideoList(html);

      expect(videos.length).toBe(2);
      for (const v of videos) {
        expect(v.id).toMatch(/^\d+$/);
        expect(v.slug).toBeTruthy();
        expect(v.title).toBeTruthy();
        expect(v.thumbnail).toMatch(/^https?:\/\//);
        expect(v.duration).toMatch(/^\d+:/);
        expect(v.views).toBeTruthy();
        expect(v.rating).toMatch(/%/);
        expect(v.previewUrl).toMatch(/^https?:\/\//);
      }
    });
  });

  describe('parseVideoDetail', () => {
    it('parses video detail from HTML', () => {
      const html = loadFixture('video-detail.html');
      const detail = parseVideoDetail(html, '4406161', 'starfire-quick-hot-encounter');

      expect(detail.id).toBe('4406161');
      expect(detail.slug).toBe('starfire-quick-hot-encounter');
      expect(detail.title).toBe('Starfire - Quick hot encounter');
      expect(detail.duration).toBe('1:23');
      expect(detail.views).toBe('5123');
      expect(detail.rating).toBe('247');
      expect(detail.formats.length).toBeGreaterThanOrEqual(2);
      expect(detail.formats[0].quality).toBe('360p');
      expect(detail.formats[1].quality).toBe('480p');
      expect(detail.tags).toContainEqual({ id: '12345', name: 'test tag' });
      expect(detail.tags).toContainEqual({ id: '67890', name: 'animation' });
      expect(detail.uploader).toBe('TestUser');
      expect(detail.uploaderMemberId).toBe('99999');
      expect(detail.artists).toEqual([
        { name: 'Starfire', slug: 'starfire' },
        { name: 'OpenNSFW (VA)', slug: 'opennsfw' },
      ]);
      expect(detail.categories).toContain('Test Category');
      expect(detail.description).toBe('A test video description for Starfire.');
    });

    it('does not treat sidebar "Top Artists" links as video artists', () => {
      const html = loadFixture('video-detail.html');
      const detail = parseVideoDetail(html, '4406161', 'starfire-quick-hot-encounter');

      // The fixture contains a sidebar-style link (class="item", no btn_link)
      // to /models/jackerman/ that must not bleed into the artist list.
      expect(detail.artists.some((a) => a.slug === 'jackerman')).toBe(false);
    });

    it('navigates artists by their real slug, not a name-derived one', () => {
      const html = loadFixture('video-detail.html');
      const detail = parseVideoDetail(html, '4406161', 'starfire-quick-hot-encounter');

      // "OpenNSFW (VA)" used to become the slug "opennsfw-(va)" (a 404 on the
      // site); the real slug from the href is "opennsfw".
      const derived = detail.artists[1].name.toLowerCase().replace(/\s+/g, '-');
      expect(derived).not.toBe(detail.artists[1].slug);
      expect(detail.artists[1].slug).toBe('opennsfw');
    });

    it('falls back to the anchor text when the uploader has no avatar', () => {
      const html = `
        <html><body><title>Minimal - Rule34Video</title>
        <div>Uploaded by</div>
        <a class="item btn_link video_meta_pill" href="https://rule34video.com/members/4242/">NoAvatarUser</a>
        </body></html>`;
      const detail = parseVideoDetail(html, '1', 'x');

      expect(detail.uploaderMemberId).toBe('4242');
      expect(detail.uploader).toBe('NoAvatarUser');
    });

    it('does not expose removed uploaderUrl field', () => {
      const html = loadFixture('video-detail.html');
      const detail = parseVideoDetail(html, '4406161', 'starfire-quick-hot-encounter') as Record<
        string,
        unknown
      >;

      expect(detail.uploaderUrl).toBeUndefined();
    });

    it('handles missing fields gracefully', () => {
      const html = '<html><body><title>Minimal</title></body></html>';
      const detail = parseVideoDetail(html, '123', 'minimal');

      expect(detail.id).toBe('123');
      expect(detail.slug).toBe('minimal');
      expect(detail.title).toBe('Minimal');
      expect(detail.formats).toEqual([]);
      expect(detail.tags).toEqual([]);
      expect(detail.artists).toEqual([]);
      expect(detail.uploader).toBeUndefined();
      expect(detail.uploaderMemberId).toBeUndefined();
    });
  });

  describe('buildListUrl', () => {
    it('builds default URL', () => {
      expect(buildListUrl({})).toBe('https://rule34video.com/');
    });

    it('builds URL with page', () => {
      expect(buildListUrl({ page: 2 })).toBe('https://rule34video.com/latest-updates/2/');
    });

    it('builds search URL (page 1 is bare, no /1/)', () => {
      expect(buildListUrl({ search: 'test query' })).toBe(
        'https://rule34video.com/search/test%20query/'
      );
    });

    it('returns null for search page >1 (AJAX-only pagination)', () => {
      expect(buildListUrl({ search: 'test', page: 2 })).toBeNull();
      expect(buildListUrl({ category: 'straight', page: 2 })).toBeNull();
    });

    it('builds model URL', () => {
      expect(buildListUrl({ model: 'jackerman' })).toBe(
        'https://rule34video.com/models/jackerman/1/'
      );
    });

    it('builds tags URL', () => {
      expect(buildListUrl({ tags: '12345' })).toBe('https://rule34video.com/tags/12345/1/');
    });

    it('builds member URL (page 1 only; pagination is AJAX-only)', () => {
      expect(buildListUrl({ member: '233918' })).toBe('https://rule34video.com/members/233918/');
      expect(buildListUrl({ member: '233918', page: 2 })).toBeNull();
    });

    it('builds category URL via search (site categories are franchises)', () => {
      expect(buildListUrl({ category: 'ben-10' })).toBe('https://rule34video.com/search/ben-10/');
    });

    it('appends the multi-select orientation as ?flag1= on every list URL', () => {
      useOrientationStore.setState({ selectedIds: ['192', '1821'] });
      try {
        expect(buildListUrl({ page: 1 })).toBe('https://rule34video.com/?flag1=192,1821');
        expect(buildListUrl({ page: 2 })).toBe(
          'https://rule34video.com/latest-updates/2/?flag1=192,1821'
        );
        expect(buildListUrl({ tags: '12345', page: 1 })).toBe(
          'https://rule34video.com/tags/12345/1/?flag1=192,1821'
        );
        expect(buildListUrl({ search: 'zone' })).toBe(
          'https://rule34video.com/search/zone/?flag1=192,1821'
        );
      } finally {
        useOrientationStore.setState({ selectedIds: [] });
      }
    });
  });

  describe('buildVideoUrl', () => {
    it('builds video URL', () => {
      expect(buildVideoUrl('12345', 'test-video')).toBe(
        'https://rule34video.com/video/12345/test-video/'
      );
    });
  });
});
