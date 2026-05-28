import { storage } from '@/lib/storage';

const SEARCH_HISTORY_KEY = 'search_history';
const MAX_HISTORY = 20;

export function useSearchHistory() {
  function getHistory(): string[] {
    const raw = storage.getString(SEARCH_HISTORY_KEY);
    return raw ? JSON.parse(raw) : [];
  }

  function addHistory(query: string): void {
    if (!query.trim()) return;
    const history = getHistory().filter((h) => h !== query);
    history.unshift(query);
    if (history.length > MAX_HISTORY) {
      history.length = MAX_HISTORY;
    }
    storage.set(SEARCH_HISTORY_KEY, JSON.stringify(history));
  }

  function removeHistory(query: string): void {
    const history = getHistory().filter((h) => h !== query);
    storage.set(SEARCH_HISTORY_KEY, JSON.stringify(history));
  }

  function clearHistory(): void {
    storage.set(SEARCH_HISTORY_KEY, JSON.stringify([]));
  }

  return { getHistory, addHistory, removeHistory, clearHistory };
}
