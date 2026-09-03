jest.mock('react-native-flash-message', () => ({
  showMessage: jest.fn(),
}));

import { showMessage } from 'react-native-flash-message';

import { resources } from '@/lib/i18n/resources';

import { classifyFetchError, showFetchErrorToast } from './fetch-error';

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
    expect(classifyFetchError(httpError(403))).toBe('http');
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
