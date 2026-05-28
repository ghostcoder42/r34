import { create } from 'zustand';

import type { Post } from '@/lib/r34/extractor';
import { buildVideoUrl } from '@/lib/r34/scraper';
import { getItem, setItem } from '@/lib/storage';

const FAVORITES_KEY = 'favorites';

export type FavoriteItem = {
  id: string;
  slug: string;
  title: string;
  url: string;
  thumbnail: string;
  duration?: string;
  addedAt: number;
};

type FavoritesStore = {
  favorites: FavoriteItem[];
  addFavorite: (post: Post) => void;
  removeFavorite: (id: string) => void;
  isFavorite: (id: string) => boolean;
  getFavoriteCount: () => number;
};

export const useFavoritesStore = create<FavoritesStore>((set, get) => ({
  favorites: getItem<FavoriteItem[]>(FAVORITES_KEY) ?? [],

  addFavorite: (post: Post) => {
    const { favorites } = get();
    if (favorites.some((f) => f.id === post.id)) return;
    const item: FavoriteItem = {
      id: post.id,
      slug: post.slug,
      title: post.title,
      url: buildVideoUrl(post.id, post.slug),
      thumbnail: post.thumbnail,
      duration: post.duration,
      addedAt: Date.now(),
    };
    const updated = [item, ...favorites];
    setItem(FAVORITES_KEY, updated);
    set({ favorites: updated });
  },

  removeFavorite: (id: string) => {
    const updated = get().favorites.filter((f) => f.id !== id);
    setItem(FAVORITES_KEY, updated);
    set({ favorites: updated });
  },

  isFavorite: (id: string) => {
    return get().favorites.some((f) => f.id === id);
  },

  getFavoriteCount: () => {
    return get().favorites.length;
  },
}));
