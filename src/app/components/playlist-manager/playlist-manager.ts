import { Component, OnInit } from '@angular/core';
import { Router } from '@angular/router';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Song, SongWithMetadata } from '../../models/song.model';
import { LocalPlaylist, PlaylistFilters, Playlist } from '../../models/playlist.model';
import { Theme } from '../../models/theme.model';
import { YoutubeMusicService } from '../../services/youtube-music.service';
import { StorageService } from '../../services/storage.service';
import { AuthService } from '../../services/auth.service';
import { ModalService } from '../../services/modal.service';
import { forkJoin } from 'rxjs';

type TabType = 'import' | 'export';

@Component({
  selector: 'app-playlist-manager',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './playlist-manager.html',
  styleUrl: './playlist-manager.scss'
})
export class PlaylistManager implements OnInit {
  // Tab state
  activeTab: TabType = 'export';

  // Local playlists (for export)
  localPlaylists: LocalPlaylist[] = [];
  selectedLocalPlaylistIds: Set<string> = new Set();

  // YouTube playlists (for import)
  youtubePlaylists: Playlist[] = [];
  selectedYoutubePlaylistIds: Set<string> = new Set();
  saveAsLocalPlaylistIds: Set<string> = new Set();

  // Export state
  isExporting = false;
  exportedPlaylists: Set<string> = new Set();
  exportErrors: Map<string, string> = new Map();

  // Import state
  isLoadingPlaylists = false;
  isImporting = false;
  importProgress = 0;
  currentlyImportingPlaylist = '';
  importErrorMessage = '';

  constructor(
    private router: Router,
    private youtubeMusicService: YoutubeMusicService,
    private storageService: StorageService,
    private authService: AuthService,
    private modalService: ModalService
  ) {
    // Check navigation state for initial tab
    const navigation = this.router.getCurrentNavigation();
    if (navigation?.extras?.state) {
      this.activeTab = navigation.extras.state['tab'] || 'export';
    }
  }

  ngOnInit(): void {
    const userId = this.authService.currentUserValue?.id;
    if (!userId) {
      this.router.navigate(['/login']);
      return;
    }

    const run = async () => {
      await this.storageService.waitUntilReady();
      this.loadLocalPlaylists(userId);

      if (this.activeTab === 'import') {
        this.loadYoutubePlaylists();
      }
    };

    void run();
  }

  switchTab(tab: TabType): void {
    this.activeTab = tab;

    // Load YouTube playlists when switching to import tab
    if (tab === 'import' && this.youtubePlaylists.length === 0) {
      this.loadYoutubePlaylists();
    }
  }

  // Load local playlists
  loadLocalPlaylists(userId: string): void {
    const run = async () => {
      await this.storageService.waitUntilReady();
      this.localPlaylists = this.storageService.getLocalPlaylists(userId);
    };

    void run();
  }

  // Load YouTube playlists
  loadYoutubePlaylists(): void {
    this.isLoadingPlaylists = true;
    this.importErrorMessage = '';

    this.youtubeMusicService.getUserPlaylists().subscribe({
      next: (playlists: Playlist[]) => {
        this.youtubePlaylists = playlists;
        this.isLoadingPlaylists = false;
      },
      error: (error: any) => {
        this.importErrorMessage = 'Failed to load playlists. If you expect to see playlists, try refreshing the page or signing out and back in.';
        console.error('Error loading playlists:', error);
        this.isLoadingPlaylists = false;
      }
    });
  }

  // Export tab methods
  toggleLocalPlaylistSelection(playlistId: string): void {
    if (this.selectedLocalPlaylistIds.has(playlistId)) {
      this.selectedLocalPlaylistIds.delete(playlistId);
    } else {
      this.selectedLocalPlaylistIds.add(playlistId);
    }
  }

  selectAllLocal(): void {
    this.localPlaylists.forEach(p => this.selectedLocalPlaylistIds.add(p.id));
  }

  deselectAllLocal(): void {
    this.selectedLocalPlaylistIds.clear();
  }

  // Import tab methods
  toggleYoutubePlaylistSelection(playlistId: string): void {
    if (this.selectedYoutubePlaylistIds.has(playlistId)) {
      this.selectedYoutubePlaylistIds.delete(playlistId);
    } else {
      this.selectedYoutubePlaylistIds.add(playlistId);
    }
  }

  selectAllYoutube(): void {
    this.selectedYoutubePlaylistIds = new Set(this.youtubePlaylists.map(p => p.id));
  }

  deselectAllYoutube(): void {
    this.selectedYoutubePlaylistIds.clear();
  }

  toggleSaveAsLocalPlaylist(playlistId: string): void {
    if (this.saveAsLocalPlaylistIds.has(playlistId)) {
      this.saveAsLocalPlaylistIds.delete(playlistId);
    } else {
      this.saveAsLocalPlaylistIds.add(playlistId);
    }
  }

  isYoutubePlaylistSelected(playlistId: string): boolean {
    return this.selectedYoutubePlaylistIds.has(playlistId);
  }

  // Export functionality
  async exportSelected(): Promise<void> {
    if (this.selectedLocalPlaylistIds.size === 0) {
      await this.modalService.alert('No Selection', 'Please select at least one playlist to export.');
      return;
    }

    const userId = this.authService.currentUserValue?.id;
    if (!userId) return;

    await this.storageService.waitUntilReady();

    this.isExporting = true;
    this.exportedPlaylists.clear();
    this.exportErrors.clear();

    const playlistsToExport = this.localPlaylists.filter(p => this.selectedLocalPlaylistIds.has(p.id));

    for (const playlist of playlistsToExport) {
      const songs = this.storageService.getLocalPlaylistSongs(userId, playlist.id);

      if (songs.length === 0) {
        this.exportErrors.set(playlist.id, 'Playlist is empty');
        continue;
      }

      try {
        await this.youtubeMusicService.createPlaylist(
          playlist.name,
          playlist.description || `Exported from SonicVault`,
          songs
        ).toPromise();

        this.exportedPlaylists.add(playlist.id);
      } catch (error) {
        this.exportErrors.set(playlist.id, 'Failed to export');
        console.error(`Error exporting playlist ${playlist.name}:`, error);
      }
    }

    this.isExporting = false;

    if (this.exportedPlaylists.size > 0) {
      await this.modalService.alert(
        'Export Complete',
        `Successfully exported ${this.exportedPlaylists.size} playlist(s) to YouTube Music!`
      );
    }
  }

  async deletePlaylist(playlistId: string): Promise<void> {
    const userId = this.authService.currentUserValue?.id;
    if (!userId) return;

    const playlist = this.storageService.getLocalPlaylist(userId, playlistId);
    if (!playlist) return;

    const confirmed = await this.modalService.confirm(
      'Delete Playlist',
      `Delete playlist "${playlist.name}"? This will remove the playlist but not the songs from your library.`,
      'Delete',
      'Cancel'
    );

    if (confirmed) {
      this.storageService.deleteLocalPlaylist(userId, playlistId);
      this.selectedLocalPlaylistIds.delete(playlistId);
      this.loadLocalPlaylists(userId);
    }
  }

  // Import functionality
  importSelectedPlaylists(): void {
    if (this.selectedYoutubePlaylistIds.size === 0) {
      this.importErrorMessage = 'Please select at least one playlist';
      return;
    }

    this.isImporting = true;
    this.importErrorMessage = '';
    this.importProgress = 0;

    const selectedPlaylists = this.youtubePlaylists.filter(p => this.selectedYoutubePlaylistIds.has(p.id));
    const totalPlaylists = selectedPlaylists.length;
    let completedPlaylists = 0;

    // Create an array of observables for fetching songs from each playlist
    const playlistObservables = selectedPlaylists.map(playlist => {
      this.currentlyImportingPlaylist = playlist.title;
      return this.youtubeMusicService.getPlaylistSongs(playlist.id);
    });

    // Fetch all playlists' songs in parallel
    forkJoin(playlistObservables).subscribe({
      next: (songsArrays: Song[][]) => {
        const userId = this.authService.currentUserValue?.id;
        const existingSongMap = new Map<string, Song>();

        if (userId) {
          const previouslyImportedSongs = this.storageService.getImportedSongs(userId);
          previouslyImportedSongs.forEach(existingSong => {
            const key = this.buildSongKey(existingSong.title, existingSong.artist);
            existingSongMap.set(key, existingSong);
          });
        }

        const songMap = new Map<string, Song>();
        const playlistSongIds: string[][] = [];

        songsArrays.forEach((songs, index) => {
          const canonicalIds: string[] = [];

          songs.forEach(song => {
            const songKey = this.buildSongKey(song.title, song.artist);
            let canonicalSong = songMap.get(songKey);

            if (!canonicalSong) {
              const existingSong = existingSongMap.get(songKey);
              const normalizedSong: Song = {
                ...(existingSong ?? {}),
                ...song,
                id: existingSong?.id || this.generateCanonicalSongId(song)
              };

              songMap.set(songKey, normalizedSong);
              existingSongMap.set(songKey, normalizedSong);
              canonicalSong = normalizedSong;
            }

            canonicalIds.push(canonicalSong.id);
          });

          playlistSongIds[index] = Array.from(new Set(canonicalIds));
          completedPlaylists++;
          this.importProgress = Math.round((completedPlaylists / totalPlaylists) * 100);
        });

        const uniqueSongs = Array.from(songMap.values());

        if (userId) {
          this.storageService.saveImportedSongs(userId, uniqueSongs);

          selectedPlaylists.forEach((playlist, index) => {
            if (this.saveAsLocalPlaylistIds.has(playlist.id)) {
              const songIds = playlistSongIds[index] ?? [];

              this.storageService.createLocalPlaylist(
                userId,
                playlist.title,
                playlist.description || `Imported from YouTube Music`
              );

              const localPlaylists = this.storageService.getLocalPlaylists(userId);
              const localPlaylist = localPlaylists[localPlaylists.length - 1];

              if (localPlaylist) {
                this.storageService.addSongsToLocalPlaylist(userId, localPlaylist.id, songIds);
              }
            }
          });
        }

        console.log(`✅ Imported ${uniqueSongs.length} unique songs from ${totalPlaylists} playlists`);

        // Navigate to library view
        this.router.navigate(['/library']);
      },
      error: (error: any) => {
        this.importErrorMessage = 'Failed to import playlists. Please try again.';
        console.error('Error importing playlists:', error);
        this.isImporting = false;
      }
    });
  }

  private buildSongKey(title: string, artist: string): string {
    return `${this.normalizeSongField(artist)}|${this.normalizeSongField(title)}`;
  }

  private generateCanonicalSongId(song: Song): string {
    const normalizedArtist = this.normalizeSongField(song.artist);
    const normalizedTitle = this.normalizeSongField(song.title);
    const parts = [normalizedArtist, normalizedTitle].filter(Boolean);

    if (parts.length > 0) {
      return `song_${parts.join('_')}`;
    }

    return `song_${song.videoId || song.id}`;
  }

  private normalizeSongField(value: string): string {
    if (!value) {
      return '';
    }

    return value
      .normalize('NFKD')
      .replace(/[\u0300-\u036f]/g, '')
      .toLowerCase()
      .trim()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '');
  }

  backToDashboard(): void {
    this.router.navigate(['/library']);
  }
}
