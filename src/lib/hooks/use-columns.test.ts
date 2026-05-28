import { computeColumns } from './use-columns';

describe('computeColumns', () => {
  it('returns at least 1 column on very narrow screens', () => {
    expect(computeColumns(100, 220)).toBe(1);
    expect(computeColumns(0, 220)).toBe(1);
  });

  it('floors the width / minTileWidth ratio', () => {
    expect(computeColumns(440, 220)).toBe(2);
    expect(computeColumns(450, 220)).toBe(2); // floor(2.04)
    expect(computeColumns(660, 220)).toBe(3);
    expect(computeColumns(1100, 220)).toBe(5);
  });

  it('respects the max cap', () => {
    expect(computeColumns(3000, 220, 6)).toBe(6);
    expect(computeColumns(5000, 220, 4)).toBe(4);
  });

  it('honours a custom minTileWidth', () => {
    expect(computeColumns(900, 300)).toBe(3);
    expect(computeColumns(899, 300)).toBe(2);
  });
});
