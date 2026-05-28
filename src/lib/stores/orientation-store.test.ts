jest.mock('@/lib/storage', () => {
  const store: Record<string, unknown> = {};
  return {
    __esModule: true,
    getItem: <T>(key: string): T | null => (key in store ? (store[key] as T) : null),
    setItem: (key: string, value: unknown) => {
      store[key] = value;
    },
  };
});

import { ORIENTATIONS, getOrientationFlag1, useOrientationStore } from './orientation-store';

beforeEach(() => {
  useOrientationStore.setState({ selectedIds: [] });
});

describe('orientation-store', () => {
  it('defaults to nothing selected (All)', () => {
    expect(useOrientationStore.getState().selectedIds).toEqual([]);
  });

  it('toggles ids on and off and persists them', () => {
    useOrientationStore.getState().toggle('2109');
    expect(useOrientationStore.getState().selectedIds).toEqual(['2109']);

    useOrientationStore.getState().toggle('192');
    expect(useOrientationStore.getState().selectedIds).toEqual(['2109', '192']);

    // toggling again removes
    useOrientationStore.getState().toggle('2109');
    expect(useOrientationStore.getState().selectedIds).toEqual(['192']);
  });

  it('clears the selection', () => {
    useOrientationStore.getState().toggle('2109');
    useOrientationStore.getState().clear();
    expect(useOrientationStore.getState().selectedIds).toEqual([]);
  });

  it('exposes the verified orientation list (no All/Trans/Music)', () => {
    const ids = ORIENTATIONS.map((o) => o.id);
    expect(ids).toEqual(['2109', '192', '15', '1821']);
    const labels = ORIENTATIONS.map((o) => o.label);
    expect(labels).toEqual(['Straight', 'Gay', 'Futa', 'Iwara']);
  });
});

describe('getOrientationFlag1', () => {
  it('returns null when nothing is selected', () => {
    expect(getOrientationFlag1()).toBeNull();
  });

  it('joins the selected ids into a comma-list for the flag1 param', () => {
    useOrientationStore.getState().toggle('2109');
    useOrientationStore.getState().toggle('1821');
    expect(getOrientationFlag1()).toBe('2109,1821');
  });
});
