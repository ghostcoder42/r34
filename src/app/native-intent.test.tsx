import { redirectSystemPath } from './+native-intent';

describe('redirectSystemPath', () => {
  it('rewrites site video URLs to the post route', () => {
    expect(
      redirectSystemPath({ path: 'https://rule34video.com/video/42/slug/', initial: false })
    ).toBe('/post/42');
  });

  it('rewrites tag URLs', () => {
    expect(redirectSystemPath({ path: 'https://rule34video.com/tags/7/', initial: true })).toBe(
      '/tag/7'
    );
  });

  it('encodes search terms', () => {
    expect(
      redirectSystemPath({ path: 'https://rule34video.com/search/mai shiranui/', initial: false })
    ).toBe('/search?q=mai%20shiranui');
  });

  it('passes non-site URLs through unchanged', () => {
    expect(redirectSystemPath({ path: 'https://example.com/video/1/', initial: false })).toBe(
      'https://example.com/video/1/'
    );
  });

  it('returns the original path for malformed input', () => {
    expect(redirectSystemPath({ path: '', initial: false })).toBe('');
    expect(redirectSystemPath({ path: 'not a url', initial: true })).toBe('not a url');
  });
});
