import { useEvent } from 'expo';
import { Link, Stack, useFocusEffect, useLocalSearchParams } from 'expo-router';
import { VideoView, useVideoPlayer } from 'expo-video';
import * as React from 'react';
import { ScrollView, TouchableOpacity, View } from 'react-native';

import { useVideoDetail } from '@/api/video-queries';
import { ActivityIndicator, Button, FocusAwareStatusBar, Text } from '@/components/ui';
import { useVideoDownload } from '@/lib/hooks';
import { toOfflineDetail } from '@/lib/r34/offline-detail';
import type { VideoDetail, VideoFormat } from '@/lib/r34/types';
import { baseIdOf, useDownloadedStore } from '@/lib/stores/downloaded-store';
import { useFavoritesStore } from '@/lib/stores/favorites-store';
import { useHistoryStore } from '@/lib/stores/history-store';

type VideoSectionProps = {
  data: VideoDetail;
};

function VideoSection({ data }: VideoSectionProps): React.ReactElement {
  const [selectedQuality, setSelectedQuality] = React.useState<string>('');
  const [selectedFormat, setSelectedFormat] = React.useState<VideoFormat | null>(null);

  React.useEffect(() => {
    if (data.formats?.length && !selectedQuality) {
      const defaultFormat = data.formats.find((f) => f.quality === '720p') || data.formats[0];
      setSelectedQuality(defaultFormat.quality);
      setSelectedFormat(defaultFormat);
    }
  }, [data.formats, selectedQuality]);

  const {
    isDownloading,
    downloadProgress,
    isDownloaded,
    handleDownload,
    fileUri,
    error: downloadError,
  } = useVideoDownload({
    videoUrl: selectedFormat?.url || '',
    videoId: `${data.id}_${selectedQuality}`,
    videoTitle: data.title,
    videoThumbnail: data.thumbnail,
    videoSlug: data.slug,
    videoUploader: data.uploader,
    videoUploaderMemberId: data.uploaderMemberId,
  });

  const videoSource = isDownloaded && fileUri ? fileUri : selectedFormat?.url || '';

  const player = useVideoPlayer(videoSource, (player) => {
    player.loop = true;
  });

  const { isPlaying } = useEvent(player, 'playingChange', {
    isPlaying: player.playing,
  });

  // The screen stays mounted in the stack after navigating away (e.g. to a
  // tag or another post), so the player keeps playing — and two posts pushed
  // on top of each other would play simultaneously. Pause whenever this
  // screen loses focus (also covers unmount).
  useFocusEffect(
    React.useCallback(() => {
      return () => {
        try {
          player.pause();
        } catch {
          // Player already released (screen unmounting) — nothing to do.
        }
      };
    }, [player])
  );

  return (
    <View className="bg-black">
      <View className="relative mt-14 aspect-video w-full bg-neutral-900">
        {videoSource ? (
          <VideoView
            player={player}
            showsTimecodes
            contentFit="contain"
            className="size-full"
            style={{ width: '100%', height: '100%' }}
          />
        ) : (
          <View className="flex-1 items-center justify-center">
            <Text className="text-white">No video source available</Text>
          </View>
        )}
        {!isPlaying && videoSource && (
          <View className="pointer-events-none absolute inset-0 items-center justify-center bg-black/20" />
        )}
      </View>

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
                    onPress={() => {
                      setSelectedQuality(format.quality);
                      setSelectedFormat(format);
                    }}
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
              selectedFormat && (
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

        {downloadError && (
          <View className="mt-2 rounded bg-red-50 px-4 py-2 dark:bg-red-900/20">
            <Text className="text-xs text-red-600 dark:text-red-400">
              Download Failed: {downloadError.message}
            </Text>
          </View>
        )}
      </View>
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
  // Old download records didn't store slug; resolve it from history/favorites
  // so the online detail fetch can succeed and refresh the page.
  const historySlug = useHistoryStore((s) => s.history.find((h) => h.id === local.id)?.slug ?? '');
  const favSlug = useFavoritesStore((s) => s.favorites.find((f) => f.id === local.id)?.slug ?? '');
  const slug = local.slug || historySlug || favSlug || '';
  const { data: networkData, isPending } = useVideoDetail({
    variables: { id: local.id, slug },
  });
  // Offline fallback: a downloaded copy lets the page render and play the
  // local file even when the detail fetch fails or hasn't resolved yet.
  const downloaded = useDownloadedStore(
    (s) => s.entries.find((e) => baseIdOf(e.videoId) === local.id) ?? null
  );
  const data = networkData ?? (downloaded ? toOfflineDetail(downloaded, local.id) : undefined);
  const addHistory = useHistoryStore((s) => s.addHistory);

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
    return (
      <View className="flex-1 items-center justify-center bg-white p-6 dark:bg-black">
        <Stack.Screen options={{ title: 'Error' }} />
        <FocusAwareStatusBar />
        <Text className="mb-2 text-lg font-bold text-neutral-900 dark:text-white">
          Something went wrong
        </Text>
        <Text className="text-center text-neutral-500 dark:text-neutral-400">
          We couldn't load this video. Please try again later.
        </Text>
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

      <ScrollView contentContainerStyle={{ paddingBottom: 100 }} bounces={false}>
        <VideoSection data={data} />

        <View className="p-4">
          <View className="mb-4 flex-row items-start justify-between gap-3">
            <Text className="flex-1 text-xl font-bold text-neutral-900 dark:text-white">
              {data.title}
            </Text>
            <FavoriteButton data={data} />
          </View>

          <View className="mb-6 flex-row flex-wrap items-center gap-4">
            {data.artist ? (
              <Link
                href={{
                  pathname: '/model/[slug]',
                  params: { slug: data.artist.toLowerCase().replace(/\s+/g, '-') },
                }}
                asChild
              >
                <TouchableOpacity>
                  <View className="flex-row items-center rounded-full bg-primary-100 px-3 py-1.5 dark:bg-primary-900/30">
                    <Text className="text-sm font-semibold text-primary-900 dark:text-primary-100">
                      Artist: {data.artist}
                    </Text>
                  </View>
                </TouchableOpacity>
              </Link>
            ) : null}

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
      </ScrollView>
    </View>
  );
}
