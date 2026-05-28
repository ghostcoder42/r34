import { create } from 'zustand';

import { getItem, setItem } from '@/lib/storage';

const HISTORY_KEY = 'watch_history';
const MAX_HISTORY = 200;

type HistoryItem = {
  id: string;
  slug: string;
  title: string;
  thumbnail: string;
  duration?: string;
  viewedAt: number;
};

type HistoryStore = {
  history: HistoryItem[];
  addHistory: (item: Omit<HistoryItem, 'viewedAt'>) => void;
  removeHistory: (id: string) => void;
  clearHistory: () => void;
};

export const useHistoryStore = create<HistoryStore>((set, get) => ({
  history: getItem<HistoryItem[]>(HISTORY_KEY) ?? [],

  addHistory: (item) => {
    const { history } = get();
    const filtered = history.filter((h) => h.id !== item.id);
    const updated = [{ ...item, viewedAt: Date.now() }, ...filtered].slice(0, MAX_HISTORY);
    setItem(HISTORY_KEY, updated);
    set({ history: updated });
  },

  removeHistory: (id: string) => {
    const updated = get().history.filter((h) => h.id !== id);
    setItem(HISTORY_KEY, updated);
    set({ history: updated });
  },

  clearHistory: () => {
    setItem(HISTORY_KEY, []);
    set({ history: [] });
  },
}));
