import { SplashScreen } from 'expo-router';
// TODO: migrate to expo-router/ui headless Tabs API (Tabs + TabSlot + TabList + TabTrigger)
import { Tabs } from 'expo-router/js-tabs';
import { useColorScheme } from 'nativewind';
import * as React from 'react';

import { colors } from '@/components/ui';
import {
  Users as FollowingIcon,
  Home as HomeIcon,
  Feed as LibraryIcon,
  Search as SearchIcon,
  Settings as SettingsIcon,
} from '@/components/ui/icons';
import { useTranslate } from '@/lib/i18n';
import { useDownloadedStore } from '@/lib/stores/downloaded-store';
import { useTabConfigStore } from '@/lib/stores/tab-config-store';

export default function TabLayout(): React.ReactElement {
  const t = useTranslate();
  const { colorScheme } = useColorScheme();
  const isDark = colorScheme === 'dark';
  const tabs = useTabConfigStore((s) => s.tabs);
  const hydrateDownloads = useDownloadedStore((s) => s.hydrate);

  React.useEffect(() => {
    hydrateDownloads();
  }, [hydrateDownloads]);

  React.useEffect(() => {
    const timer = setTimeout(() => {
      SplashScreen.hideAsync();
    }, 100);
    return () => clearTimeout(timer);
  }, []);

  return (
    <Tabs
      screenOptions={{
        // No per-screen header — each tab manages its own top safe area, and
        // the bottom tab bar is enough navigation.
        headerShown: false,
        tabBarActiveTintColor: colors.primary[500],
        tabBarInactiveTintColor: isDark ? colors.neutral[400] : colors.neutral[500],
        tabBarStyle: {
          backgroundColor: isDark ? colors.neutral[900] : colors.white,
          borderTopColor: isDark ? colors.neutral[800] : colors.neutral[200],
        },
      }}
    >
      <Tabs.Screen
        name="index"
        options={{
          title: t('tabs.home'),
          tabBarIcon: ({ color }) => <HomeIcon color={color} />,
          tabBarButtonTestID: 'home-tab',
        }}
      />
      <Tabs.Screen
        name="search"
        options={{
          title: t('tabs.search'),
          tabBarIcon: ({ color }) => <SearchIcon color={color} />,
          tabBarButtonTestID: 'search-tab',
          // Hide from the tab bar if the user disabled it in Settings.
          href: tabs.search ? undefined : null,
        }}
      />
      <Tabs.Screen
        name="following"
        options={{
          title: t('tabs.following'),
          tabBarIcon: ({ color }) => <FollowingIcon color={color} />,
          tabBarButtonTestID: 'following-tab',
          href: tabs.following ? undefined : null,
        }}
      />
      <Tabs.Screen
        name="library"
        options={{
          title: t('tabs.library'),
          tabBarIcon: ({ color }) => <LibraryIcon color={color} />,
          tabBarButtonTestID: 'library-tab',
          href: tabs.library ? undefined : null,
        }}
      />
      <Tabs.Screen
        name="settings"
        options={{
          title: t('tabs.settings'),
          tabBarIcon: ({ color }) => <SettingsIcon color={color} />,
          tabBarButtonTestID: 'settings-tab',
        }}
      />
    </Tabs>
  );
}
