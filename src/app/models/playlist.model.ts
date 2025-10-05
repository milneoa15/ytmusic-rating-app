import { Song } from './song.model';

export interface Playlist {
  id: string;
  title: string;
  description?: string;
  thumbnailUrl?: string;
  songCount: number;
  songs?: Song[];
  isImported?: boolean;
}

export interface ExportOptions {
  minRating: number;
  maxRating: number;
  playlistName: string;
  description?: string;
}
