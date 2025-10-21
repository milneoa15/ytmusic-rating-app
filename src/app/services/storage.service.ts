import { Injectable } from '@angular/core';
import { Song, SongRating } from '../models/song.model';
import { Theme, SongTheme } from '../models/theme.model';
import { LocalPlaylist, PlaylistFilters } from '../models/playlist.model';

interface RatingsDatabase {
  [userId: string]: {
    [songId: string]: SongRating;
  };
}

interface ThemesDatabase {
  [userId: string]: {
    [themeId: string]: Theme;
  };
}

interface SongThemesDatabase {
  [userId: string]: {
    [songId: string]: string[]; // Array of theme IDs
  };
}

interface ImportedSongsDatabase {
  [userId: string]: {
    [songId: string]: Song;
  };
}

interface LocalPlaylistsDatabase {
  [userId: string]: {
    [playlistId: string]: LocalPlaylist;
  };
}

@Injectable({
  providedIn: 'root'
})
export class StorageService {
  private readonly RATINGS_KEY = 'ytmusic_ratings';
  private readonly CATEGORIES_KEY = 'ytmusic_categories';
  private readonly SONG_CATEGORIES_KEY = 'ytmusic_song_categories';
  private readonly IMPORTED_SONGS_KEY = 'ytmusic_imported_songs';
  private readonly LOCAL_PLAYLISTS_KEY = 'ytmusic_local_playlists';

  constructor() {
    this.initializeStorage();
  }

  private initializeStorage(): void {
    if (!localStorage.getItem(this.RATINGS_KEY)) {
      localStorage.setItem(this.RATINGS_KEY, JSON.stringify({}));
    }
    if (!localStorage.getItem(this.CATEGORIES_KEY)) {
      localStorage.setItem(this.CATEGORIES_KEY, JSON.stringify({}));
    }
    if (!localStorage.getItem(this.SONG_CATEGORIES_KEY)) {
      localStorage.setItem(this.SONG_CATEGORIES_KEY, JSON.stringify({}));
    }
    if (!localStorage.getItem(this.IMPORTED_SONGS_KEY)) {
      localStorage.setItem(this.IMPORTED_SONGS_KEY, JSON.stringify({}));
    }
    if (!localStorage.getItem(this.LOCAL_PLAYLISTS_KEY)) {
      localStorage.setItem(this.LOCAL_PLAYLISTS_KEY, JSON.stringify({}));
    }
  }

  private getRatingsDatabase(): RatingsDatabase {
    const data = localStorage.getItem(this.RATINGS_KEY);
    return data ? JSON.parse(data) : {};
  }

  private saveRatingsDatabase(db: RatingsDatabase): void {
    localStorage.setItem(this.RATINGS_KEY, JSON.stringify(db));
  }

  // Save or update a rating for a song
  saveRating(userId: string, songId: string, rating: number): void {
    const db = this.getRatingsDatabase();
    
    if (!db[userId]) {
      db[userId] = {};
    }

    const songRating: SongRating = {
      songId,
      userId,
      rating,
      ratedAt: new Date()
    };

    db[userId][songId] = songRating;
    this.saveRatingsDatabase(db);
  }

  // Get a specific rating
  getRating(userId: string, songId: string): SongRating | null {
    const db = this.getRatingsDatabase();
    return db[userId]?.[songId] || null;
  }

  // Get all ratings for a user
  getAllRatings(userId: string): SongRating[] {
    const db = this.getRatingsDatabase();
    const userRatings = db[userId] || {};
    return Object.values(userRatings);
  }

  // Get ratings within a range
  getRatingsByRange(userId: string, minRating: number, maxRating: number): SongRating[] {
    const allRatings = this.getAllRatings(userId);
    return allRatings.filter(r => r.rating >= minRating && r.rating <= maxRating);
  }

  // Delete a rating
  deleteRating(userId: string, songId: string): void {
    const db = this.getRatingsDatabase();
    if (db[userId]?.[songId]) {
      delete db[userId][songId];
      this.saveRatingsDatabase(db);
    }
  }

  // Clear all ratings for a user
  clearUserRatings(userId: string): void {
    const db = this.getRatingsDatabase();
    if (db[userId]) {
      delete db[userId];
      this.saveRatingsDatabase(db);
    }
  }

  // ============= THEME MANAGEMENT =============

  private getThemesDatabase(): ThemesDatabase {
    const data = localStorage.getItem(this.CATEGORIES_KEY);
    return data ? JSON.parse(data) : {};
  }

  private saveThemesDatabase(db: ThemesDatabase): void {
    localStorage.setItem(this.CATEGORIES_KEY, JSON.stringify(db));
  }

  // Create a new theme
  createTheme(userId: string, name: string, color: string): Theme {
    const db = this.getThemesDatabase();
    
    if (!db[userId]) {
      db[userId] = {};
    }

    const theme: Theme = {
      id: `theme_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      name,
      color,
      userId,
      createdAt: new Date()
    };

    db[userId][theme.id] = theme;
    this.saveThemesDatabase(db);
    return theme;
  }

  // Get all themes for a user
  getThemes(userId: string): Theme[] {
    const db = this.getThemesDatabase();
    const userThemes = db[userId] || {};
    return Object.values(userThemes);
  }

  // Get a specific theme
  getTheme(userId: string, themeId: string): Theme | null {
    const db = this.getThemesDatabase();
    return db[userId]?.[themeId] || null;
  }

  // Update a theme
  updateTheme(userId: string, themeId: string, name: string, color: string): void {
    const db = this.getThemesDatabase();
    if (db[userId]?.[themeId]) {
      db[userId][themeId].name = name;
      db[userId][themeId].color = color;
      this.saveThemesDatabase(db);
    }
  }

  // Delete a theme
  deleteTheme(userId: string, themeId: string): void {
    const db = this.getThemesDatabase();
    if (db[userId]?.[themeId]) {
      delete db[userId][themeId];
      this.saveThemesDatabase(db);
      
      // Also remove this theme from all songs
      this.removeThemeFromAllSongs(userId, themeId);
    }
  }

  // ============= SONG-THEME ASSIGNMENTS =============

  private getSongThemesDatabase(): SongThemesDatabase {
    const data = localStorage.getItem(this.SONG_CATEGORIES_KEY);
    return data ? JSON.parse(data) : {};
  }

  private saveSongThemesDatabase(db: SongThemesDatabase): void {
    localStorage.setItem(this.SONG_CATEGORIES_KEY, JSON.stringify(db));
  }

  // Assign a theme to a song
  assignThemeToSong(userId: string, songId: string, themeId: string): void {
    const db = this.getSongThemesDatabase();
    
    if (!db[userId]) {
      db[userId] = {};
    }
    if (!db[userId][songId]) {
      db[userId][songId] = [];
    }
    
    if (!db[userId][songId].includes(themeId)) {
      db[userId][songId].push(themeId);
      this.saveSongThemesDatabase(db);
    }
  }

  // Remove a theme from a song
  removeThemeFromSong(userId: string, songId: string, themeId: string): void {
    const db = this.getSongThemesDatabase();
    if (db[userId]?.[songId]) {
      db[userId][songId] = db[userId][songId].filter((id: string) => id !== themeId);
      this.saveSongThemesDatabase(db);
    }
  }

  // Get all themes assigned to a song
  getSongThemes(userId: string, songId: string): string[] {
    const db = this.getSongThemesDatabase();
    return db[userId]?.[songId] || [];
  }

  // Get all songs with a specific theme
  getSongsByTheme(userId: string, themeId: string): string[] {
    const db = this.getSongThemesDatabase();
    const userSongs = db[userId] || {};
    const songIds: string[] = [];
    
    for (const [songId, themes] of Object.entries(userSongs)) {
      if ((themes as string[]).includes(themeId)) {
        songIds.push(songId);
      }
    }
    
    return songIds;
  }

  // Remove a theme from all songs
  private removeThemeFromAllSongs(userId: string, themeId: string): void {
    const db = this.getSongThemesDatabase();
    if (db[userId]) {
      for (const songId in db[userId]) {
        db[userId][songId] = db[userId][songId].filter((id: string) => id !== themeId);
      }
      this.saveSongThemesDatabase(db);
    }
  }

  // ============= IMPORTED SONGS MANAGEMENT =============

  private getImportedSongsDatabase(): ImportedSongsDatabase {
    const data = localStorage.getItem(this.IMPORTED_SONGS_KEY);
    return data ? JSON.parse(data) : {};
  }

  private saveImportedSongsDatabase(db: ImportedSongsDatabase): void {
    localStorage.setItem(this.IMPORTED_SONGS_KEY, JSON.stringify(db));
  }

  // Save imported songs (from selected playlists)
  saveImportedSongs(userId: string, songs: Song[]): void {
    const db = this.getImportedSongsDatabase();
    
    if (!db[userId]) {
      db[userId] = {};
    }

    songs.forEach(song => {
      db[userId][song.id] = song;
    });

    this.saveImportedSongsDatabase(db);
  }

  // Get all imported songs for a user
  getImportedSongs(userId: string): Song[] {
    const db = this.getImportedSongsDatabase();
    const userSongs = db[userId] || {};
    return Object.values(userSongs);
  }

  // Get a specific imported song
  getImportedSong(userId: string, songId: string): Song | null {
    const db = this.getImportedSongsDatabase();
    return db[userId]?.[songId] || null;
  }

  // Remove an imported song
  removeImportedSong(userId: string, songId: string): void {
    const db = this.getImportedSongsDatabase();
    if (db[userId]?.[songId]) {
      delete db[userId][songId];
      this.saveImportedSongsDatabase(db);
    }
  }

  // Clear all imported songs for a user
  clearImportedSongs(userId: string): void {
    const db = this.getImportedSongsDatabase();
    if (db[userId]) {
      delete db[userId];
      this.saveImportedSongsDatabase(db);
    }
  }

  // Delete a song completely from all databases (imported songs, ratings, themes)
  deleteSong(userId: string, songId: string): void {
    // Remove from imported songs
    this.removeImportedSong(userId, songId);

    // Remove rating if exists
    this.deleteRating(userId, songId);

    // Remove all theme assignments
    const songThemes = this.getSongThemes(userId, songId);
    songThemes.forEach(themeId => {
      this.removeThemeFromSong(userId, songId, themeId);
    });
  }

  // ============= LOCAL PLAYLIST MANAGEMENT =============

  private getLocalPlaylistsDatabase(): LocalPlaylistsDatabase {
    const data = localStorage.getItem(this.LOCAL_PLAYLISTS_KEY);
    return data ? JSON.parse(data) : {};
  }

  private saveLocalPlaylistsDatabase(db: LocalPlaylistsDatabase): void {
    localStorage.setItem(this.LOCAL_PLAYLISTS_KEY, JSON.stringify(db));
  }

  // Create a new local playlist
  createLocalPlaylist(
    userId: string,
    name: string,
    description?: string,
    filters?: PlaylistFilters
  ): LocalPlaylist {
    const db = this.getLocalPlaylistsDatabase();

    if (!db[userId]) {
      db[userId] = {};
    }

    const playlist: LocalPlaylist = {
      id: `playlist_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      userId,
      name,
      description,
      songIds: [],
      filters,
      createdAt: new Date(),
      updatedAt: new Date()
    };

    db[userId][playlist.id] = playlist;
    this.saveLocalPlaylistsDatabase(db);
    return playlist;
  }

  // Get all local playlists for a user (sorted with starred first)
  getLocalPlaylists(userId: string): LocalPlaylist[] {
    const db = this.getLocalPlaylistsDatabase();
    const userPlaylists = db[userId] || {};
    const playlists = Object.values(userPlaylists);

    // Sort: starred playlists first, then by creation date
    return playlists.sort((a, b) => {
      if (a.starred && !b.starred) return -1;
      if (!a.starred && b.starred) return 1;
      return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
    });
  }

  // Get a specific local playlist
  getLocalPlaylist(userId: string, playlistId: string): LocalPlaylist | null {
    const db = this.getLocalPlaylistsDatabase();
    return db[userId]?.[playlistId] || null;
  }

  // Update a local playlist
  updateLocalPlaylist(
    userId: string,
    playlistId: string,
    updates: Partial<Omit<LocalPlaylist, 'id' | 'userId' | 'createdAt'>>
  ): void {
    const db = this.getLocalPlaylistsDatabase();
    if (db[userId]?.[playlistId]) {
      db[userId][playlistId] = {
        ...db[userId][playlistId],
        ...updates,
        updatedAt: new Date()
      };
      this.saveLocalPlaylistsDatabase(db);
    }
  }

  // Delete a local playlist
  deleteLocalPlaylist(userId: string, playlistId: string): void {
    const db = this.getLocalPlaylistsDatabase();
    if (db[userId]?.[playlistId]) {
      delete db[userId][playlistId];
      this.saveLocalPlaylistsDatabase(db);
    }
  }

  // Add a song to a local playlist
  addSongToLocalPlaylist(userId: string, playlistId: string, songId: string): void {
    const db = this.getLocalPlaylistsDatabase();
    if (db[userId]?.[playlistId]) {
      const playlist = db[userId][playlistId];
      if (!playlist.songIds.includes(songId)) {
        playlist.songIds.push(songId);
        playlist.updatedAt = new Date();
        this.saveLocalPlaylistsDatabase(db);
      }
    }
  }

  // Add multiple songs to a local playlist
  addSongsToLocalPlaylist(userId: string, playlistId: string, songIds: string[]): void {
    const db = this.getLocalPlaylistsDatabase();
    if (db[userId]?.[playlistId]) {
      const playlist = db[userId][playlistId];
      songIds.forEach(songId => {
        if (!playlist.songIds.includes(songId)) {
          playlist.songIds.push(songId);
        }
      });
      playlist.updatedAt = new Date();
      this.saveLocalPlaylistsDatabase(db);
    }
  }

  // Remove a song from a local playlist
  removeSongFromLocalPlaylist(userId: string, playlistId: string, songId: string): void {
    const db = this.getLocalPlaylistsDatabase();
    if (db[userId]?.[playlistId]) {
      const playlist = db[userId][playlistId];
      playlist.songIds = playlist.songIds.filter(id => id !== songId);
      playlist.updatedAt = new Date();
      this.saveLocalPlaylistsDatabase(db);
    }
  }

  // Get songs from a local playlist (returns Song objects)
  getLocalPlaylistSongs(userId: string, playlistId: string): Song[] {
    const playlist = this.getLocalPlaylist(userId, playlistId);
    if (!playlist) return [];

    const importedSongs = this.getImportedSongs(userId);
    return playlist.songIds
      .map(songId => importedSongs.find(s => s.id === songId))
      .filter(song => song !== undefined) as Song[];
  }

  // Clear all local playlists for a user
  clearLocalPlaylists(userId: string): void {
    const db = this.getLocalPlaylistsDatabase();
    if (db[userId]) {
      delete db[userId];
      this.saveLocalPlaylistsDatabase(db);
    }
  }

  // Toggle starred status for a playlist
  togglePlaylistStarred(userId: string, playlistId: string): void {
    const db = this.getLocalPlaylistsDatabase();
    if (db[userId]?.[playlistId]) {
      const playlist = db[userId][playlistId];
      playlist.starred = !playlist.starred;
      playlist.updatedAt = new Date();
      this.saveLocalPlaylistsDatabase(db);
    }
  }
}
