import { parseSiteUrl, siteRouteToPath } from './site-links';

describe('parseSiteUrl', () => {
  it.each([
    [
      'video detail',
      'https://rule34video.com/video/12345/some-slug/',
      {
        pathname: '/post/[id]',
        params: { id: '12345', slug: 'some-slug' },
      },
    ],
    [
      'video detail without slug',
      'https://rule34video.com/video/12345/',
      {
        pathname: '/post/[id]',
        params: { id: '12345' },
      },
    ],
    [
      'tag list',
      'https://rule34video.com/tags/77/',
      { pathname: '/tag/[id]', params: { id: '77' } },
    ],
    [
      'model list',
      'https://rule34video.com/models/some-model/',
      {
        pathname: '/model/[slug]',
        params: { slug: 'some-model' },
      },
    ],
    [
      'member list',
      'https://rule34video.com/members/9/',
      {
        pathname: '/author/[id]',
        params: { id: '9' },
      },
    ],
    [
      'search with term',
      'https://rule34video.com/search/mai/',
      {
        pathname: '/search',
        params: { q: 'mai' },
      },
    ],
    [
      'category',
      'https://rule34video.com/categories/3d/',
      {
        pathname: '/category/[name]',
        params: { name: '3d' },
      },
    ],
  ])('maps %s to the in-app route', (_name, url, expected) => {
    expect(parseSiteUrl(url)).toEqual(expected);
  });

  it('accepts www prefix and http scheme', () => {
    expect(parseSiteUrl('http://www.rule34video.com/video/1/a/')).toEqual({
      pathname: '/post/[id]',
      params: { id: '1', slug: 'a' },
    });
  });

  it('decodes percent-encoded path segments', () => {
    expect(parseSiteUrl('https://rule34video.com/search/mai%20shiranui/')).toEqual({
      pathname: '/search',
      params: { q: 'mai shiranui' },
    });
  });

  it.each([
    ['home page', 'https://rule34video.com/'],
    ['unsupported section', 'https://rule34video.com/latest-updates/'],
    ['bare section root', 'https://rule34video.com/tags/'],
  ])('falls back to home for %s', (_name, url) => {
    expect(parseSiteUrl(url)).toEqual({ pathname: '/(app)', params: {} });
  });

  it.each([
    ['other host', 'https://example.com/video/1/a/'],
    ['deep-link scheme', 'r34://post/1'],
    ['javascript scheme', 'javascript:alert(1)'],
    ['garbage', 'not a url'],
    ['empty string', ''],
  ])('returns null for %s', (_name, url) => {
    expect(parseSiteUrl(url)).toBeNull();
  });
});

describe('siteRouteToPath', () => {
  it.each([
    ['/post/[id]', { id: '42' }, '/post/42'],
    ['/tag/[id]', { id: '7' }, '/tag/7'],
    ['/model/[slug]', { slug: 'artist-name' }, '/model/artist-name'],
    ['/author/[id]', { id: '9' }, '/author/9'],
    ['/category/[name]', { name: '3d' }, '/category/3d'],
    ['/search', { q: 'mai' }, '/search?q=mai'],
    ['/(app)', {}, '/'],
  ])('maps %s to %s', (pathname, params, expected) => {
    expect(siteRouteToPath({ pathname, params })).toBe(expected);
  });

  it('encodes the search query', () => {
    expect(siteRouteToPath({ pathname: '/search', params: { q: 'mai shiranui' } })).toBe(
      '/search?q=mai%20shiranui'
    );
  });

  it('drops the query when q is empty', () => {
    expect(siteRouteToPath({ pathname: '/search', params: {} })).toBe('/search');
  });
});
