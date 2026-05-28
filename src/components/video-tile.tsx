import { MenuView } from '@react-native-menu/menu';
import { useRouter } from 'expo-router';
import * as React from 'react';
import { Platform } from 'react-native';

import { Image, Pressable, Text, View } from '@/components/ui';
import { useVideoActions } from '@/lib/hooks/use-video-actions';
import { useActiveDownload } from '@/lib/stores/active-downloads-store';

/**
 * Minimal shape required to render a video tile. Works for VideoListItem,
 * FavoriteItem and HistoryItem (views is optional).
 */
export type TileItem = {
  id: string;
  slug: string;
  title: string;
  thumbnail: string;
  duration?: string;
  views?: string;
};

type Props = {
  item: TileItem;
  children?: React.ReactNode;
};

/**
 * No-op long-press handler. Its mere presence makes RN's PressResponder treat
 * a long-press as a long-press (and therefore NOT fire onPress on release),
 * which keeps tap (navigate) and long-press (menu) mutually exclusive. The
 * menu itself is opened natively by MenuView, so this handler does nothing.
 */
const suppressPressOnLongPress = () => {};

/**
 * A responsive video tile used by the home/search/library/favorites grids.
 * Fills its FlashList cell width and keeps a 16:9 thumbnail. Short-tap opens
 * the video detail; long-press opens a native context menu
 * (favorite / download / follow author). The two gestures are mutually
 * exclusive: long-press never triggers navigation.
 *
 * The menu is opened by MenuView's own native gesture (shouldOpenOnLongPress):
 * iOS uses the UIContextMenuInteraction (Force Touch / long-press), Android
 * uses the native long-press -> PopupMenu. We do NOT call show() ourselves:
 * doing so on top of the native gesture double-opens the PopupMenu and leaves
 * the touch system in a broken state (taps stop firing app-wide after the menu
 * closes). Mutual exclusivity comes from attaching an onLongPress handler on
 * Android, which makes RN suppress onPress for that gesture.
 */
function VideoTileImpl({ item, children }: Props): React.ReactElement {
  const { isFavorite, isDownloaded, isActive, toggleFavorite, toggleDownload, toggleFollow } =
    useVideoActions(item);
  const active = useActiveDownload(item.id);
  const router = useRouter();

  const handleAction = ({ nativeEvent }: { nativeEvent: { event: string } }) => {
    switch (nativeEvent.event) {
      case 'favorite': {
        toggleFavorite();
        break;
      }
      case 'download': {
        void toggleDownload();
        break;
      }
      case 'follow': {
        void toggleFollow();
        break;
      }
    }
  };

  const actions = [
    {
      id: 'favorite',
      title: isFavorite ? 'Unfavorite' : 'Favorite',
      state: (isFavorite ? 'on' : 'off') as 'on' | 'off',
    },
    {
      id: 'download',
      title: isActive ? 'Downloading…' : isDownloaded ? 'Downloaded' : 'Download',
      state: (isDownloaded ? 'on' : 'off') as 'on' | 'off',
      attributes: isActive || isDownloaded ? { disabled: true } : undefined,
    },
    { id: 'follow', title: 'Follow author' },
  ];

  const openDetail = () => {
    router.push({ pathname: '/post/[id]', params: { id: item.id, slug: item.slug } });
  };

  const progressLabel = active
    ? active.progress >= 0
      ? `↓${Math.round(active.progress * 100)}%`
      : '↓'
    : '';

  return (
    <MenuView shouldOpenOnLongPress actions={actions} onPressAction={handleAction}>
      <Pressable
        onPress={openDetail}
        onLongPress={Platform.OS === 'android' ? suppressPressOnLongPress : undefined}
        testID="video-tile"
        className="m-1.5 overflow-hidden rounded-lg border border-neutral-200 dark:border-neutral-800 bg-white dark:bg-neutral-800"
      >
        <View className="relative">
          <Image
            source={{ uri: item.thumbnail }}
            className="aspect-video w-full bg-neutral-200 dark:bg-neutral-800"
            contentFit="cover"
          />
          {item.duration ? (
            <View className="absolute bottom-1 right-1 rounded bg-black/70 px-1.5 py-0.5">
              <Text className="text-[10px] font-semibold text-white">{item.duration}</Text>
            </View>
          ) : null}
          {isFavorite || isDownloaded || isActive ? (
            <View className="absolute left-1 top-1 flex-row">
              {isFavorite ? (
                <View
                  className="mr-1 rounded-full bg-primary-500 px-1 py-0.5"
                  testID="video-tile-fav"
                >
                  <Text className="text-[10px] text-white">♥</Text>
                </View>
              ) : null}
              {isActive ? (
                <View
                  className="rounded-full bg-sky-500 px-1 py-0.5"
                  testID="video-tile-downloading"
                >
                  <Text className="text-[10px] text-white">{progressLabel}</Text>
                </View>
              ) : null}
              {isDownloaded ? (
                <View
                  className="rounded-full bg-black/70 px-1 py-0.5"
                  testID="video-tile-downloaded"
                >
                  <Text className="text-[10px] text-white">✓</Text>
                </View>
              ) : null}
            </View>
          ) : null}
          {children}
        </View>
        <View className="p-2">
          <Text
            className="text-xs font-medium text-neutral-900 dark:text-neutral-100"
            numberOfLines={2}
          >
            {item.title}
          </Text>
          {item.views ? (
            <Text className="mt-0.5 text-[10px] text-neutral-500 dark:text-neutral-400">
              {item.views} views
            </Text>
          ) : null}
        </View>
      </Pressable>
    </MenuView>
  );
}

export const VideoTile = React.memo(VideoTileImpl);
