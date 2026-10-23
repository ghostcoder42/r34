import { useEvent } from 'expo';
import { useFocusEffect, useNavigation } from 'expo-router';
import { useVideoPlayer } from 'expo-video';
import * as React from 'react';

import { useVideoDownload } from '@/lib/hooks';
import { useVideoAutoplay } from '@/lib/hooks/use-video-autoplay';
import { useVideoFullscreen } from '@/lib/hooks/use-video-fullscreen';
import type { VideoDetail, VideoFormat } from '@/lib/r34/types';
import { baseIdOf, useDownloadedStore } from '@/lib/stores/downloaded-store';

/**
 * Owns everything playback-related on the post screen: quality/format
 * selection (a download always wins the player source), the native player
 * and its autoplay lifecycle, and in-app fullscreen.
 */
export function usePostPlayer(data: VideoDetail | undefined) {
  const [selectedQuality, setSelectedQuality] = React.useState<string>('');
  const [selectedFormat, setSelectedFormat] = React.useState<VideoFormat | null>(null);
  // Set when the user taps a quality pill; after that the selection is theirs.
  const manualPickRef = React.useRef(false);

  // Any downloaded copy of this video (regardless of quality). When present
  // it owns the player source — a download must stay playable offline.
  const downloaded = useDownloadedStore((s) =>
    data ? (s.entries.find((e) => baseIdOf(e.videoId) === data.id) ?? null) : null
  );

  // Memoized: `data` from the offline fallback is rebuilt every render, so
  // the selection effect must depend on stable identities only — a fresh
  // format object per run would loop setState → render → effect forever.
  const downloadedFormat = React.useMemo(
    () =>
      downloaded ? { url: downloaded.uri, quality: downloaded.quality, ext: 'mp4' as const } : null,
    [downloaded]
  );

  // `formats` (not `data`): the offline fallback rebuilds `data` every
  // render — depending on the object identity would loop
  // setState → render → effect forever; the array identity is stable for
  // network data, and the offline path is driven by downloadedFormat.
  const formats = data?.formats;
  React.useEffect(() => {
    if (manualPickRef.current) return;
    if (downloadedFormat) {
      setSelectedQuality(downloadedFormat.quality);
      setSelectedFormat(downloadedFormat);
      return;
    }
    if (formats?.length) {
      const defaultFormat = formats.find((f) => f.quality === '720p') || formats[0];
      setSelectedQuality(defaultFormat.quality);
      setSelectedFormat(defaultFormat);
    }
  }, [downloadedFormat, formats]);

  const download = useVideoDownload({
    videoUrl: selectedFormat?.url || '',
    videoId: data ? `${data.id}_${selectedQuality}` : '',
    videoTitle: data?.title ?? '',
    videoThumbnail: data?.thumbnail ?? '',
    videoSlug: data?.slug ?? '',
    videoUploader: data?.uploader ?? '',
    videoUploaderMemberId: data?.uploaderMemberId ?? '',
  });

  const videoSource =
    download.isDownloaded && download.fileUri ? download.fileUri : selectedFormat?.url || '';

  const { autoplayEnabled } = useVideoAutoplay();

  // Focus guard: a screen stacked under another one (rapid duplicate pushes,
  // post→tag/author→post chains) — or one whose detail query resolves long
  // after the user backed out — must never start playing. Its blur-time
  // pause() ran before the stream source landed and was a no-op, so a late
  // autoplay would layer audio under the focused screen.
  const isFocusedRef = React.useRef(true);

  const player = useVideoPlayer(videoSource, (player) => {
    player.loop = true;
    // Feed the custom control bar's progress updates.
    player.timeUpdateEventInterval = 0.25;
    // Autoplay intent belongs to the player's CONSTRUCTION, not to an effect
    // afterwards: useVideoPlayer recreates the whole native player when the
    // source lands (empty → url), and a play() fired right after that
    // recreation can race the native prepare and be dropped — the video then
    // sits paused forever (reproduced on hanime1's Android 8.1 device).
    if (autoplayEnabled && videoSource && isFocusedRef.current) {
      try {
        player.play();
      } catch {
        // Source not prepared yet — statusChange retry re-asserts autoplay.
      }
    }
  });

  const { isPlaying } = useEvent(player, 'playingChange', {
    isPlaying: player.playing,
  });
  const { status } = useEvent(player, 'statusChange', {
    status: player.status,
  });

  // Manual pause (while this screen is focused) must win over autoplay
  // retries. A pause that arrives with focus already lost is the blur
  // cleanup, not the user. `hasPlayed` keeps the initial paused state from
  // counting as a user pause.
  const userPausedRef = React.useRef(false);
  const hasPlayedRef = React.useRef(false);
  React.useEffect(() => {
    if (isPlaying) {
      userPausedRef.current = false;
      hasPlayedRef.current = true;
    } else if (hasPlayedRef.current && isFocusedRef.current) {
      userPausedRef.current = true;
    }
  }, [isPlaying]);

  // Start playback when the page opens (and when the source changes, e.g. a
  // quality switch or the download taking over) — unless the user turned
  // autoplay off. Manual pausing is never overridden.
  React.useEffect(() => {
    if (autoplayEnabled && videoSource && isFocusedRef.current) {
      player.play();
    }
  }, [autoplayEnabled, player, videoSource]);

  // Compensation retry: re-assert autoplay once the native player reports
  // readiness — belt and suspenders for prepare-race paths that drop the
  // initial intent (see setup comment).
  React.useEffect(() => {
    if (status !== 'readyToPlay' || !autoplayEnabled || userPausedRef.current) return;
    if (!isFocusedRef.current) return;
    try {
      player.play();
    } catch {
      // Player being released — nothing to do.
    }
  }, [status, autoplayEnabled, player]);

  // The screen stays mounted in the stack after navigating away (e.g. to a
  // tag or another post), so the player keeps playing — and two posts pushed
  // on top of each other would play simultaneously. Pause whenever this
  // screen loses focus and restore the previous state when it regains focus,
  // no matter how deep the navigation stack gets in between.
  const wasPlayingRef = React.useRef(false);
  useFocusEffect(
    React.useCallback(() => {
      isFocusedRef.current = true;
      if (wasPlayingRef.current) {
        player.play();
      }
      return () => {
        isFocusedRef.current = false;
        try {
          wasPlayingRef.current = player.playing;
          player.pause();
        } catch {
          // Player already released (screen unmounting) — nothing to do.
        }
      };
    }, [player])
  );

  // In-app fullscreen: style change only, playback never restarts.
  const [fullscreen, setFullscreen] = React.useState(false);
  const navigation = useNavigation();
  useVideoFullscreen({ fullscreen, navigation, onExitFullscreen: () => setFullscreen(false) });

  const selectFormat = React.useCallback((format: VideoFormat) => {
    manualPickRef.current = true;
    setSelectedQuality(format.quality);
    setSelectedFormat(format);
  }, []);

  return {
    player,
    videoSource,
    fullscreen,
    setFullscreen,
    selectedQuality,
    selectFormat,
    download,
  };
}
