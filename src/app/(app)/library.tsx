import { FlashList } from '@shopify/flash-list';
import { Image } from 'expo-image';
import { Link } from 'expo-router';
import * as React from 'react';
import { Alert, ScrollView, Text, TouchableOpacity, View, useWindowDimensions } from 'react-native';
import { Swipeable } from 'react-native-gesture-handler';

import { FocusAwareStatusBar, SafeAreaView } from '@/components/ui';
import { Trash } from '@/components/ui/icons';
import { VideoTile } from '@/components/video-tile';
import type { DownloadMetadata } from '@/lib/download';
import { cancelDownload } from '@/lib/download/download-video';
import { useColumns } from '@/lib/hooks/use-columns';
import { type ActiveDownload, useActiveDownloadsStore } from '@/lib/stores/active-downloads-store';
import { baseIdOf, useDownloadedStore } from '@/lib/stores/downloaded-store';
import type { FavoriteItem } from '@/lib/stores/favorites-store';
import { useFavoritesStore } from '@/lib/stores/favorites-store';
import { useHistoryStore } from '@/lib/stores/history-store';

function HistoryTab(): React.ReactElement {
  const { history, clearHistory } = useHistoryStore();
  const numColumns = useColumns();
  const [refreshing, setRefreshing] = React.useState(false);

  if (history.length === 0) {
    return (
      <View className="flex-1 items-center justify-center py-20">
        <Text className="text-neutral-500 dark:text-neutral-400">No watch history</Text>
      </View>
    );
  }

  return (
    <>
      <View className="flex-row justify-end px-4 py-2">
        <TouchableOpacity onPress={clearHistory}>
          <Text className="text-primary-500 text-xs">Clear All</Text>
        </TouchableOpacity>
      </View>
      <FlashList
        key={numColumns}
        data={history}
        numColumns={numColumns}
        renderItem={({ item }) => <VideoTile item={item} />}
        keyExtractor={(item) => item.id}
        refreshing={refreshing}
        onRefresh={() => {
          setRefreshing(true);
          setTimeout(() => setRefreshing(false), 400);
        }}
      />
    </>
  );
}

function formatBytes(bytes: number): string {
  if (!bytes) return '0 B';
  const mb = bytes / (1024 * 1024);
  if (mb >= 1) return `${mb.toFixed(1)} MB`;
  return `${Math.round(bytes / 1024)} KB`;
}

function formatDate(ts: number): string {
  return ts ? new Date(ts).toLocaleDateString() : '';
}

function DownloadRow({
  item,
  onRemove,
}: {
  item: DownloadMetadata;
  onRemove: (videoId: string) => void;
}): React.ReactElement {
  const baseId = baseIdOf(item.videoId);
  const isFav = useFavoritesStore((s) => s.favorites.some((f) => f.id === baseId));
  const swipeableRef = React.useRef<Swipeable>(null);

  const confirmRemove = () => {
    swipeableRef.current?.close();
    Alert.alert('Delete Download', `Remove "${item.title}" from downloads?`, [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Delete', style: 'destructive', onPress: () => onRemove(item.videoId) },
    ]);
  };

  const renderRightActions = () => (
    <TouchableOpacity
      onPress={confirmRemove}
      className="h-full items-center justify-center bg-red-500 px-6"
    >
      <Trash color="white" />
    </TouchableOpacity>
  );

  return (
    <Swipeable ref={swipeableRef} renderRightActions={renderRightActions} rightThreshold={40}>
      <Link
        href={{ pathname: '/post/[id]', params: { id: baseId, slug: item.slug ?? '' } }}
        asChild
      >
        <TouchableOpacity className="flex-row items-center px-4 py-2" activeOpacity={0.7}>
          <View className="mr-3">
            <Image
              source={{ uri: item.thumbnail }}
              className="h-16 w-28 rounded bg-neutral-200 dark:bg-neutral-800"
              contentFit="cover"
            />
            {isFav ? (
              <View className="absolute right-1 top-1 rounded-full bg-primary-500 px-1 py-0.5">
                <Text className="text-[10px] text-white">♥</Text>
              </View>
            ) : null}
          </View>
          <View className="flex-1">
            <Text
              className="text-neutral-900 dark:text-neutral-100 text-sm font-medium"
              numberOfLines={2}
            >
              {item.title}
            </Text>
            {item.uploader ? (
              <Text className="text-neutral-500 dark:text-neutral-400 text-xs">
                By {item.uploader}
              </Text>
            ) : null}
            <Text className="text-neutral-500 dark:text-neutral-400 text-xs">
              {item.quality} · {formatBytes(item.size)} · {formatDate(item.downloadedAt)}
            </Text>
          </View>
        </TouchableOpacity>
      </Link>
    </Swipeable>
  );
}

function ActiveDownloadRow({ task }: { task: ActiveDownload }): React.ReactElement {
  const [cancelling, setCancelling] = React.useState(false);
  const indeterminate = task.progress < 0;
  const pct = indeterminate ? 0 : Math.round(task.progress * 100);
  const barWidth = indeterminate ? 40 : pct;

  const onCancel = async () => {
    setCancelling(true);
    await cancelDownload(task.baseId);
  };

  return (
    <View className="flex-row items-center px-4 py-2" testID="active-download-row">
      <View className="mr-3">
        <Image
          source={{ uri: task.thumbnail }}
          className="h-16 w-28 rounded bg-neutral-200 dark:bg-neutral-800"
          contentFit="cover"
        />
      </View>
      <View className="flex-1">
        <Text
          className="text-neutral-900 dark:text-neutral-100 text-sm font-medium"
          numberOfLines={2}
        >
          {task.title}
        </Text>
        <Text className="text-neutral-500 dark:text-neutral-400 text-xs">
          {task.status === 'error'
            ? `Failed${task.error ? `: ${task.error}` : ''}`
            : task.status === 'cancelled'
              ? 'Cancelled'
              : indeterminate
                ? 'Downloading…'
                : `Downloading · ${pct}%`}
        </Text>
        <View className="mt-1 h-1.5 overflow-hidden rounded-full bg-neutral-200 dark:bg-neutral-700">
          <View
            className={task.status === 'error' ? 'h-full bg-red-500' : 'h-full bg-sky-500'}
            style={{ width: `${barWidth}%` }}
          />
        </View>
      </View>
      <TouchableOpacity
        onPress={onCancel}
        disabled={cancelling || task.status === 'cancelled'}
        className="ml-2 items-center justify-center rounded-full bg-neutral-200 px-3 py-1.5 dark:bg-neutral-700"
        testID="active-download-cancel"
      >
        <Text className="text-xs font-medium text-neutral-600 dark:text-neutral-300">
          {cancelling ? '…' : 'Cancel'}
        </Text>
      </TouchableOpacity>
    </View>
  );
}

type DownloadListItem =
  | { kind: 'active'; task: ActiveDownload }
  | { kind: 'done'; entry: DownloadMetadata };

function DownloadsTab(): React.ReactElement {
  const entries = useDownloadedStore((s) => s.entries);
  const loaded = useDownloadedStore((s) => s.loaded);
  const hydrate = useDownloadedStore((s) => s.hydrate);
  const remove = useDownloadedStore((s) => s.remove);
  const activeTasks = useActiveDownloadsStore((s) => s.tasks);
  const [refreshing, setRefreshing] = React.useState(false);

  React.useEffect(() => {
    hydrate();
  }, [hydrate]);

  const active = React.useMemo(
    () => Object.values(activeTasks).sort((a, b) => b.startedAt - a.startedAt),
    [activeTasks]
  );
  const activeBaseIds = React.useMemo(() => new Set(active.map((t) => t.baseId)), [active]);

  const data = React.useMemo<DownloadListItem[]>(() => {
    const activeItems: DownloadListItem[] = active.map((task) => ({ kind: 'active', task }));
    const doneItems: DownloadListItem[] = entries
      .filter((e) => !activeBaseIds.has(baseIdOf(e.videoId)))
      .map((entry) => ({ kind: 'done', entry }));
    return [...activeItems, ...doneItems];
  }, [active, activeBaseIds, entries]);

  const onRefresh = React.useCallback(async () => {
    setRefreshing(true);
    try {
      await hydrate();
    } finally {
      setRefreshing(false);
    }
  }, [hydrate]);

  if (loaded && data.length === 0) {
    return (
      <View className="flex-1 items-center justify-center py-20">
        <Text className="text-neutral-500 dark:text-neutral-400">No downloads yet</Text>
      </View>
    );
  }

  return (
    <FlashList
      data={data}
      renderItem={({ item }) =>
        item.kind === 'active' ? (
          <ActiveDownloadRow task={item.task} />
        ) : (
          <DownloadRow item={item.entry} onRemove={remove} />
        )
      }
      keyExtractor={(item) =>
        item.kind === 'active' ? `active-${item.task.baseId}` : item.entry.videoId
      }
      refreshing={refreshing}
      onRefresh={onRefresh}
    />
  );
}

function FavoritesTab(): React.ReactElement {
  const { favorites, removeFavorite } = useFavoritesStore();
  const numColumns = useColumns();
  const [refreshing, setRefreshing] = React.useState(false);

  if (favorites.length === 0) {
    return (
      <View className="flex-1 items-center justify-center py-20">
        <Text className="text-neutral-500 dark:text-neutral-400">No favorites yet</Text>
        <Text className="mt-1 text-xs text-neutral-400 dark:text-neutral-500">
          Tap the heart on a video to save it here.
        </Text>
      </View>
    );
  }

  return (
    <FlashList
      key={numColumns}
      data={favorites}
      numColumns={numColumns}
      renderItem={({ item }: { item: FavoriteItem }) => (
        <VideoTile item={item}>
          <TouchableOpacity
            onPress={() => removeFavorite(item.id)}
            className="absolute right-1 top-1 rounded-full bg-black/60 px-2 py-0.5"
          >
            <Text className="text-[10px] text-white">♥</Text>
          </TouchableOpacity>
        </VideoTile>
      )}
      keyExtractor={(item) => item.id}
      refreshing={refreshing}
      onRefresh={() => {
        setRefreshing(true);
        setTimeout(() => setRefreshing(false), 400);
      }}
    />
  );
}

type Tab = 'history' | 'downloads' | 'favorites';
const TABS: { key: Tab; label: string }[] = [
  { key: 'history', label: '🕐 History' },
  { key: 'downloads', label: '⬇️ Downloads' },
  { key: 'favorites', label: '❤️ Favorites' },
];

export default function Library(): React.ReactElement {
  const [activeTab, setActiveTab] = React.useState<Tab>('history');
  const pagerRef = React.useRef<ScrollView>(null);
  const { width } = useWindowDimensions();

  const goToPage = React.useCallback(
    (index: number) => {
      setActiveTab(TABS[index].key);
      pagerRef.current?.scrollTo({ x: index * width, animated: true });
    },
    [width]
  );

  const onMomentumScrollEnd = React.useCallback(
    (e: { nativeEvent: { contentOffset: { x: number } } }) => {
      const page = Math.round(e.nativeEvent.contentOffset.x / width);
      if (page >= 0 && page < TABS.length && TABS[page].key !== activeTab) {
        setActiveTab(TABS[page].key);
      }
    },
    [width, activeTab]
  );

  const renderTab = (tab: Tab) => {
    switch (tab) {
      case 'history':
        return <HistoryTab />;
      case 'downloads':
        return <DownloadsTab />;
      case 'favorites':
        return <FavoritesTab />;
    }
  };

  return (
    <SafeAreaView className="bg-white dark:bg-neutral-900 flex-1">
      <FocusAwareStatusBar />
      <View className="border-neutral-200 dark:border-neutral-800 flex-row border-b">
        {TABS.map((tab, index) => (
          <TouchableOpacity
            key={tab.key}
            onPress={() => goToPage(index)}
            className={`flex-1 items-center py-3 ${activeTab === tab.key ? 'border-b-2 border-primary-500' : ''}`}
          >
            <Text
              className={`text-sm font-medium ${activeTab === tab.key ? 'text-primary-600 dark:text-primary-400' : 'text-neutral-500 dark:text-neutral-400'}`}
            >
              {tab.label}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      <ScrollView
        ref={pagerRef}
        horizontal
        pagingEnabled
        showsHorizontalScrollIndicator={false}
        onMomentumScrollEnd={onMomentumScrollEnd}
        style={{ flex: 1 }}
      >
        {TABS.map((tab) => (
          <View key={tab.key} style={{ width, flex: 1 }}>
            {renderTab(tab.key)}
          </View>
        ))}
      </ScrollView>
    </SafeAreaView>
  );
}
