import i18n from '@/lib/i18n';
import { showMessage } from 'react-native-flash-message';

/**
 * Classification of a failed site fetch, so the UI can say what actually went
 * wrong instead of a generic "error". `fetchPage` throws `FetchError`s that
 * carry the resolved `kind` (plus the status, url and a raw detail kept for
 * the in-app log viewer); anything arriving without one is classified from
 * its shape (status-attached errors, "Request timed out" prefixes) as before.
 */
export type FetchErrorKind =
  | 'offline'
  | 'unreachable'
  | 'timeout'
  | 'rate-limited'
  | 'blocked'
  | 'not-found'
  | 'server'
  | 'http';

/**
 * A classified fetch failure. Transport failures are disambiguated with a
 * connectivity probe: if a known-good endpoint answers, the device is online
 * and the site itself is refusing/dropping us (IP block, TLS interference);
 * if it doesn't, the device has no usable internet.
 */
export class FetchError extends Error {
  readonly kind: FetchErrorKind;
  readonly status?: number;
  readonly url?: string;
  /** Raw underlying error/response text, kept for the in-app log viewer. */
  readonly detail?: string;

  constructor(
    kind: FetchErrorKind,
    opts: { message?: string; status?: number; url?: string; detail?: string } = {}
  ) {
    super(opts.message ?? kind);
    this.name = 'FetchError';
    this.kind = kind;
    this.status = opts.status;
    this.url = opts.url;
    this.detail = opts.detail;
  }
}

export function classifyFetchError(error: unknown): FetchErrorKind {
  if (error instanceof FetchError) return error.kind;
  const status = (error as (Error & { status?: number }) | null)?.status;
  if (typeof status === 'number') {
    if (status === 429 || status === 418) return 'rate-limited';
    if (status === 403) return 'blocked';
    if (status === 404 || status === 410) return 'not-found';
    if (status >= 500) return 'server';
    return 'http';
  }
  const message = error instanceof Error ? error.message : '';
  if (message.startsWith('Request timed out')) return 'timeout';
  return 'offline';
}

const MESSAGE_KEYS: Record<FetchErrorKind, string> = {
  offline: 'net.offline',
  unreachable: 'net.unreachable',
  timeout: 'net.timeout',
  'rate-limited': 'net.rate_limited',
  blocked: 'net.blocked',
  'not-found': 'net.not_found',
  server: 'net.server',
  http: 'net.http_error',
};

/**
 * The localized message for a classified fetch error (see MESSAGE_KEYS) —
 * used by the toast below and by dialogs that need the same wording.
 */
export function fetchErrorMessage(error: unknown): string {
  const kind = classifyFetchError(error);
  const status = (error as (Error & { status?: number }) | null)?.status;
  const translate = i18n.t.bind(i18n) as (key: string, options?: Record<string, unknown>) => string;
  return translate(MESSAGE_KEYS[kind], {
    ...(typeof status === 'number' ? { status: String(status) } : {}),
  });
}

/**
 * Small centered toast describing a failed fetch. Messages are classified
 * (see `classifyFetchError`) and localized; server/other-HTTP messages carry
 * the status code, e.g. "The site is having trouble (502) — try again later".
 */
export function showFetchErrorToast(error: unknown): void {
  showMessage({
    message: fetchErrorMessage(error),
    type: 'warning',
    position: 'center',
    duration: 2500,
  });
}

/**
 * A short, locale-independent summary line for the log viewer / detail field.
 * A real 403 from this site's DDoS-Guard is a bare "Access denied." body —
 * there are no markers to sniff, so the trimmed body is all we have.
 */
export function httpErrorDetail(err: { status: number; body?: string }): string {
  return err.body ? err.body.slice(0, 200).replace(/\s+/g, ' ').trim() : '';
}

/** Classify a non-2xx HTTP response by status (body sniffed separately). */
export function classifyHttpStatus(status: number): FetchErrorKind {
  if (status === 429 || status === 418) return 'rate-limited';
  if (status === 403) return 'blocked';
  if (status === 404 || status === 410) return 'not-found';
  if (status >= 500) return 'server';
  return 'http';
}

const PROBE_URL = 'https://cp.cloudflare.com/generate_204';
const PROBE_TIMEOUT_MS = 5_000;

/**
 * Connectivity probe: fetch a tiny, highly-available endpoint (Cloudflare's
 * captive-portal check). `true` means the device has usable internet, so a
 * failing site request is the site's edge refusing/dropping us.
 */
async function probeInternet(): Promise<boolean> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), PROBE_TIMEOUT_MS);
  try {
    await fetch(PROBE_URL, {
      signal: controller.signal,
      headers: { Accept: '*/*' },
      cache: 'no-store',
    } as RequestInit);
    // Any answer at all (even a proxy error page) proves transport works.
    return true;
  } catch {
    return false;
  } finally {
    clearTimeout(timer);
  }
}

function isAbortError(err: unknown): boolean {
  return (
    (err instanceof DOMException && err.name === 'AbortError') ||
    (err instanceof Error && /abort/i.test(err.name)) ||
    // RN on Android surfaces AbortController fires as
    // "TypeError: fetch failed: Fetch request has been canceled" — without
    // the word "abort" anywhere.
    (err instanceof Error && /abort|cancel/i.test(err.message))
  );
}

/**
 * Classify a transport-level fetch failure. Aborts (incl. the RN-Android
 * "canceled" wording) map to timeout; anything else runs the connectivity
 * probe to tell "device offline" apart from "site unreachable/blocked".
 */
export async function classifyTransportError(err: unknown, url?: string): Promise<FetchError> {
  const raw = err instanceof Error ? `${err.name}: ${err.message}` : String(err);
  if (isAbortError(err)) {
    return new FetchError('timeout', { message: 'Request timed out', url, detail: raw });
  }
  const online = await probeInternet();
  return new FetchError(online ? 'unreachable' : 'offline', {
    message: online ? 'Site unreachable (connection dropped or refused)' : 'No internet',
    url,
    detail: raw,
  });
}
