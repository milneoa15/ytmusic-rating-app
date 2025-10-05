export interface Song {
  id: string;
  videoId: string;
  title: string;
  artist: string;
  album?: string;
  duration?: string;
  thumbnailUrl?: string;
  playlistId?: string;
}

export interface SongRating {
  songId: string;
  userId: string;
  rating: number; // 1-10
  ratedAt: Date;
}

// Extended song info with rating and themes for library view
export interface SongWithMetadata extends Song {
  rating?: number;
  themes?: string[]; // Array of theme IDs
}
