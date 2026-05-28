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

export type VideoDetail = VideoListItem & {
  formats: VideoFormat[];
  tags: VideoTag[];
  categories: string[];
  artist?: string;
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
