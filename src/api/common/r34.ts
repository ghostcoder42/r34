import { buildListUrl, fetchPage, parseVideoDetail, parseVideoList } from '@/lib/r34/scraper';
import type { VideoDetail, VideoListItem } from '@/lib/r34/types';

type PagedResult = {
  data: VideoListItem[];
  nextCursor: number | undefined;
};

async function fetchAndParse(
  url: string | null
): Promise<{ data: VideoListItem[]; hasMore: boolean }> {
  if (!url) return { data: [], hasMore: false };
  const html = await fetchPage(url);
  const data = parseVideoList(html);
  const hasMore = html.includes('next') && data.length > 0;
  return { data, hasMore };
}

export const r34Client = {
  async search({
    query,
    page = 1,
  }: {
    query: string;
    page?: number;
  }): Promise<PagedResult> {
    const url = buildListUrl({ search: query, page });
    const { data, hasMore } = await fetchAndParse(url);
    return { data, nextCursor: hasMore ? page + 1 : undefined };
  },

  async getByTag({
    tag,
    page = 1,
  }: {
    tag: string;
    page?: number;
  }): Promise<PagedResult> {
    const url = buildListUrl({ tags: tag, page });
    const { data, hasMore } = await fetchAndParse(url);
    return { data, nextCursor: hasMore ? page + 1 : undefined };
  },

  async getVideoDetail(url: string): Promise<VideoDetail> {
    const html = await fetchPage(url);
    // Parse id/slug from the canonical /video/{id}/{slug}/ path. Using a regex
    // is robust to trailing slashes, query strings and fragments (the previous
    // slug.split('-').pop() approach returned the last slug segment, not the id).
    const match = url.match(/\/video\/(\d+)\/([^/?#]+)/);
    const id = match?.[1] ?? '';
    const slug = match?.[2] ?? '';
    return parseVideoDetail(html, id, slug);
  },
};
