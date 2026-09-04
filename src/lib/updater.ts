import { getItem, setItem } from '@/lib/storage';

const GITHUB_LATEST_RELEASE_URL = 'https://api.github.com/repos/ghostcoder42/r34/releases/latest';
const REQUEST_TIMEOUT_MS = 10000;
const LAST_CHECK_KEY = 'update.last_check_at';
const MAX_NOTES_LENGTH = 2000;

export type ReleaseInfo = {
  /** Plain version, e.g. "0.4.0" (leading "v" from the git tag stripped). */
  version: string;
  /** Release title (np uses the tag, e.g. "v0.4.0"). */
  title: string;
  /** Release notes with markdown flattened to plain text. */
  notes: string;
  /** Human-facing release page (works on every platform). */
  releaseUrl: string;
  /** Direct APK download URL when the release ships one (null otherwise). */
  apkUrl: string | null;
  /** APK asset size in bytes when an APK asset exists. */
  apkSize?: number;
  /** ISO publication timestamp, shown as a plain date (no Intl needed). */
  publishedAt?: string;
};

type GithubReleaseAsset = { name?: unknown; size?: unknown; browser_download_url?: unknown };
type GithubReleaseJson = {
  tag_name?: unknown;
  name?: unknown;
  published_at?: unknown;
  body?: unknown;
  html_url?: unknown;
  assets?: unknown;
};

/** Normalizes the GitHub /releases/latest payload; throws on unusable data. */
function parseRelease(json: GithubReleaseJson): ReleaseInfo {
  const tag = typeof json.tag_name === 'string' ? json.tag_name.replace(/^v/, '').trim() : '';
  if (!tag || !/^\d+(\.\d+)*$/.test(tag)) {
    throw new Error('Unexpected release payload');
  }

  const releaseUrl =
    typeof json.html_url === 'string' && json.html_url
      ? json.html_url
      : 'https://github.com/ghostcoder42/r34/releases/latest';

  let apkUrl: string | null = null;
  let apkSize: number | undefined;
  if (Array.isArray(json.assets)) {
    for (const asset of json.assets as GithubReleaseAsset[]) {
      if (
        typeof asset.name === 'string' &&
        asset.name.endsWith('.apk') &&
        typeof asset.browser_download_url === 'string'
      ) {
        apkUrl = asset.browser_download_url;
        if (typeof asset.size === 'number' && asset.size > 0) apkSize = asset.size;
        break;
      }
    }
  }

  const publishedAt =
    typeof json.published_at === 'string' && json.published_at ? json.published_at : undefined;

  return {
    version: tag,
    title: (typeof json.name === 'string' && json.name.trim()) || `v${tag}`,
    notes: cleanNotes(typeof json.body === 'string' ? json.body : ''),
    releaseUrl,
    apkUrl,
    apkSize,
    publishedAt,
  };
}

/**
 * Fetches the latest published GitHub release. The repo is public, so the
 * unauthenticated REST endpoint works (60 req/h rate limit is plenty for a
 * check per Settings visit). Errors carry the HTTP status where applicable,
 * so callers can reuse the classified fetch-error wording.
 */
export async function fetchLatestRelease(): Promise<ReleaseInfo> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
  try {
    const response = await fetch(GITHUB_LATEST_RELEASE_URL, {
      headers: {
        Accept: 'application/vnd.github+json',
        'User-Agent': 'r34-app',
      },
      signal: controller.signal,
    });
    if (!response.ok) {
      const error = new Error(`Failed to fetch release info: ${response.status}`) as Error & {
        status?: number;
      };
      error.status = response.status;
      throw error;
    }
    return parseRelease(await response.json());
  } catch (error) {
    if (error instanceof Error && error.name === 'AbortError') {
      throw new Error('Request timed out: release info');
    }
    throw error;
  } finally {
    clearTimeout(timeout);
  }
}

/** Numeric component-wise comparison; true when `latest` is newer than `current`. */
export function isNewerVersion(latest: string, current: string): boolean {
  const parse = (v: string) =>
    v
      .split('.')
      .map((part) => Number.parseInt(part, 10))
      .map((n) => (Number.isNaN(n) ? 0 : n));
  const a = parse(latest);
  const b = parse(current);
  const len = Math.max(a.length, b.length);
  for (let i = 0; i < len; i++) {
    const x = a[i] ?? 0;
    const y = b[i] ?? 0;
    if (x !== y) return x > y;
  }
  return false;
}

/**
 * Flatten release-note markdown to plain text (dialogs show no formatting).
 * GitHub bodies use CRLF — normalize first, or the stray \r glues lines
 * together on Android. Heading regex uses [ \t]* (not \s*) so it doesn't eat
 * the line break and glue the heading to the body.
 */
function cleanNotes(body: string): string {
  const cleaned = body
    .replace(/\r\n?/g, '\n')
    .replace(/\[([^\]]*)\]\([^)]*\)/g, '$1')
    .replace(/^#{1,6}[ \t]*/gm, '')
    .replace(/(\*\*|__|`+)/g, '')
    .replace(/^[ \t]*[-*+][ \t]+/gm, '• ')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
  return truncateText(cleaned, MAX_NOTES_LENGTH);
}

/** Clamp a text to `max` characters with an ellipsis. */
function truncateText(text: string, max: number): string {
  return text.length <= max ? text : `${text.slice(0, max).trimEnd()}…`;
}

/** Timestamp (ms) of the last update check, for diagnostics/throttling. */
export function recordLastUpdateCheck(): void {
  setItem(LAST_CHECK_KEY, Date.now());
}

export function getLastUpdateCheck(): number | null {
  return getItem<number>(LAST_CHECK_KEY);
}
