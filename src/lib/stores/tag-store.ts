import { create } from 'zustand';

import { getItem, setItem } from '@/lib/storage';

const FAVORITE_TAGS_KEY = 'favorite_tags';

type TagStore = {
  favoriteTags: string[];
  addTag: (tag: string) => void;
  removeTag: (tag: string) => void;
  isFavorite: (tag: string) => boolean;
};

export const useTagStore = create<TagStore>((set, get) => ({
  favoriteTags: getItem<string[]>(FAVORITE_TAGS_KEY) ?? [],

  addTag: (tag: string) => {
    const { favoriteTags } = get();
    if (favoriteTags.includes(tag)) return;
    const updated = [...favoriteTags, tag];
    setItem(FAVORITE_TAGS_KEY, updated);
    set({ favoriteTags: updated });
  },

  removeTag: (tag: string) => {
    const updated = get().favoriteTags.filter((t) => t !== tag);
    setItem(FAVORITE_TAGS_KEY, updated);
    set({ favoriteTags: updated });
  },

  isFavorite: (tag: string) => {
    return get().favoriteTags.includes(tag);
  },
}));
