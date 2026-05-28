import {
  buildListUrl,
  buildVideoUrl,
  fetchPage,
  parseVideoDetail,
  parseVideoList,
} from '@/lib/r34/scraper';
import type { VideoDetail, VideoListItem, VideoListParams } from '@/lib/r34/types';
import { createInfiniteQuery, createQuery } from 'react-query-kit';

type UseVideosVariables = VideoListParams;

export const useVideos = createInfiniteQuery<
  { data: VideoListItem[]; nextCursor?: number },
  UseVideosVariables,
  Error
>({
  queryKey: ['videos'],
  initialPageParam: 1,
  fetcher: async (variables, { pageParam }) => {
    const page = pageParam as number;
    const url = buildListUrl({
      page,
      search: variables.search,
      model: variables.model,
      tags: variables.tags,
      category: variables.category,
    });

    // null URL => this page has no fetchable address (e.g. search page >1).
    if (!url) {
      return { data: [], nextCursor: undefined };
    }

    try {
      const html = await fetchPage(url);
      const videos = parseVideoList(html);
      // Only offer a next page if the site exposes a URL for page+1.
      const nextUrl = buildListUrl({
        page: page + 1,
        search: variables.search,
        model: variables.model,
        tags: variables.tags,
        category: variables.category,
      });
      return {
        data: videos,
        nextCursor: videos.length > 0 && nextUrl ? page + 1 : undefined,
      };
    } catch (e) {
      console.warn('[useVideos] fetch failed:', url, (e as Error)?.message ?? e);
      throw e;
    }
  },
  getNextPageParam: (lastPage) => lastPage.nextCursor,
});

export const useVideoDetail = createQuery<VideoDetail, { id: string; slug: string }, Error>({
  queryKey: ['video'],
  fetcher: async (variables) => {
    const url = buildVideoUrl(variables.id, variables.slug);
    const html = await fetchPage(url);
    return parseVideoDetail(html, variables.id, variables.slug);
  },
});

export const useModelVideos = createInfiniteQuery<
  { data: VideoListItem[]; nextCursor?: number },
  { modelSlug: string },
  Error
>({
  queryKey: ['modelVideos'],
  initialPageParam: 1,
  fetcher: async (variables, { pageParam }) => {
    const page = pageParam as number;
    const url = buildListUrl({ page, model: variables.modelSlug });
    if (!url) return { data: [], nextCursor: undefined };

    const html = await fetchPage(url);
    const videos = parseVideoList(html);

    return {
      data: videos,
      nextCursor: videos.length > 0 ? page + 1 : undefined,
    };
  },
  getNextPageParam: (lastPage) => lastPage.nextCursor,
});

export const useMemberVideos = createInfiniteQuery<
  { data: VideoListItem[]; nextCursor?: number },
  { memberId: string },
  Error
>({
  queryKey: ['memberVideos'],
  initialPageParam: 1,
  fetcher: async (variables) => {
    // Member pagination is AJAX-only, so only page 1 is reachable by URL.
    const url = buildListUrl({ member: variables.memberId, page: 1 });
    if (!url) return { data: [], nextCursor: undefined };

    const html = await fetchPage(url);
    const videos = parseVideoList(html);

    return { data: videos, nextCursor: undefined };
  },
  getNextPageParam: (lastPage) => lastPage.nextCursor,
});
