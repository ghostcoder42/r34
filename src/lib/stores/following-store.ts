import { create } from 'zustand';

import { getItem, setItem } from '@/lib/storage';

const FOLLOWING_KEY = 'following_authors';

type Author = {
  name: string;
  slug: string;
  followedAt: number;
};

type FollowingStore = {
  following: Author[];
  follow: (name: string, slug: string) => void;
  unfollow: (slug: string) => void;
  isFollowing: (slug: string) => boolean;
};

export const useFollowingStore = create<FollowingStore>((set, get) => ({
  following: getItem<Author[]>(FOLLOWING_KEY) ?? [],

  follow: (name: string, slug: string) => {
    const { following } = get();
    if (following.some((a) => a.slug === slug)) return;
    const updated = [{ name, slug, followedAt: Date.now() }, ...following];
    setItem(FOLLOWING_KEY, updated);
    set({ following: updated });
  },

  unfollow: (slug: string) => {
    const updated = get().following.filter((a) => a.slug !== slug);
    setItem(FOLLOWING_KEY, updated);
    set({ following: updated });
  },

  isFollowing: (slug: string) => {
    return get().following.some((a) => a.slug === slug);
  },
}));
