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

    this.loadLocalPlaylists(userId);

    // If import tab is active, load YouTube playlists
    if (this.activeTab === 'import') {
      this.loadYoutubePlaylists();
    }
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
    this.localPlaylists = this.storageService.getLocalPlaylists(userId);
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
        this.importErrorMessage = 'Failed to load playlists';
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
    const allSongs: Song[] = [];

    // Create an array of observables for fetching songs from each playlist
    const playlistObservables = selectedPlaylists.map(playlist => {
      this.currentlyImportingPlaylist = playlist.title;
      return this.youtubeMusicService.getPlaylistSongs(playlist.id);
    });

    // Fetch all playlists' songs in parallel
    forkJoin(playlistObservables).subscribe({
      next: (songsArrays: Song[][]) => {
        // Flatten the array and deduplicate by title + artist combination
        const songMap = new Map<string, Song>();

        songsArrays.forEach((songs, index) => {
          songs.forEach(song => {
            // Create a unique key based on title and artist (case-insensitive)
            const dedupeKey = `${song.title.toLowerCase()}|${song.artist.toLowerCase()}`;
            // Only add if we haven't seen this title+artist combination before
            if (!songMap.has(dedupeKey)) {
              songMap.set(dedupeKey, song);
            }
          });
          completedPlaylists++;
          this.importProgress = Math.round((completedPlaylists / totalPlaylists) * 100);
        });

        // Convert map to array
        const uniqueSongs = Array.from(songMap.values());

        // Save all imported songs to storage
        const userId = this.authService.currentUserValue?.id;
        if (userId) {
          this.storageService.saveImportedSongs(userId, uniqueSongs);

          // Create local playlists for selected playlists
          selectedPlaylists.forEach((playlist, index) => {
            if (this.saveAsLocalPlaylistIds.has(playlist.id)) {
              const playlistSongs = songsArrays[index];
              const songIds = playlistSongs.map(s => s.id);

              // Create local playlist
              this.storageService.createLocalPlaylist(
                userId,
                playlist.title,
                playlist.description || `Imported from YouTube Music`
              );

              // Get the newly created playlist
              const localPlaylists = this.storageService.getLocalPlaylists(userId);
              const localPlaylist = localPlaylists[localPlaylists.length - 1];

              // Add songs to the playlist
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

  backToDashboard(): void {
    this.router.navigate(['/library']);
  }
}
