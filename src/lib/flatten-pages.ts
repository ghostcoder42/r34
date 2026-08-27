/**
 * Flattens an infinite query's pages into a single list, dropping items whose
 * key was already seen.
 *
 * The video site re-lists items across page boundaries when its ordering
 * shifts between two page fetches (new uploads push everything down), so raw
 * concatenation can contain the same id twice. FlashList v2 keys cells by
 * `keyExtractor` id and silently leaves a blank cell for one of two items
 * sharing an id (the render stack assigns the key to only one of them), so
 * duplicate ids must never reach the list.
 */
export function flattenUniquePages<TItem>(
  pages: { data: TItem[] }[] | undefined,
  keyOf: (item: TItem) => string
): TItem[] {
  if (!pages) return [];
  const seen = new Set<string>();
  const out: TItem[] = [];
  for (const page of pages) {
    for (const item of page.data) {
      const key = keyOf(item);
      if (seen.has(key)) continue;
      seen.add(key);
      out.push(item);
    }
  }
  return out;
}
