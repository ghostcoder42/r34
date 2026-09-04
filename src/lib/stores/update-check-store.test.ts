jest.mock('@/lib/storage', () => {
  const store: Record<string, string> = {};
  return {
    __esModule: true,
    getItem: <T>(key: string): T | null => (key in store ? JSON.parse(store[key]) : null),
    setItem: (key: string, value: unknown) => {
      store[key] = JSON.stringify(value);
    },
  };
});

import { AUTO_CHECK_INTERVAL_MS, shouldAutoCheck, useUpdateCheckStore } from './update-check-store';

const DAY = AUTO_CHECK_INTERVAL_MS;

beforeEach(() => {
  useUpdateCheckStore.setState({ lastCheckedAt: null });
});

describe('useUpdateCheckStore', () => {
  it('records the check time and persists it to storage', () => {
    const { getItem } = jest.requireMock('@/lib/storage');

    useUpdateCheckStore.getState().recordCheck(1000);

    expect(useUpdateCheckStore.getState().lastCheckedAt).toBe(1000);
    expect(getItem('update.last_check_at')).toBe(1000);
  });
});

describe('shouldAutoCheck', () => {
  it('is due before any check ever ran', () => {
    expect(shouldAutoCheck()).toBe(true);
  });

  it('is not due within a day of the last check', () => {
    useUpdateCheckStore.getState().recordCheck(1_000_000);

    expect(shouldAutoCheck(1_000_000 + DAY - 1)).toBe(false);
    expect(shouldAutoCheck(1_000_000 + DAY)).toBe(true);
  });
});
