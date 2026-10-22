import { Link, Stack, useFocusEffect, useLocalSearchParams, useNavigation } from 'expo-router';
import * as React from 'react';
import { TouchableOpacity, View, useWindowDimensions } from 'react-native';
import { showMessage } from 'react-native-flash-message';
import Animated, {
  useAnimatedScrollHandler,
  useAnimatedStyle,
  useSharedValue,
} from 'react-native-reanimated';

import { useVideoDetail } from '@/api/video-queries';
import { GesturePlayer } from '@/components/player/gesture-player';
import { ActivityIndicator, Button, FocusAwareStatusBar, Text } from '@/components/ui';
import { usePostPlayer } from '@/lib/hooks/use-post-player';
import { useTranslate } from '@/lib/i18n';
import { endVideoOpen } from '@/lib/navigation/open-guard';
import { artistChipLabel } from '@/lib/r34/artists';
import { fetchErrorMessage } from '@/lib/r34/fetch-error';
import { toOfflineDetail } from '@/lib/r34/offline-detail';
import type { VideoDetail } from '@/lib/r34/types';
import { baseIdOf, useDownloadedStore } from '@/lib/stores/downloaded-store';
import { useFavoritesStore } from '@/lib/stores/favorites-store';
import { useHistoryStore } from '@/lib/stores/history-store';

/** Top offset of the pinned inline player: clears the transparent header (mt-14). */
const PLAYER_TOP = 56;

/** GesturePlayer fills its animated frame (inline band ↔ fullscreen). */
const PLAYER_FILL = { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0 } as const;

type VideoBarProps = {
  data: VideoDetail;
  player: ReturnType<typeof usePostPlayer>;
};

/** Quality pills + download action (the strip under the pinned player). */
function VideoActionBar({ data, player }: VideoBarProps): React.ReactElement {
  const { selectedQuality, selectFormat, download } = player;
  const { isDownloading, downloadProgress, isDownloaded, handleDownload, error } = download;

  return (
    <View className="border-b border-neutral-200 bg-white px-4 py-3 dark:border-neutral-800 dark:bg-neutral-900">
      <View className="flex-row flex-wrap items-start justify-between gap-y-3">
        <View className="min-w-[50%] flex-1 gap-2">
          <Text className="text-xs font-medium uppercase tracking-wider text-neutral-500 dark:text-neutral-400">
            {isDownloaded ? 'Offline Ready' : 'Stream Ready'}
          </Text>
          {data.formats && data.formats.length > 0 && (
            <View className="flex-row flex-wrap gap-2">
              {data.formats.map((format) => (
                <Button
                  key={format.quality}
                  variant={selectedQuality === format.quality ? 'default' : 'secondary'}
                  onPress={() => selectFormat(format)}
                  className="h-8 px-3"
                  textClassName="text-xs"
                  label={format.quality}
                />
              ))}
            </View>
          )}
        </View>

        <View className="self-start">
          {isDownloaded ? (
            <View className="flex-row items-center rounded-full bg-green-100 px-3 py-1.5 dark:bg-green-900/30">
              <Text className="text-xs font-semibold text-green-700 dark:text-green-400">
                DOWNLOADED
              </Text>
            </View>
          ) : (
            player.videoSource && (
              <Button
                onPress={handleDownload}
                disabled={isDownloading}
                variant="outline"
                className="h-10 rounded-full border-primary-500 px-5"
              >
                <View className="flex-row items-center">
                  <Text className="text-sm font-semibold text-primary-600 dark:text-primary-400">
                    {isDownloading ? `${Math.round(downloadProgress * 100)}%` : 'DOWNLOAD'}
                  </Text>
                </View>
              </Button>
            )
          )}
        </View>
      </View>

      {error && (
        <View className="mt-2 rounded bg-red-50 px-4 py-2 dark:bg-red-900/20">
          <Text className="text-xs text-red-600 dark:text-red-400">
            Download Failed: {error.message}
          </Text>
        </View>
      )}
    </View>
  );
}

function FavoriteButton({ data }: { data: VideoDetail }): React.ReactElement {
  const isFav = useFavoritesStore((s) => s.favorites.some((f) => f.id === data.id));
  const addFavorite = useFavoritesStore((s) => s.addFavorite);
  const removeFavorite = useFavoritesStore((s) => s.removeFavorite);

  return (
    <TouchableOpacity
      onPress={() => (isFav ? removeFavorite(data.id) : addFavorite(data))}
      hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
      className="rounded-full border border-neutral-300 px-3 py-1.5 dark:border-neutral-700"
    >
      <Text className="text-sm">{isFav ? '♥ Favorited' : '♡ Favorite'}</Text>
    </TouchableOpacity>
  );
}

export default function Post(): React.ReactElement | null {
  const local = useLocalSearchParams<{ id: string; slug: string }>();
  const t = useTranslate();
  // Old download records didn't store slug; resolve it from history/favorites
  // so the online detail fetch can succeed and refresh the page.
  const historySlug = useHistoryStore((s) => s.history.find((h) => h.id === local.id)?.slug ?? '');
  const favSlug = useFavoritesStore((s) => s.favorites.find((f) => f.id === local.id)?.slug ?? '');
  const slug = local.slug || historySlug || favSlug || '';
  const {
    data: networkData,
    isPending,
    isError,
    error,
    refetch,
  } = useVideoDetail({
    variables: { id: local.id, slug },
  });
  // Offline fallback: a downloaded copy lets the page render and play the
  // local file even when the detail fetch fails or hasn't resolved yet.
  const downloaded = useDownloadedStore(
    (s) => s.entries.find((e) => baseIdOf(e.videoId) === local.id) ?? null
  );
  const data = networkData ?? (downloaded ? toOfflineDetail(downloaded, local.id) : undefined);
  const addHistory = useHistoryStore((s) => s.addHistory);

  // Playback: source selection, native player, autoplay lifecycle, fullscreen.
  const player = usePostPlayer(data);

  const navigation = useNavigation();
  React.useEffect(() => {
    // expo-router doesn't type native-stack transition events; emitted at runtime.
    const transitionNav = navigation as unknown as {
      addListener: (event: 'transitionEnd', cb: () => void) => () => void;
    };
    return transitionNav.addListener('transitionEnd', () => endVideoOpen());
  }, [navigation]);

  // Release the single-flight navigation guard when the OPEN truly completes.
  // Focus fires on the first frame after the push — while the stack
  // transition animation (~300ms) is still running, the source screen stays
  // visible AND touchable, so taps landing inside that window could push the
  // same video again (reproduced on hanime1: furious tapping stacked 2+
  // screens). The transition's end is the moment the card is finally covered.
  useFocusEffect(
    React.useCallback(() => {
      return () => {
        endVideoOpen();
      };
    }, [])
  );

  // Why the page info couldn't be refreshed, so the toast can tell the two
  // apart. A removed video shows up two ways: an HTTP 404/410, or a 200
  // "shell" page (title only, no formats) that parses successfully. Anything
  // else — offline, timeout, 5xx — means we simply couldn't reach the site;
  // the video itself may be fine. Playback is unaffected either way: a
  // download (if any) still plays from disk.
  const failureKind = React.useMemo<'removed' | 'unreachable' | null>(() => {
    if (networkData && networkData.formats.length === 0) return 'removed';
    if (isError) {
      const status = (error as (Error & { status?: number }) | null)?.status;
      return status === 404 || status === 410 ? 'removed' : 'unreachable';
    }
    return null;
  }, [networkData, isError, error]);

  React.useEffect(() => {
    if (!failureKind) return;
    showMessage({
      message: t(failureKind === 'removed' ? 'post.video_removed' : 'post.site_unreachable'),
      type: 'warning',
      // Centered: top toasts sit under the status bar / cutout on some devices.
      position: 'center',
      duration: 2500,
    });
  }, [failureKind, t]);

  // Record this video in watch history once its metadata is available.
  React.useEffect(() => {
    if (data) {
      addHistory({
        id: data.id,
        slug: data.slug,
        title: data.title,
        thumbnail: data.thumbnail,
        duration: data.duration,
      });
    }
  }, [data, addHistory]);

  // Pinned inline player (16:9 under the transparent header), rendered LAST
  // so its absolute surface paints above the scroll content. Fullscreen is a
  // style change only — the same instance (and playback) survives. In inline
  // mode the band tracks scrollY: it sits under the header at rest and slides
  // off the top as the page scrolls, exactly like in-flow content (a fixed
  // band covers ~86% of a landscape tablet, leaving a tiny scrollable strip).
  const { width } = useWindowDimensions();
  const inlineHeight = Math.round((width * 9) / 16);
  const fullscreen = player.fullscreen;

  const scrollYSV = useSharedValue(0);
  const onScroll = useAnimatedScrollHandler({
    onScroll: (e) => {
      scrollYSV.value = e.contentOffset.y;
    },
  });

  const playerFrame = useAnimatedStyle(() => {
    if (fullscreen) {
      return { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, zIndex: 100 };
    }
    // Rest: top edge at PLAYER_TOP. Fully scrolled: top edge at -inlineHeight
    // (band hugs y ≤ 0, outside touch reach but inside the parent bounds).
    const translateY = Math.max(PLAYER_TOP - scrollYSV.value, -inlineHeight);
    return {
      position: 'absolute',
      top: 0,
      left: 0,
      right: 0,
      height: inlineHeight,
      zIndex: 10,
      transform: [{ translateY }],
    };
  }, [fullscreen, inlineHeight]);

  if (isPending && !data) {
    return (
      <View className="flex-1 items-center justify-center bg-white dark:bg-black">
        <Stack.Screen options={{ headerShown: false }} />
        <FocusAwareStatusBar />
        <ActivityIndicator size="large" color="#3b82f6" />
      </View>
    );
  }

  if (!data) {
    // What went wrong, specifically (timeout / Cloudflare block / offline /
    // site unreachable / …) — falls back to the generic line only when the
    // failure isn't a classified fetch error.
    const reason = isError ? fetchErrorMessage(error) : t('post.load_error');
    return (
      <View className="flex-1 items-center justify-center bg-white p-6 dark:bg-black">
        <Stack.Screen options={{ title: 'Error' }} />
        <FocusAwareStatusBar />
        <Text className="mb-2 text-lg font-bold text-neutral-900 dark:text-white">
          {t('post.load_failed_title')}
        </Text>
        <Text className="mb-4 text-center text-neutral-500 dark:text-neutral-400">{reason}</Text>
        <Button label={t('common.retry')} onPress={() => refetch()} variant="outline" />
      </View>
    );
  }

  return (
    <View className="flex-1 bg-white dark:bg-black">
      <Stack.Screen
        options={{
          title: data.title || '',
          headerTransparent: true,
          headerTintColor: 'white',
          headerBlurEffect: 'dark',
        }}
      />
      <FocusAwareStatusBar />

      <Animated.ScrollView
        contentContainerStyle={{ paddingBottom: 100 }}
        bounces={false}
        onScroll={onScroll}
        scrollEventThrottle={16}
      >
        {!player.fullscreen && (
          <View style={{ height: PLAYER_TOP + inlineHeight }} className="w-full bg-neutral-900" />
        )}
        <VideoActionBar data={data} player={player} />

        <View className="p-4">
          <View className="mb-4 flex-row items-start justify-between gap-3">
            <Text className="flex-1 text-xl font-bold text-neutral-900 dark:text-white">
              {data.title}
            </Text>
            <FavoriteButton data={data} />
          </View>

          <View className="mb-6 flex-row flex-wrap items-center gap-4">
            {(data.artists ?? []).map((artist) => (
              <Link
                key={artist.slug}
                href={{
                  pathname: '/model/[slug]',
                  // Navigate with the real site slug from the scraper —
                  // deriving it from the display name 404s for names like
                  // "OpenNSFW (VA)" (actual slug: "opennsfw").
                  params: { slug: artist.slug },
                }}
                asChild
              >
                <TouchableOpacity>
                  <View className="flex-row items-center rounded-full bg-primary-100 px-3 py-1.5 dark:bg-primary-900/30">
                    <Text className="text-sm font-semibold text-primary-900 dark:text-primary-100">
                      {artistChipLabel(artist.name)}
                    </Text>
                  </View>
                </TouchableOpacity>
              </Link>
            ))}

            {data.uploader && data.uploaderMemberId ? (
              <Link
                href={{
                  pathname: '/author/[id]',
                  params: {
                    id: data.uploaderMemberId,
                    name: data.uploader,
                  },
                }}
                asChild
              >
                <TouchableOpacity>
                  <View className="flex-row items-center rounded-full bg-neutral-100 px-3 py-1.5 dark:bg-neutral-800">
                    <Text className="text-sm font-semibold text-neutral-900 dark:text-white">
                      By {data.uploader}
                    </Text>
                  </View>
                </TouchableOpacity>
              </Link>
            ) : null}

            {data.views && (
              <Text className="text-sm font-medium text-neutral-500 dark:text-neutral-400">
                {data.views} views
              </Text>
            )}
          </View>

          {data.categories && data.categories.length > 0 && (
            <View className="mb-6">
              <Text className="mb-2 text-xs font-semibold uppercase tracking-widest text-neutral-500 dark:text-neutral-400">
                Categories
              </Text>
              <View className="flex-row flex-wrap gap-1.5">
                {data.categories.map((category) => (
                  <Link
                    key={category}
                    href={{ pathname: '/category/[name]', params: { name: category } }}
                    asChild
                  >
                    <TouchableOpacity className="rounded bg-primary-100 px-2 py-1 dark:bg-primary-900/30">
                      <Text className="text-xs font-medium text-primary-700 dark:text-primary-300">
                        {category}
                      </Text>
                    </TouchableOpacity>
                  </Link>
                ))}
              </View>
            </View>
          )}

          {data.tags && data.tags.length > 0 && (
            <View className="mb-6">
              <Text className="mb-2 text-xs font-semibold uppercase tracking-widest text-neutral-500 dark:text-neutral-400">
                Tags
              </Text>
              <View className="flex-row flex-wrap gap-1.5">
                {data.tags.map((tag) => (
                  <Link
                    key={tag.id}
                    href={{ pathname: '/tag/[id]', params: { id: tag.id, name: tag.name } }}
                    asChild
                  >
                    <TouchableOpacity className="rounded bg-neutral-100 px-2 py-1 dark:bg-neutral-800">
                      <Text className="text-xs font-medium text-neutral-600 dark:text-neutral-300">
                        {tag.name}
                      </Text>
                    </TouchableOpacity>
                  </Link>
                ))}
              </View>
            </View>
          )}

          {data.description && (
            <View className="mb-6">
              <Text className="mb-2 text-xs font-semibold uppercase tracking-widest text-neutral-500 dark:text-neutral-400">
                Description
              </Text>
              <Text className="text-sm leading-relaxed text-neutral-700 dark:text-neutral-300">
                {data.description}
              </Text>
            </View>
          )}
        </View>
      </Animated.ScrollView>

      {/* Player surface — scroll-aware inline band or fullscreen overlay. The
          frame carries the animated position; GesturePlayer fills it. */}
      {player.videoSource ? (
        <Animated.View style={playerFrame}>
          <GesturePlayer
            player={player.player}
            fullscreen={player.fullscreen}
            onToggleFullscreen={player.setFullscreen}
            title={data.title}
            style={PLAYER_FILL}
          />
        </Animated.View>
      ) : (
        <View
          style={{
            position: 'absolute',
            top: PLAYER_TOP,
            left: 0,
            right: 0,
            height: inlineHeight,
            zIndex: 10,
          }}
          className="items-center justify-center bg-neutral-900"
        >
          <Text className="text-white">No video source available</Text>
        </View>
      )}
    </View>
  );
}
