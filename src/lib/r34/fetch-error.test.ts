jest.mock('react-native-flash-message', () => ({
  showMessage: jest.fn(),
}));

import { showMessage } from 'react-native-flash-message';

import { resources } from '@/lib/i18n/resources';

import {
  classifyFetchError,
  classifyTransportError,
  fetchErrorMessage,
  showFetchErrorToast,
} from './fetch-error';

const httpError = (status: number) => {
  const error = new Error(`Failed to fetch https://rule34video.com/x/: ${status}`) as Error & {
    status?: number;
  };
  error.status = status;
  return error;
};

describe('classifyFetchError', () => {
  it('classifies HTTP statuses', () => {
    expect(classifyFetchError(httpError(502))).toBe('server');
    expect(classifyFetchError(httpError(503))).toBe('server');
    expect(classifyFetchError(httpError(429))).toBe('rate-limited');
    expect(classifyFetchError(httpError(404))).toBe('not-found');
    expect(classifyFetchError(httpError(410))).toBe('not-found');
    expect(classifyFetchError(httpError(403))).toBe('blocked');
  });

  it('classifies transport failures by message', () => {
    expect(classifyFetchError(new Error('Request timed out: https://x/'))).toBe('timeout');
    expect(classifyFetchError(new Error('Network request failed'))).toBe('offline');
    expect(classifyFetchError(new TypeError('Network request failed'))).toBe('offline');
  });

  it('falls back to offline for unknown shapes', () => {
    expect(classifyFetchError(null)).toBe('offline');
    expect(classifyFetchError('boom')).toBe('offline');
  });
});

describe('classifyTransportError', () => {
  const realFetch = globalThis.fetch;
  afterEach(() => {
    globalThis.fetch = realFetch;
  });

  it('classifies RN-Android aborts ("Fetch request has been canceled") as timeout', async () => {
    // RN on Android surfaces AbortController fires as
    // "TypeError: fetch failed: Fetch request has been canceled" — without
    // the word "abort" anywhere (seen live on a hanime1 device, where it was
    // misclassified as offline and sent the probe needlessly).
    const err = new TypeError('fetch failed: Fetch request has been canceled');
    const result = await classifyTransportError(err, 'https://x/y');
    expect(result.kind).toBe('timeout');
  });

  it('classifies as offline when the connectivity probe also fails', async () => {
    globalThis.fetch = (async () => {
      throw new TypeError('Network request failed');
    }) as unknown as typeof fetch;
    const result = await classifyTransportError(
      new TypeError('Network request failed'),
      'https://x'
    );
    expect(result.kind).toBe('offline');
  });

  it('classifies as unreachable when the probe answers but the site does not', async () => {
    globalThis.fetch = (async () => ({ ok: true, status: 204 })) as unknown as typeof fetch;
    const result = await classifyTransportError(
      new TypeError('Network request failed'),
      'https://x'
    );
    expect(result.kind).toBe('unreachable');
    expect(result.detail).toContain('Network request failed');
  });
});

describe('fetchErrorMessage', () => {
  it('returns the same localized wording the toast uses, for dialogs', () => {
    expect(fetchErrorMessage(httpError(502))).toBe(
      resources.en.translation.net.server.replace('{{status}}', '502')
    );
    expect(fetchErrorMessage(new Error('Network request failed'))).toBe(
      resources.en.translation.net.offline
    );
  });
});

describe('showFetchErrorToast', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  const en = resources.en.translation.net;
  const lastCall = () => (showMessage as jest.Mock).mock.calls[0]?.[0];

  it('toasts a localized server message carrying the status', () => {
    showFetchErrorToast(httpError(502));

    expect(lastCall().message).toBe(en.server.replace('{{status}}', '502'));
    expect(lastCall().type).toBe('warning');
    expect(lastCall().position).toBe('center');
  });

  it('toasts an offline message without a status for transport failures', () => {
    showFetchErrorToast(new Error('Network request failed'));

    expect(lastCall().message).toBe(en.offline);
  });

  it('toasts a timeout message for aborted requests', () => {
    showFetchErrorToast(new Error('Request timed out: https://x/'));

    expect(lastCall().message).toBe(en.timeout);
  });

  it('toasts a rate-limit message', () => {
    showFetchErrorToast(httpError(429));

    expect(lastCall().message).toBe(en.rate_limited);
  });

  it('toasts a not-found message without a status suffix', () => {
    showFetchErrorToast(httpError(404));

    expect(lastCall().message).toBe(en.not_found);
  });
});
