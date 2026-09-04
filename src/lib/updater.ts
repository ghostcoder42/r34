import { getItem, setItem } from '@/lib/storage';

const GITHUB_LATEST_RELEASE_URL = 'https://api.github.com/repos/ghostcoder42/r34/releases/latest';
const REQUEST_TIMEOUT_MS = 10000;
const LAST_CHECK_KEY = 'update.last_check_at';
const MAX_NOTES_LENGTH = 1000;

export type ReleaseInfo = {
  /** Plain version, e.g. "0.4.0" (leading "v" from the git tag stripped). */
  version: string;
  /** Release title (np uses the tag, e.g. "v0.4.0"). */
  title: string;
  /** Release notes with markdown links flattened to their text. */
  notes: string;
};

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
    const json = (await response.json()) as { tag_name?: unknown; name?: unknown; body?: unknown };
    const tag = typeof json.tag_name === 'string' ? json.tag_name : '';
    return {
      version: normalizeVersion(tag),
      title: (typeof json.name === 'string' && json.name) || tag,
      notes: cleanNotes(typeof json.body === 'string' ? json.body : ''),
    };
  } catch (error) {
    if (error instanceof Error && error.name === 'AbortError') {
      throw new Error('Request timed out: release info');
    }
    throw error;
  } finally {
    clearTimeout(timeout);
  }
}

/** Strips a leading "v" from a git tag, e.g. "v0.4.0" → "0.4.0". */
function normalizeVersion(tag: string): string {
  return tag.replace(/^v/, '');
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

/** Markdown links → their text, collapsed whitespace, capped for a dialog. */
function cleanNotes(body: string): string {
  const cleaned = body
    .replace(/\[([^\]]+)\]\([^)]*\)/g, '$1')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
  return cleaned.length > MAX_NOTES_LENGTH ? `${cleaned.slice(0, MAX_NOTES_LENGTH)}…` : cleaned;
}

/** Timestamp (ms) of the last update check, for diagnostics/throttling. */
export function recordLastUpdateCheck(): void {
  setItem(LAST_CHECK_KEY, Date.now());
}

export function getLastUpdateCheck(): number | null {
  return getItem<number>(LAST_CHECK_KEY);
}
