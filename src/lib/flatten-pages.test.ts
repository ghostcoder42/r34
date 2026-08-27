import { flattenUniquePages } from './flatten-pages';

type Item = { id: string };
const page = (...items: string[]): { data: Item[] } => ({ data: items.map((id) => ({ id })) });

describe('flattenUniquePages', () => {
  it('returns empty array for undefined pages', () => {
    expect(flattenUniquePages(undefined, (i: Item) => i.id)).toEqual([]);
  });

  it('concatenates pages in order when there are no duplicates', () => {
    const out = flattenUniquePages([page('a', 'b'), page('c')], (i) => i.id);
    expect(out.map((i) => i.id)).toEqual(['a', 'b', 'c']);
  });

  it('keeps the first occurrence of an id and drops later duplicates', () => {
    // Simulates site churn: page 4's head re-lists page 3's tail.
    const out = flattenUniquePages([page('v1', 'v2', 'v3'), page('v2', 'v3', 'v4')], (i) => i.id);
    expect(out.map((i) => i.id)).toEqual(['v1', 'v2', 'v3', 'v4']);
  });

  it('drops duplicates within a single page too', () => {
    const out = flattenUniquePages([page('v1', 'v1', 'v2')], (i) => i.id);
    expect(out.map((i) => i.id)).toEqual(['v1', 'v2']);
  });

  it('drops a duplicate that reappears many pages later', () => {
    const out = flattenUniquePages(
      [page('v1'), page('v2'), page('v3'), page('v4'), page('v1', 'v5')],
      (i) => i.id
    );
    expect(out.map((i) => i.id)).toEqual(['v1', 'v2', 'v3', 'v4', 'v5']);
  });

  it('handles pages with empty data arrays', () => {
    const out = flattenUniquePages([{ data: [] }, page('v1'), { data: [] }], (i) => i.id);
    expect(out.map((i) => i.id)).toEqual(['v1']);
  });

  it('preserves item objects (identity of the first occurrence)', () => {
    const first = { id: 'x', title: 'first' };
    const dup = { id: 'x', title: 'dup' };
    const out = flattenUniquePages([{ data: [first] }, { data: [dup] }], (i) => i.id);
    expect(out).toEqual([first]);
  });
});
