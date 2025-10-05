import { Component, OnInit } from '@angular/core';
import { Router } from '@angular/router';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { YoutubeMusicService } from '../../services/youtube-music.service';
import { StorageService } from '../../services/storage.service';
import { AuthService } from '../../services/auth.service';
import { Playlist } from '../../models/playlist.model';
import { Song } from '../../models/song.model';
import { forkJoin } from 'rxjs';

@Component({
  selector: 'app-playlist-import',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './playlist-import.html',
  styleUrl: './playlist-import.scss'
})
export class PlaylistImport implements OnInit {
  playlists: Playlist[] = [];
  selectedPlaylistIds: Set<string> = new Set();
  isLoading = false;
  isImporting = false;
  errorMessage = '';
  importProgress = 0;
  currentlyImportingPlaylist = '';

  constructor(
    private youtubeMusicService: YoutubeMusicService,
    private storageService: StorageService,
    private authService: AuthService,
    private router: Router
  ) {}

  ngOnInit(): void {
    this.loadPlaylists();
  }

  loadPlaylists(): void {
    this.isLoading = true;
    this.youtubeMusicService.getUserPlaylists().subscribe({
      next: (playlists: Playlist[]) => {
        this.playlists = playlists;
        this.isLoading = false;
      },
      error: (error: any) => {
        this.errorMessage = 'Failed to load playlists';
        console.error('Error loading playlists:', error);
        this.isLoading = false;
      }
    });
  }

  togglePlaylistSelection(playlistId: string): void {
    if (this.selectedPlaylistIds.has(playlistId)) {
      this.selectedPlaylistIds.delete(playlistId);
    } else {
      this.selectedPlaylistIds.add(playlistId);
    }
  }

  isPlaylistSelected(playlistId: string): boolean {
    return this.selectedPlaylistIds.has(playlistId);
  }

  selectAllPlaylists(): void {
    this.selectedPlaylistIds = new Set(this.playlists.map(p => p.id));
  }

  deselectAllPlaylists(): void {
    this.selectedPlaylistIds.clear();
  }

  importSelectedPlaylists(): void {
    if (this.selectedPlaylistIds.size === 0) {
      this.errorMessage = 'Please select at least one playlist';
      return;
    }

    this.isImporting = true;
    this.errorMessage = '';
    this.importProgress = 0;

    const selectedPlaylists = this.playlists.filter(p => this.selectedPlaylistIds.has(p.id));
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
        // Flatten the array and deduplicate by videoId
        const songMap = new Map<string, Song>();
        
        songsArrays.forEach((songs, index) => {
          songs.forEach(song => {
            // Only add if we haven't seen this videoId before
            if (!songMap.has(song.videoId)) {
              songMap.set(song.videoId, song);
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
        }

        console.log(`✅ Imported ${uniqueSongs.length} unique songs from ${totalPlaylists} playlists`);
        
        // Navigate to library view
        this.router.navigate(['/library']);
      },
      error: (error: any) => {
        this.errorMessage = 'Failed to import playlists. Please try again.';
        console.error('Error importing playlists:', error);
        this.isImporting = false;
      }
    });
  }

  backToDashboard(): void {
    this.router.navigate(['/dashboard']);
  }
}
