import { Component, OnInit } from '@angular/core';
import { Router } from '@angular/router';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Song, SongWithMetadata } from '../../models/song.model';
import { Playlist, ExportOptions } from '../../models/playlist.model';
import { Theme } from '../../models/theme.model';
import { YoutubeMusicService } from '../../services/youtube-music.service';
import { StorageService } from '../../services/storage.service';
import { AuthService } from '../../services/auth.service';

interface RatingData {
  songId: string;
  rating: number;
}

@Component({
  selector: 'app-playlist-export',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './playlist-export.html',
  styleUrl: './playlist-export.scss'
})
export class PlaylistExport implements OnInit {
  playlist: Playlist | null = null;
  songs: Song[] = [];
  allSongsWithMetadata: SongWithMetadata[] = [];
  ratingsData: RatingData[] = [];
  themes: Theme[] = [];
  selectedThemes: Set<string> = new Set();
  themeFilterMode: 'any' | 'all' = 'any'; // Match ANY theme or ALL themes
  includeUnrated = true;
  excludedSongIds: Set<string> = new Set(); // Songs manually excluded from export
  
  exportOptions: ExportOptions = {
    minRating: 0,
    maxRating: 10,
    playlistName: '',
    description: ''
  };

  presetFilters = [
    { label: 'All Songs (1-10)', min: 1, max: 10 },
    { label: 'Good & Above (7-10)', min: 7, max: 10 },
    { label: 'Excellent Only (9-10)', min: 9, max: 10 },
    { label: 'Masterpieces (10)', min: 10, max: 10 },
    { label: 'Mid-Range (5-7)', min: 5, max: 7 },
    { label: 'Lower Half (1-5)', min: 1, max: 5 }
  ];

  isExporting = false;
  exportSuccess = false;
  errorMessage = '';

  constructor(
    private router: Router,
    private youtubeMusicService: YoutubeMusicService,
    private storageService: StorageService,
    private authService: AuthService
  ) {
    const navigation = this.router.getCurrentNavigation();
    if (navigation?.extras?.state) {
      this.playlist = navigation.extras.state['playlist'];
      this.songs = navigation.extras.state['songs'];
      this.ratingsData = navigation.extras.state['ratings'] || [];
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

      // Load all imported songs from storage
      this.songs = this.storageService.getImportedSongs(userId);
      
      if (this.songs.length === 0) {
        this.router.navigate(['/import']);
        return;
      }

      // Load themes
      this.themes = this.storageService.getThemes(userId);

      // Build songs with metadata
      this.allSongsWithMetadata = this.songs.map(song => {
        const rating = this.storageService.getRating(userId, song.id)?.rating;
        const themes = this.storageService.getSongThemes(userId, song.id);
        return {
          ...song,
          rating,
          themes
        };
      });

      this.exportOptions.playlistName = 'My Playlist';
    };

    void run();
  }

  get filteredSongs(): SongWithMetadata[] {
    return this.allSongsWithMetadata.filter(song => {
      // Check if manually excluded
      if (this.excludedSongIds.has(song.id)) return false;

      // Rating filter
      if (song.rating === undefined) {
        // Unrated song
        if (!this.includeUnrated) return false;
      } else {
        // Rated song - check if in range (min 0 means include unrated too)
        if (this.exportOptions.minRating > 0 && song.rating < this.exportOptions.minRating) return false;
        if (song.rating > this.exportOptions.maxRating) return false;
      }

      // Theme filter
      if (this.selectedThemes.size > 0) {
        const songThemes = song.themes || [];
        
        if (this.themeFilterMode === 'any') {
          // Song must have AT LEAST ONE of the selected themes
          const hasAnyTheme = Array.from(this.selectedThemes).some(themeId => 
            songThemes.includes(themeId)
          );
          if (!hasAnyTheme) return false;
        } else {
          // Song must have ALL of the selected themes
          const hasAllThemes = Array.from(this.selectedThemes).every(themeId => 
            songThemes.includes(themeId)
          );
          if (!hasAllThemes) return false;
        }
      }

      return true;
    });
  }

  get ratingDistribution(): { [key: number]: number } {
    const distribution: { [key: number]: number } = { 0: 0 }; // 0 for unrated
    for (let i = 1; i <= 10; i++) {
      distribution[i] = 0;
    }

    this.allSongsWithMetadata.forEach(song => {
      const rating = song.rating ?? 0; // Use 0 for unrated
      distribution[rating]++;
    });

    return distribution;
  }

  toggleTheme(themeId: string): void {
    if (this.selectedThemes.has(themeId)) {
      this.selectedThemes.delete(themeId);
    } else {
      this.selectedThemes.add(themeId);
    }
  }

  getThemeById(themeId: string): Theme | undefined {
    return this.themes.find(t => t.id === themeId);
  }

  applyPresetFilter(preset: { min: number; max: number; label: string }): void {
    this.exportOptions.minRating = preset.min;
    this.exportOptions.maxRating = preset.max;
    if (this.playlist) {
      this.exportOptions.playlistName = `${this.playlist.title} - ${preset.label}`;
    }
  }

  updatePlaylistName(): void {
    if (this.playlist) {
      this.exportOptions.playlistName = `${this.playlist.title} - Rated ${this.exportOptions.minRating}-${this.exportOptions.maxRating}`;
    }
  }

  exportPlaylist(): void {
    const songsToExport = this.filteredSongs;
    
    if (songsToExport.length === 0) {
      this.errorMessage = 'No songs match the selected rating range';
      return;
    }

    this.isExporting = true;
    this.errorMessage = '';

    this.youtubeMusicService.createPlaylist(
      this.exportOptions.playlistName,
      this.exportOptions.description || `Playlist with songs rated ${this.exportOptions.minRating}-${this.exportOptions.maxRating}`,
      songsToExport
    ).subscribe({
      next: () => {
        this.exportSuccess = true;
        this.isExporting = false;
      },
      error: (error: any) => {
        this.errorMessage = 'Failed to export playlist. Please try again.';
        console.error('Export error:', error);
        this.isExporting = false;
      }
    });
  }

  backToDashboard(): void {
    this.router.navigate(['/dashboard']);
  }

  excludeSongFromExport(songId: string): void {
    this.excludedSongIds.add(songId);
  }

  onFilterChange(): void {
    // Reset excluded songs when filters change
    this.excludedSongIds.clear();
  }

  getRatingForSong(songId: string): number | null {
    const userId = this.authService.currentUserValue?.id;
    if (!userId) return null;

    const ratingData = this.ratingsData.find(r => r.songId === songId);
    return ratingData?.rating || this.storageService.getRating(userId, songId)?.rating || null;
  }
}
