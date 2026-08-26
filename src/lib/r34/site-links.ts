/**
 * Maps rule34video.com web URLs to in-app routes so that site links (opened
 * from outside the app, or picked up when the app is registered as a handler
 * for the domain) land on the corresponding screen instead of a browser.
 *
 * Pure string logic — no React imports — so it stays unit-testable.
 */

export const SITE_HOST = 'rule34video.com';

/** An expo-router target derived from a site URL. */
export type SiteRoute = {
  pathname: string;
  params: Record<string, string>;
};

/**
 * Turn a SiteRoute into a concrete path string (e.g. `/post/123`,
 * `/search?q=foo`) that expo-router's state-from-path parser can match.
 */
export function siteRouteToPath(route: SiteRoute): string {
  switch (route.pathname) {
    case '/post/[id]':
      return `/post/${route.params.id}`;
    case '/tag/[id]':
      return `/tag/${route.params.id}`;
    case '/model/[slug]':
      return `/model/${route.params.slug}`;
    case '/author/[id]':
      return `/author/${route.params.id}`;
    case '/category/[name]':
      return `/category/${route.params.name}`;
    case '/search':
      return route.params.q ? `/search?q=${encodeURIComponent(route.params.q)}` : '/search';
    default:
      return '/';
  }
}

/**
 * Parse a URL and, if it points at the scraped site, return the in-app route
 * for it. Returns null for anything the app can't map (other hosts, schemes,
 * malformed URLs) — callers should ignore such URLs.
 *
 * Known site paths:
 *   /video/{id}/{slug}/            → post detail
 *   /tags/{id}/                    → tag list
 *   /models/{slug}/                → model (artist) list
 *   /members/{id}/                 → member (uploader) list
 *   /search/{term}/                → search screen with the term submitted
 *   /categories/{slug}/            → category list
 *   everything else (/, /latest-updates/…) → home
 */
export function parseSiteUrl(url: string): SiteRoute | null {
  let parsed: URL;
  try {
    parsed = new URL(url);
  } catch {
    return null;
  }

  if (parsed.protocol !== 'https:' && parsed.protocol !== 'http:') return null;
  if (parsed.hostname.replace(/^www\./i, '') !== SITE_HOST) return null;

  const segs = parsed.pathname
    .split('/')
    .filter(Boolean)
    .map((s) => decodeURIComponent(s));

  switch (segs[0]) {
    case 'video':
      return segs[1]
        ? {
            pathname: '/post/[id]',
            params: { id: segs[1], ...(segs[2] ? { slug: segs[2] } : {}) },
          }
        : { pathname: '/(app)', params: {} };
    case 'tags':
      return segs[1]
        ? { pathname: '/tag/[id]', params: { id: segs[1] } }
        : { pathname: '/(app)', params: {} };
    case 'models':
      return segs[1]
        ? { pathname: '/model/[slug]', params: { slug: segs[1] } }
        : { pathname: '/(app)', params: {} };
    case 'members':
      return segs[1]
        ? { pathname: '/author/[id]', params: { id: segs[1] } }
        : { pathname: '/(app)', params: {} };
    case 'search':
      // The search screen reads `q` to pre-fill and submit the query.
      return segs[1]
        ? { pathname: '/search', params: { q: segs[1] } }
        : { pathname: '/(app)', params: {} };
    case 'categories':
      return segs[1]
        ? { pathname: '/category/[name]', params: { name: segs[1] } }
        : { pathname: '/(app)', params: {} };
    default:
      return { pathname: '/(app)', params: {} };
  }
}
