export type VideoFormat = {
  url: string;
  quality: string;
  ext: string;
};

export type VideoListItem = {
  id: string;
  slug: string;
  title: string;
  thumbnail: string;
  duration: string;
  views: string;
  rating: string;
  previewUrl?: string;
};

export type VideoTag = {
  id: string;
  name: string;
};

/** A site "model" (artist) with its real URL slug — names don't map to slugs. */
export type VideoArtist = {
  name: string;
  slug: string;
};

export type VideoDetail = VideoListItem & {
  formats: VideoFormat[];
  tags: VideoTag[];
  categories: string[];
  /** Artists (site models) — a video can have several. */
  artists: VideoArtist[];
  uploader?: string;
  uploaderMemberId?: string;
  description?: string;
};

export type VideoListParams = {
  page?: number;
  search?: string;
  model?: string;
  tags?: string;
  category?: string;
};
