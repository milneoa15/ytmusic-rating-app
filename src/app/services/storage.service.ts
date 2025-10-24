import { Injectable, OnDestroy } from '@angular/core';
import { Subscription } from 'rxjs';
import { Song, SongRating } from '../models/song.model';
import { Theme, SongTheme } from '../models/theme.model';
import { LocalPlaylist, PlaylistFilters } from '../models/playlist.model';
import { ApiService, LibraryResponse } from './api.service';
import { AuthService } from './auth.service';
import { environment } from '../../environments/environment';

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
export class StorageService implements OnDestroy {
  private readonly remoteEnabled = environment.remoteStorageEnabled;
  private ratingsDb: RatingsDatabase = {};
  private themesDb: ThemesDatabase = {};
  private songThemesDb: SongThemesDatabase = {};
  private importedSongsDb: ImportedSongsDatabase = {};
  private localPlaylistsDb: LocalPlaylistsDatabase = {};
  private authSubscription?: Subscription;
  private currentUserId: string | null = null;
  private remoteQueue: Promise<void> = Promise.resolve();
  private readyResolver: (() => void) | null = null;
  private readyPromise: Promise<void> = Promise.resolve();

  constructor(private apiService: ApiService, private authService: AuthService) {
    if (this.remoteEnabled) {
      this.resetReadyPromise(true);

      this.authSubscription = this.authService.currentUser.subscribe(user => {
        if (user) {
          this.currentUserId = user.id;
          this.resetReadyPromise();
          this.schedule(() => this.syncFromRemote());
        } else {
          if (this.currentUserId) {
            this.clearLocalDataForUser(this.currentUserId);
          }
          this.currentUserId = null;
          this.resetReadyPromise(true);
        }
      });

      const existingUser = this.authService.currentUserValue;
      if (existingUser) {
        this.currentUserId = existingUser.id;
        this.resetReadyPromise();
        this.schedule(() => this.syncFromRemote());
      }
    } else {
      this.readyPromise = Promise.resolve();
    }
  }

  ngOnDestroy(): void {
    this.authSubscription?.unsubscribe();
  }

  async waitUntilReady(): Promise<void> {
    await this.readyPromise;
  }

  private createReadyPromise(): { promise: Promise<void>; resolve: () => void } {
    let resolver: () => void;
    const promise = new Promise<void>(resolve => {
      resolver = resolve;
    });
    return { promise, resolve: resolver! };
  }

  private resetReadyPromise(resolveImmediately = false): void {
    const { promise, resolve } = this.createReadyPromise();
    this.readyPromise = promise;
    this.readyResolver = resolve;
    if (resolveImmediately) {
      this.markReady();
    }
  }

  private markReady(): void {
    if (this.readyResolver) {
      this.readyResolver();
      this.readyResolver = null;
    }
  }

  private schedule(task: () => Promise<void>): void {
    this.remoteQueue = this.remoteQueue
      .then(() => task().catch(error => {
        console.error('[StorageService] Remote sync error', error);
      }))
      .catch(error => {
        console.error('[StorageService] Remote queue failure', error);
      });
  }

  private enqueueAuthorizedTask(operation: (token: string) => Promise<void>): void {
    if (!this.remoteEnabled) {
      return;
    }
    this.schedule(async () => {
      const token = await this.getAccessToken();
      if (!token) {
        return;
      }
      await operation(token);
    });
  }

  private async getAccessToken(): Promise<string | null> {
    const user = this.authService.currentUserValue;
    if (!user) {
      return null;
    }

    const tokenValid = await this.authService.ensureValidToken();
    if (!tokenValid) {
      return null;
    }

    return this.authService.currentUserValue?.youtubeAccessToken ?? null;
  }

  private async syncFromRemote(): Promise<void> {
    try {
      const token = await this.getAccessToken();
      if (!token || !this.currentUserId) {
        this.markReady();
        return;
      }

      const library = await this.apiService.getLibrary(token);
      this.hydrateCache(this.currentUserId, library);
    } catch (error) {
      console.error('[StorageService] Failed to sync from Supabase', error);
    } finally {
      this.markReady();
    }
  }

  private hydrateCache(userId: string, library: LibraryResponse): void {
    this.applyRatings(userId, library);
    this.applyImportedSongs(userId, library);
    this.applyThemes(userId, library);
    this.applySongThemes(userId, library);
    this.applyPlaylists(userId, library);
  }

  private clearLocalDataForUser(userId: string): void {
    const ratingsDb = this.getRatingsDatabase();
    delete ratingsDb[userId];
    this.saveRatingsDatabase(ratingsDb);

    const themesDb = this.getThemesDatabase();
    delete themesDb[userId];
    this.saveThemesDatabase(themesDb);

    const songThemesDb = this.getSongThemesDatabase();
    delete songThemesDb[userId];
    this.saveSongThemesDatabase(songThemesDb);

    const importedDb = this.getImportedSongsDatabase();
    delete importedDb[userId];
    this.saveImportedSongsDatabase(importedDb);

    const playlistsDb = this.getLocalPlaylistsDatabase();
    delete playlistsDb[userId];
    this.saveLocalPlaylistsDatabase(playlistsDb);
  }

  private isCurrentUser(userId: string): boolean {
    return !!this.currentUserId && this.currentUserId === userId;
  }

  private applyRatings(userId: string, library: LibraryResponse): void {
    const ratingsDb = this.getRatingsDatabase();
    ratingsDb[userId] = {};
    library.ratings.forEach(rating => {
      ratingsDb[userId][rating.songId] = {
        songId: rating.songId,
        userId,
        rating: rating.rating,
        ratedAt: rating.ratedAt ? new Date(rating.ratedAt) : new Date()
      };
    });
    this.saveRatingsDatabase(ratingsDb);
  }

  private applyImportedSongs(userId: string, library: LibraryResponse): void {
    const importedDb = this.getImportedSongsDatabase();
    importedDb[userId] = {};
    library.songs.forEach(song => {
      importedDb[userId][song.id] = {
        id: song.id,
        videoId: song.videoId ?? '',
        title: song.title,
        artist: song.artist ?? '',
        album: song.album,
        duration: song.duration,
        thumbnailUrl: song.thumbnailUrl,
        playlistId: song.playlistId
      };
    });
    this.saveImportedSongsDatabase(importedDb);
  }

  private applyThemes(userId: string, library: LibraryResponse): void {
    const themesDb = this.getThemesDatabase();
    themesDb[userId] = {};
    library.themes.forEach(theme => {
      themesDb[userId][theme.id] = {
        ...theme,
        createdAt: theme.createdAt ? new Date(theme.createdAt) : new Date()
      };
    });
    this.saveThemesDatabase(themesDb);
  }

  private applySongThemes(userId: string, library: LibraryResponse): void {
    const songThemesDb = this.getSongThemesDatabase();
    const mapping: { [songId: string]: string[] } = {};
    library.songThemes.forEach(link => {
      if (!mapping[link.songId]) {
        mapping[link.songId] = [];
      }
      mapping[link.songId].push(link.themeId);
    });
    songThemesDb[userId] = mapping;
    this.saveSongThemesDatabase(songThemesDb);
  }

  private applyPlaylists(userId: string, library: LibraryResponse): void {
    const playlistsDb = this.getLocalPlaylistsDatabase();
    playlistsDb[userId] = {};
    library.playlists.forEach(playlist => {
      playlistsDb[userId][playlist.id] = {
        ...playlist,
        createdAt: playlist.createdAt ? new Date(playlist.createdAt) : new Date(),
        updatedAt: playlist.updatedAt ? new Date(playlist.updatedAt) : new Date(),
        songIds: playlist.songIds ?? []
      };
    });
    this.saveLocalPlaylistsDatabase(playlistsDb);
  }

  private upsertThemeLocally(userId: string, theme: Theme): void {
    const themesDb = this.getThemesDatabase();
    if (!themesDb[userId]) {
      themesDb[userId] = {};
    }

    themesDb[userId][theme.id] = {
      ...theme,
      createdAt: theme.createdAt instanceof Date ? theme.createdAt : new Date(theme.createdAt)
    };
    this.saveThemesDatabase(themesDb);
  }

  private persistThemeToRemote(userId: string, theme: Theme): void {
    if (!this.remoteEnabled || !this.isCurrentUser(userId)) {
      return;
    }

    this.enqueueAuthorizedTask(async token => {
      const saved = await this.apiService.saveTheme(token, theme);
      this.upsertThemeLocally(userId, {
        ...saved,
        createdAt: saved.createdAt instanceof Date ? saved.createdAt : new Date(saved.createdAt)
      });
    });
  }

  private upsertLocalPlaylist(userId: string, playlist: LocalPlaylist): void {
    const playlistsDb = this.getLocalPlaylistsDatabase();
    if (!playlistsDb[userId]) {
      playlistsDb[userId] = {};
    }

    playlistsDb[userId][playlist.id] = {
      ...playlist,
      songIds: [...(playlist.songIds ?? [])],
      createdAt: playlist.createdAt instanceof Date ? playlist.createdAt : new Date(playlist.createdAt),
      updatedAt: playlist.updatedAt instanceof Date ? playlist.updatedAt : new Date(playlist.updatedAt)
    };
    this.saveLocalPlaylistsDatabase(playlistsDb);
  }

  private persistPlaylistToRemote(userId: string, playlist: LocalPlaylist): void {
    if (!this.remoteEnabled || !this.isCurrentUser(userId)) {
      return;
    }

    this.enqueueAuthorizedTask(async token => {
      const saved = await this.apiService.savePlaylist(token, playlist);
      this.upsertLocalPlaylist(userId, {
        ...saved,
        createdAt: saved.createdAt instanceof Date ? saved.createdAt : new Date(saved.createdAt),
        updatedAt: saved.updatedAt instanceof Date ? saved.updatedAt : new Date(saved.updatedAt)
      });
    });
  }

  private getRatingsDatabase(): RatingsDatabase {
    return this.ratingsDb;
  }

  private saveRatingsDatabase(db: RatingsDatabase): void {
    this.ratingsDb = db;
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

    if (this.remoteEnabled && this.isCurrentUser(userId)) {
      const songForRemote =
        this.getImportedSong(userId, songId) ?? {
          id: songId,
          videoId: songId,
          title: 'Unknown Song',
          artist: ''
        };

      this.enqueueAuthorizedTask(token => this.apiService.saveRating(token, songForRemote, rating));
    }
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

      if (this.remoteEnabled && this.isCurrentUser(userId)) {
        this.enqueueAuthorizedTask(token => this.apiService.deleteRating(token, songId));
      }
    }
  }

  // Clear all ratings for a user
  clearUserRatings(userId: string): void {
    const db = this.getRatingsDatabase();
    if (db[userId]) {
      const songIds = Object.keys(db[userId]);
      delete db[userId];
      this.saveRatingsDatabase(db);

      if (this.remoteEnabled && this.isCurrentUser(userId) && songIds.length > 0) {
        this.enqueueAuthorizedTask(async token => {
          await Promise.all(songIds.map(id => this.apiService.deleteRating(token, id)));
        });
      }
    }
  }

  // ============= THEME MANAGEMENT =============

  private getThemesDatabase(): ThemesDatabase {
    return this.themesDb;
  }

  private saveThemesDatabase(db: ThemesDatabase): void {
    this.themesDb = db;
  }

  // Create a new theme
  createTheme(userId: string, name: string, color: string): Theme {
    const theme: Theme = {
      id: `theme_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      name,
      color,
      userId,
      createdAt: new Date()
    };

    this.upsertThemeLocally(userId, theme);
    this.persistThemeToRemote(userId, theme);
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
      this.persistThemeToRemote(userId, db[userId][themeId]);
    }
  }

  // Delete a theme
  deleteTheme(userId: string, themeId: string): void {
    const db = this.getThemesDatabase();
    if (db[userId]?.[themeId]) {
      delete db[userId][themeId];
      this.saveThemesDatabase(db);
      if (this.remoteEnabled && this.isCurrentUser(userId)) {
        this.enqueueAuthorizedTask(token => this.apiService.deleteTheme(token, themeId));
      }
      
      // Also remove this theme from all songs
      this.removeThemeFromAllSongs(userId, themeId);
    }
  }

  // ============= SONG-THEME ASSIGNMENTS =============

  private getSongThemesDatabase(): SongThemesDatabase {
    return this.songThemesDb;
  }

  private saveSongThemesDatabase(db: SongThemesDatabase): void {
    this.songThemesDb = db;
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

      if (this.remoteEnabled && this.isCurrentUser(userId)) {
        this.enqueueAuthorizedTask(token => this.apiService.assignTheme(token, songId, themeId));
      }
    }
  }

  // Remove a theme from a song
  removeThemeFromSong(userId: string, songId: string, themeId: string): void {
    const db = this.getSongThemesDatabase();
    if (db[userId]?.[songId]) {
      db[userId][songId] = db[userId][songId].filter((id: string) => id !== themeId);
      this.saveSongThemesDatabase(db);

      if (this.remoteEnabled && this.isCurrentUser(userId)) {
        this.enqueueAuthorizedTask(token => this.apiService.removeTheme(token, songId, themeId));
      }
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
    return this.importedSongsDb;
  }

  private saveImportedSongsDatabase(db: ImportedSongsDatabase): void {
    this.importedSongsDb = db;
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

    if (this.remoteEnabled && this.isCurrentUser(userId) && songs.length > 0) {
      this.enqueueAuthorizedTask(token => this.apiService.saveImportedSongs(token, songs));
    }
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

      if (this.remoteEnabled && this.isCurrentUser(userId)) {
        this.enqueueAuthorizedTask(token => this.apiService.removeImportedSong(token, songId));
      }
    }
  }

  // Clear all imported songs for a user
  clearImportedSongs(userId: string): void {
    const db = this.getImportedSongsDatabase();
    if (db[userId]) {
      const songIds = Object.keys(db[userId]);
      delete db[userId];
      this.saveImportedSongsDatabase(db);

      if (this.remoteEnabled && this.isCurrentUser(userId) && songIds.length > 0) {
        this.enqueueAuthorizedTask(async token => {
          await Promise.all(songIds.map(id => this.apiService.removeImportedSong(token, id)));
        });
      }
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
    return this.localPlaylistsDb;
  }

  private saveLocalPlaylistsDatabase(db: LocalPlaylistsDatabase): void {
    this.localPlaylistsDb = db;
  }

  // Create a new local playlist
  createLocalPlaylist(
    userId: string,
    name: string,
    description?: string,
    filters?: PlaylistFilters
  ): LocalPlaylist {
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

    this.upsertLocalPlaylist(userId, playlist);
    this.persistPlaylistToRemote(userId, playlist);
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
    const existing = db[userId]?.[playlistId];
    if (existing) {
      const updated: LocalPlaylist = {
        ...existing,
        ...updates,
        updatedAt: new Date()
      };
      this.upsertLocalPlaylist(userId, updated);
      this.persistPlaylistToRemote(userId, updated);
    }
  }

  // Delete a local playlist
  deleteLocalPlaylist(userId: string, playlistId: string): void {
    const db = this.getLocalPlaylistsDatabase();
    if (db[userId]?.[playlistId]) {
      delete db[userId][playlistId];
      this.saveLocalPlaylistsDatabase(db);

      if (this.remoteEnabled && this.isCurrentUser(userId)) {
        this.enqueueAuthorizedTask(token => this.apiService.deletePlaylist(token, playlistId));
      }
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
        this.persistPlaylistToRemote(userId, playlist);
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
      this.persistPlaylistToRemote(userId, playlist);
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
      this.persistPlaylistToRemote(userId, playlist);
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
      const playlistIds = Object.keys(db[userId]);
      delete db[userId];
      this.saveLocalPlaylistsDatabase(db);

      if (this.remoteEnabled && this.isCurrentUser(userId) && playlistIds.length > 0) {
        this.enqueueAuthorizedTask(async token => {
          await Promise.all(playlistIds.map(id => this.apiService.deletePlaylist(token, id)));
        });
      }
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
      this.persistPlaylistToRemote(userId, playlist);
    }
  }
}
