import { getOrientationFlag1 } from '@/lib/stores/orientation-store';
import type { VideoDetail, VideoFormat, VideoListItem } from './types';

const BASE_URL = 'https://rule34video.com';
const USER_AGENT =
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125.0.0.0 Safari/537.36';

export async function fetchPage(url: string): Promise<string> {
  const controller = new AbortController();
  // Hard cap so a slow/hanging URL errors out instead of spinning forever.
  const timeout = setTimeout(() => controller.abort(), 12000);
  try {
    const response = await fetch(url, {
      headers: {
        'User-Agent': USER_AGENT,
        Referer: BASE_URL,
      },
      signal: controller.signal,
    });

    if (!response.ok) {
      // Attach the status so callers can tell "page gone" (404/410) apart
      // from reachability problems (offline, timeout, 5xx, …).
      const error = new Error(`Failed to fetch ${url}: ${response.status}`) as Error & {
        status?: number;
      };
      error.status = response.status;
      throw error;
    }

    return await response.text();
  } catch (error) {
    if (error instanceof Error && error.name === 'AbortError') {
      throw new Error(`Request timed out: ${url}`);
    }
    throw error;
  } finally {
    clearTimeout(timeout);
  }
}

export function parseVideoList(html: string): VideoListItem[] {
  const videos: VideoListItem[] = [];
  // Anchor on the video link, then extract surrounding fields from a region.
  // NOTE: use positional capture groups (match[1..n]) — Hermes' matchAll does
  // not populate `.groups` for named captures the way V8 does.
  const anchorRegex =
    /<a\s+class="th[^"]*"\s+href="https:\/\/rule34video\.com\/video\/(\d+)\/([^/]+)\/"\s+title="([^"]+)"/g;

  for (const match of html.matchAll(anchorRegex)) {
    const start = match.index ?? 0;
    const region = html.slice(start, start + 3000);
    const pick = (re: RegExp): string | undefined => region.match(re)?.[1]?.trim();

    const thumbnail = pick(/data-original="([^"]+)"/);
    const preview =
      pick(/<div class="img[^"]*"\s+data-preview="([^"]*)"/) || pick(/data-preview="([^"]*)"/);
    const duration = pick(/<div class="time">([^<]+)<\/div>/);
    const views = pick(/<div class="views">[\s\S]*?<\/svg>\s*([^<]+?)\s*<\/div>/);
    const rating = pick(/<div class="rating">[\s\S]*?<\/svg>\s*([^<]+?)\s*<\/div>/);

    videos.push({
      id: match[1],
      slug: match[2],
      title: match[3],
      thumbnail: thumbnail ?? '',
      duration: duration ?? '',
      views: views ?? '',
      rating: rating ?? '',
      previewUrl: preview || undefined,
    });
  }

  return videos;
}

export function parseVideoDetail(html: string, videoId: string, slug: string): VideoDetail {
  // Extract video URLs from embedded JS
  const videoUrlMatch = html.match(/video_url:\s*'([^']+)'/);
  const videoAltUrlMatch = html.match(/video_alt_url:\s*'([^']+)'/);
  const videoAltUrl2Match = html.match(/video_alt_url2:\s*'([^']+)'/);
  const previewUrlMatch = html.match(/preview_url:\s*'([^']+)'/);

  const formats: VideoFormat[] = [];

  if (videoUrlMatch?.[1]) {
    formats.push({
      url: videoUrlMatch[1],
      quality: '360p',
      ext: 'mp4',
    });
  }

  if (videoAltUrlMatch?.[1]) {
    formats.push({
      url: videoAltUrlMatch[1],
      quality: '480p',
      ext: 'mp4',
    });
  }

  if (videoAltUrl2Match?.[1]) {
    formats.push({
      url: videoAltUrl2Match[1],
      quality: '720p',
      ext: 'mp4',
    });
  }

  // Also check for download links
  const downloadRegex = /<a[^>]+href="([^"]+download=true[^"]+)"[^>]*>([^\s]+)\s+([^<]+)p<\/a>/g;

  for (const match of html.matchAll(downloadRegex)) {
    const [_, url, ext, quality] = match;
    const existingFormat = formats.find((f) => f.quality === `${quality}p`);
    if (!existingFormat) {
      formats.push({
        url,
        quality: `${quality}p`,
        ext: ext.toLowerCase(),
      });
    }
  }

  // Extract title
  const titleMatch = html.match(/<title>(.*?)<\/title>/);
  const title = titleMatch ? titleMatch[1].replace(' - Rule34Video', '') : '';

  // Extract thumbnail
  const thumbnail = previewUrlMatch?.[1] || '';

  // Extract duration
  const durationMatch = html.match(/"icon-clock"><\/i>\s+<span>((?:\d+:?)+)/);
  const duration = durationMatch?.[1] || '';

  // Extract views
  const viewsMatch = html.match(/"icon-eye"><\/i>\s+<span>([ \d]+)/);
  const views = viewsMatch?.[1]?.trim() || '';

  // Extract rating
  const ratingMatch = html.match(/<span class="voters count">(\d+)<\/span>/);
  const rating = ratingMatch?.[1] || '';

  // Extract tags. Site tag URLs are /tags/{id}/ — keep both id (for fetching)
  // and name (for display).
  const tags: { id: string; name: string }[] = [];
  const tagRegex =
    /<a class="tag_item"\s+href="https:\/\/rule34video\.com\/tags\/(\d+)\/"[^>]*>([^<]+)<\/a>/g;

  for (const match of html.matchAll(tagRegex)) {
    tags.push({ id: match[1], name: match[2].trim() });
  }

  // Extract categories
  const categories: string[] = [];
  const categoryRegex = /<a href="[^"]*\/categories\/[^"]*"[^>]*>([^<]+)<\/a>/g;

  for (const match of html.matchAll(categoryRegex)) {
    categories.push(match[1].trim());
  }

  // Extract uploader (a site member). Capture the member id from the profile
  // link and the name from the avatar's alt attribute.
  const uploaderMatch = html.match(
    /Uploaded by<\/div>\s*<a[^>]+href="(?<url>https:\/\/rule34video\.com\/members\/(?<id>\d+)\/)"[\s\S]*?alt="(?<name>[^"]*)"/i
  );
  const uploader = uploaderMatch?.groups?.name?.trim();
  const uploaderMemberId = uploaderMatch?.groups?.id;

  // Extract artist
  const artistMatch = html.match(
    /<a[^>]+class="item btn_link"[^>]+href="(?<url>[^"]+)"[^>]*>\s*<span class="name">\s*(?<name>[^<]+)\s*<\/span>\s*<\/a>/i
  );
  const artist = artistMatch?.groups?.name?.trim();

  // Extract description
  const descriptionMatch = html.match(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/);
  let description = '';
  if (descriptionMatch?.[1]) {
    try {
      const jsonLd = JSON.parse(descriptionMatch[1]);
      description = jsonLd.description || '';
    } catch {
      // Ignore JSON parse errors
    }
  }

  return {
    id: videoId,
    slug,
    title,
    thumbnail,
    duration,
    views,
    rating,
    previewUrl: previewUrlMatch?.[1],
    formats,
    tags,
    categories,
    artist,
    uploader,
    uploaderMemberId,
    description,
  };
}

export function buildListUrl(params: {
  page?: number;
  search?: string;
  model?: string;
  tags?: string;
  category?: string;
  member?: string;
}): string | null {
  const { page = 1, search, model, tags, category, member } = params;

  // The site's search only serves the first page as a real URL (/search/{q}/).
  // Pagination beyond page 1 is AJAX-only (data-action="ajax" with from_videos
  // params), so there is no URL we can fetch — return null to stop paging.
  let url: string | null = null;
  if (search || category) {
    const term = search || category;
    if (page > 1) return null;
    url = `${BASE_URL}/search/${encodeURIComponent(term as string)}/`;
  } else if (model) {
    url = `${BASE_URL}/models/${model}/${page}/`;
  } else if (member) {
    // Member (uploader) profile pagination is AJAX-only, so only page 1 is
    // reachable by URL — stop paging after that.
    if (page > 1) return null;
    url = `${BASE_URL}/members/${member}/`;
  } else if (tags) {
    url = `${BASE_URL}/tags/${tags}/${page}/`;
  } else if (page === 1) {
    url = `${BASE_URL}/`;
  } else {
    url = `${BASE_URL}/latest-updates/${page}/`;
  }

  // Apply the user's orientation selection. The site's `?flag1=` param accepts
  // a comma-joined list and produces the exact same multi-select result as its
  // own category_group_id cookie — but as a URL param it isn't stripped by the
  // platform networking layer (a manual Cookie header is). This is the single
  // place orientation enters the request, so every list is filtered.
  return appendOrientation(url);
}

/** Appends `?flag1=<ids>` when the user has selected any orientation. */
function appendOrientation(url: string): string {
  const flag1 = getOrientationFlag1();
  if (!flag1) return url;
  return `${url}${url.includes('?') ? '&' : '?'}flag1=${flag1}`;
}

export function buildVideoUrl(id: string, slug: string): string {
  return `${BASE_URL}/video/${id}/${slug}/`;
}
