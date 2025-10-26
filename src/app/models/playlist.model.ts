import { Song } from './song.model';

// YouTube Playlist model (for imported playlists)
export interface Playlist {
  id: string;
  title: string;
  description?: string;
  thumbnailUrl?: string;
  songCount: number;
  songs?: Song[];
  isImported?: boolean;
}

// Local Playlist model (user-created playlists stored locally)
export interface LocalPlaylist {
  id: string;
  userId: string;
  name: string;
  description?: string;
  songIds: string[]; // Array of song IDs in this playlist
  createdAt: Date;
  updatedAt: Date;
  thumbnailUrl?: string; // Could be from first song or custom
  starred?: boolean; // Whether the playlist is starred/pinned
}

// Filters for playlist creation/editing (used temporarily to select songs, not stored)
export interface PlaylistFilters {
  minRating?: number;
  maxRating?: number;
  includeUnrated?: boolean;
  themeIds?: string[]; // Selected theme IDs
  themeFilterMode?: 'any' | 'all'; // Match ANY or ALL themes
  artistIds?: string[]; // Selected artist names
  artistFilterMode?: 'any' | 'all'; // Match ANY or ALL artists
}

export interface ExportOptions {
  minRating: number;
  maxRating: number;
  playlistName: string;
  description?: string;
}
