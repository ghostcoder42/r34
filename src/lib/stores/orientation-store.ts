import { create } from 'zustand';

import { getItem, setItem } from '@/lib/storage';

const ORIENTATION_KEY = 'content_orientation';

/**
 * Content orientation / source filters. These map to rule34video.com's
 * "category groups" and are applied to every list request as the `?flag1=`
 * URL param (a comma-joined list of selected group ids — the same multi-select
 * result the site gets from its own `category_group_id` cookie, but as a URL
 * param so the platform networking layer doesn't strip it). Empty = "All".
 *
 * Ids verified against the site: 2109 Straight · 192 Gay · 15 Futa · 1821 Iwara.
 */
export const ORIENTATIONS = [
  { id: '2109', label: 'Straight' },
  { id: '192', label: 'Gay' },
  { id: '15', label: 'Futa' },
  { id: '1821', label: 'Iwara' },
] as const;

type OrientationState = {
  /** Selected category-group ids. Empty = All (no filtering). */
  selectedIds: string[];
  toggle: (id: string) => void;
  clear: () => void;
  isSelected: (id: string) => boolean;
};

export const useOrientationStore = create<OrientationState>((set, get) => ({
  selectedIds: getItem<string[]>(ORIENTATION_KEY) ?? [],

  toggle: (id) =>
    set((s) => {
      const selectedIds = s.selectedIds.includes(id)
        ? s.selectedIds.filter((x) => x !== id)
        : [...s.selectedIds, id];
      setItem(ORIENTATION_KEY, selectedIds);
      return { selectedIds };
    }),

  clear: () => {
    setItem(ORIENTATION_KEY, []);
    set({ selectedIds: [] });
  },

  isSelected: (id) => get().selectedIds.includes(id),
}));

/**
 * The selected ids joined for the site's `?flag1=` query param, or `null` when
 * nothing is selected. Consumed by `buildListUrl` so every list request is
 * filtered by the user's selection.
 */
export function getOrientationFlag1(): string | null {
  const { selectedIds } = useOrientationStore.getState();
  return selectedIds.length > 0 ? selectedIds.join(',') : null;
}
