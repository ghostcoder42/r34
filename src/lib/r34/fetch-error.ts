import i18n from '@/lib/i18n';
import { showMessage } from 'react-native-flash-message';

/**
 * Classification of a failed site fetch, so the UI can say what actually went
 * wrong instead of a generic "error". `fetchPage` attaches the HTTP `status`
 * to its errors and normalises aborts to "Request timed out: …"; anything
 * without a status is a transport-level failure (offline, DNS, reset).
 */
export type FetchErrorKind =
  | 'offline'
  | 'timeout'
  | 'rate-limited'
  | 'not-found'
  | 'server'
  | 'http';

export function classifyFetchError(error: unknown): FetchErrorKind {
  const status = (error as (Error & { status?: number }) | null)?.status;
  if (typeof status === 'number') {
    if (status === 429 || status === 418) return 'rate-limited';
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
  timeout: 'net.timeout',
  'rate-limited': 'net.rate_limited',
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
