const YOUTUBE_ID_PATTERN =
  /(?:youtube\.com\/(?:watch\?v=|embed\/|shorts\/)|youtu\.be\/)([\w-]{11})/;

export function extractYouTubeId(url: string): string | null {
  const match = url.match(YOUTUBE_ID_PATTERN);
  return match ? match[1] : null;
}

export function youtubeEmbedUrl(youtubeId: string): string {
  return `https://www.youtube-nocookie.com/embed/${youtubeId}`;
}

export function youtubeThumbnailUrl(youtubeId: string): string {
  return `https://i.ytimg.com/vi/${youtubeId}/hqdefault.jpg`;
}
