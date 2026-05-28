import { create } from 'zustand';

import { getItem, setItem } from '@/lib/storage';

/**
 * Optional bottom-nav tabs the user can show/hide from Settings.
 * Home and Settings are always visible and not part of this config.
 */
export type OptionalTab = 'search' | 'following' | 'library';

const TABS_KEY = 'enabled_tabs';

const DEFAULTS: Record<OptionalTab, boolean> = {
  search: true,
  following: true,
  library: true,
};

type TabConfigStore = {
  tabs: Record<OptionalTab, boolean>;
  setTab: (tab: OptionalTab, enabled: boolean) => void;
};

export const useTabConfigStore = create<TabConfigStore>((set) => ({
  tabs: { ...DEFAULTS, ...(getItem<Record<OptionalTab, boolean>>(TABS_KEY) ?? {}) },
  setTab: (tab, enabled) =>
    set((state) => {
      const tabs = { ...state.tabs, [tab]: enabled };
      setItem(TABS_KEY, tabs);
      return { tabs };
    }),
}));
