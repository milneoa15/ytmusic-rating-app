import { Component, OnInit, ChangeDetectorRef } from '@angular/core';
import { Router } from '@angular/router';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Song, SongWithMetadata } from '../../models/song.model';
import { Theme } from '../../models/theme.model';
import { StorageService } from '../../services/storage.service';
import { AuthService } from '../../services/auth.service';
import { ModalService } from '../../services/modal.service';

type SortOption = 'title' | 'artist' | 'rating' | 'recent';

@Component({
  selector: 'app-song-library',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './song-library.html',
  styleUrl: './song-library.scss'
})
export class SongLibrary implements OnInit {
  allSongs: SongWithMetadata[] = [];
  filteredSongs: SongWithMetadata[] = [];
  themes: Theme[] = [];
  
  // Filters
  selectedArtists: Set<string> = new Set();
  selectedThemes: Set<string> = new Set();
  minRating: number = 0;
  maxRating: number = 10;
  searchQuery: string = '';
  artistSearchQuery: string = '';
  
  // Sorting
  sortBy: SortOption = 'title';
  sortAscending: boolean = true;
  
  // Theme management
  showThemeModal: boolean = false;
  newThemeName: string = '';
  newThemeColor: string = '#c62828';
  editingTheme: Theme | null = null;
  
  // Song theme assignment
  assigningThemesForSong: SongWithMetadata | null = null;
  
  // UI state
  viewMode: 'grid' | 'list' = 'list';
  artistsCollapsed: boolean = true;
  themesCollapsed: boolean = true;
  
  // Select mode
  selectMode: boolean = false;
  selectedSongs: Set<string> = new Set();

  constructor(
    private storageService: StorageService,
    private authService: AuthService,
    private router: Router,
    private cdr: ChangeDetectorRef,
    private modalService: ModalService
  ) {}

  ngOnInit(): void {
    this.loadLibrary();
  }

  loadLibrary(): void {
    const userId = this.authService.currentUserValue?.id;
    if (!userId) {
      this.router.navigate(['/login']);
      return;
    }

    // Load all imported songs
    const songs = this.storageService.getImportedSongs(userId);
    
    // Enrich songs with ratings and themes
    this.allSongs = songs.map(song => {
      const rating = this.storageService.getRating(userId, song.id);
      const themeIds = this.storageService.getSongThemes(userId, song.id);
      
      return {
        ...song,
        rating: rating?.rating,
        themes: themeIds
      };
    });

    // Load themes
    this.themes = this.storageService.getThemes(userId);
    
    // Apply filters
    this.applyFilters();
  }

  get uniqueArtists(): string[] {
    const artists = new Set(this.allSongs.map(s => s.artist));
    return Array.from(artists).sort();
  }

  get filteredArtists(): string[] {
    if (!this.artistSearchQuery.trim()) {
      return this.uniqueArtists;
    }
    const query = this.artistSearchQuery.toLowerCase();
    return this.uniqueArtists.filter(artist => 
      artist.toLowerCase().includes(query)
    );
  }

  toggleArtistFilter(artist: string): void {
    if (this.selectedArtists.has(artist)) {
      this.selectedArtists.delete(artist);
    } else {
      this.selectedArtists.add(artist);
    }
    this.applyFilters();
  }

  toggleThemeFilter(themeId: string): void {
    if (this.selectedThemes.has(themeId)) {
      this.selectedThemes.delete(themeId);
    } else {
      this.selectedThemes.add(themeId);
    }
    this.applyFilters();
  }

  applyFilters(): void {
    this.filteredSongs = this.allSongs.filter(song => {
      // Artist filter
      if (this.selectedArtists.size > 0 && !this.selectedArtists.has(song.artist)) {
        return false;
      }

      // Theme filter
      if (this.selectedThemes.size > 0) {
        const hasTheme = song.themes?.some(themeId => this.selectedThemes.has(themeId));
        if (!hasTheme) return false;
      }

      // Rating filter
      if (song.rating !== undefined) {
        if (song.rating < this.minRating || song.rating > this.maxRating) {
          return false;
        }
      } else if (this.minRating > 0) {
        return false; // Exclude unrated if minimum rating is set
      }

      // Search query
      if (this.searchQuery) {
        const query = this.searchQuery.toLowerCase();
        return song.title.toLowerCase().includes(query) || 
               song.artist.toLowerCase().includes(query);
      }

      return true;
    });

    this.sortSongs();
  }

  sortSongs(): void {
    this.filteredSongs.sort((a, b) => {
      let comparison = 0;

      switch (this.sortBy) {
        case 'title':
          comparison = a.title.localeCompare(b.title);
          break;
        case 'artist':
          comparison = a.artist.localeCompare(b.artist);
          break;
        case 'rating':
          comparison = (a.rating || 0) - (b.rating || 0);
          break;
        case 'recent':
          // Assuming songs are already ordered by import time
          comparison = 0;
          break;
      }

      return this.sortAscending ? comparison : -comparison;
    });
  }

  changeSorting(option: SortOption): void {
    if (this.sortBy === option) {
      this.sortAscending = !this.sortAscending;
    } else {
      this.sortBy = option;
      this.sortAscending = true;
    }
    this.sortSongs();
  }

  rateSong(song: SongWithMetadata, rating: number): void {
    const userId = this.authService.currentUserValue?.id;
    if (!userId) return;

    // If clicking the same rating, unrate the song
    if (song.rating === rating) {
      this.storageService.deleteRating(userId, song.id);
      const songIndex = this.allSongs.findIndex(s => s.id === song.id);
      if (songIndex !== -1) {
        this.allSongs[songIndex].rating = undefined;
      }
    } else {
      this.storageService.saveRating(userId, song.id, rating);
      
      // Update the song in the local array
      const songIndex = this.allSongs.findIndex(s => s.id === song.id);
      if (songIndex !== -1) {
        this.allSongs[songIndex].rating = rating;
      }
    }

    this.applyFilters();
  }

  // Theme Management
  openThemeModal(theme?: Theme): void {
    if (theme) {
      this.editingTheme = theme;
      this.newThemeName = theme.name;
      this.newThemeColor = theme.color;
    } else {
      this.editingTheme = null;
      this.newThemeName = '';
      this.newThemeColor = '#c62828';
    }
    this.showThemeModal = true;
  }

  closeThemeModal(): void {
    this.showThemeModal = false;
    this.editingTheme = null;
    this.newThemeName = '';
    this.newThemeColor = '#c62828';
  }

  saveTheme(): void {
    const userId = this.authService.currentUserValue?.id;
    if (!userId || !this.newThemeName.trim()) return;

    if (this.editingTheme) {
      // Update existing theme
      this.storageService.updateTheme(userId, this.editingTheme.id, this.newThemeName, this.newThemeColor);
    } else {
      // Create new theme
      this.storageService.createTheme(userId, this.newThemeName, this.newThemeColor);
    }

    this.loadLibrary();
    this.closeThemeModal();
  }

  async deleteTheme(theme: Theme): Promise<void> {
    const confirmed = await this.modalService.confirm(
      'Delete Theme',
      `Delete theme "${theme.name}"? This will remove it from all songs.`,
      'Delete',
      'Cancel'
    );

    if (!confirmed) return;

    const userId = this.authService.currentUserValue?.id;
    if (!userId) return;

    this.storageService.deleteTheme(userId, theme.id);
    this.loadLibrary();
  }

  // Song-Theme Assignment
  openThemeAssignment(song: Song): void {
    this.assigningThemesForSong = song;
  }

  closeThemeAssignment(): void {
    this.assigningThemesForSong = null;
  }

  toggleSongTheme(song: SongWithMetadata, themeId: string): void {
    const userId = this.authService.currentUserValue?.id;
    if (!userId) return;

    const songThemes = this.storageService.getSongThemes(userId, song.id);
    
    if (songThemes.includes(themeId)) {
      this.storageService.removeThemeFromSong(userId, song.id, themeId);
    } else {
      this.storageService.assignThemeToSong(userId, song.id, themeId);
    }

    // Get the updated themes from storage
    const updatedThemes = this.storageService.getSongThemes(userId, song.id);
    
    // Update the song's themes in the UI
    const songIndex = this.allSongs.findIndex(s => s.id === song.id);
    if (songIndex !== -1) {
      this.allSongs[songIndex].themes = updatedThemes;
    }
    
    // Update the modal's song reference
    if (this.assigningThemesForSong && this.assigningThemesForSong.id === song.id) {
      this.assigningThemesForSong.themes = updatedThemes;
    }
    
    // Trigger change detection
    this.cdr.detectChanges();
    
    // Reload full library to ensure everything is in sync
    this.loadLibrary();
  }

  isSongInTheme(song: SongWithMetadata, themeId: string): boolean {
    return song.themes?.includes(themeId) || false;
  }

  getThemeById(themeId: string): Theme | undefined {
    return this.themes.find(t => t.id === themeId);
  }

  getSortedThemes(themeIds: string[]): string[] {
    return themeIds
      .map(id => ({ id, name: this.getThemeById(id)?.name || '' }))
      .sort((a, b) => a.name.localeCompare(b.name))
      .map(item => item.id);
  }

  clearAllFilters(): void {
    this.selectedArtists.clear();
    this.selectedThemes.clear();
    this.minRating = 0;
    this.maxRating = 10;
    this.searchQuery = '';
    this.applyFilters();
  }

  toggleArtistsCollapse(): void {
    this.artistsCollapsed = !this.artistsCollapsed;
  }

  toggleThemesCollapse(): void {
    this.themesCollapsed = !this.themesCollapsed;
  }

  goToQuickRating(): void {
    this.router.navigate(['/rating'], {
      state: { songs: this.filteredSongs }
    });
  }

  goToExport(): void {
    this.router.navigate(['/export'], {
      state: { songs: this.filteredSongs }
    });
  }

  backToDashboard(): void {
    this.router.navigate(['/dashboard']);
  }

  async deleteSong(song: Song): Promise<void> {
    const confirmed = await this.modalService.confirm(
      'Delete Song',
      `Delete "${song.title}" by ${song.artist}? This will remove it from your library, including its rating and theme assignments.`,
      'Delete',
      'Cancel'
    );

    if (!confirmed) return;

    const userId = this.authService.currentUserValue?.id;
    if (!userId) return;

    this.storageService.deleteSong(userId, song.id);
    
    // Remove from local arrays
    this.allSongs = this.allSongs.filter(s => s.id !== song.id);
    this.applyFilters();
  }

  // Select mode methods
  toggleSelectMode(): void {
    this.selectMode = !this.selectMode;
    if (!this.selectMode) {
      this.selectedSongs.clear();
    }
  }

  toggleSongSelection(songId: string): void {
    if (this.selectedSongs.has(songId)) {
      this.selectedSongs.delete(songId);
    } else {
      this.selectedSongs.add(songId);
    }
  }

  selectAll(): void {
    this.filteredSongs.forEach(song => this.selectedSongs.add(song.id));
  }

  deselectAll(): void {
    this.selectedSongs.clear();
  }

  async bulkDelete(): Promise<void> {
    if (this.selectedSongs.size === 0) return;

    const confirmed = await this.modalService.confirm(
      'Delete Songs',
      `Delete ${this.selectedSongs.size} selected song(s)? This will remove them from your library, including ratings and theme assignments.`,
      'Delete',
      'Cancel'
    );

    if (!confirmed) return;

    const userId = this.authService.currentUserValue?.id;
    if (!userId) return;

    this.selectedSongs.forEach(songId => {
      this.storageService.deleteSong(userId, songId);
    });

    this.allSongs = this.allSongs.filter(s => !this.selectedSongs.has(s.id));
    this.selectedSongs.clear();
    this.applyFilters();
  }

  bulkRating: number = 5;
  showBulkRatingModal: boolean = false;

  openBulkRating(): void {
    if (this.selectedSongs.size === 0) return;
    this.bulkRating = 5;
    this.showBulkRatingModal = true;
  }

  async confirmBulkRate(): Promise<void> {
    const userId = this.authService.currentUserValue?.id;
    if (!userId) return;

    const confirmed = await this.modalService.confirm(
      'Confirm Bulk Rating',
      `Rate ${this.selectedSongs.size} song${this.selectedSongs.size > 1 ? 's' : ''} with ${this.bulkRating}/10?`
    );

    if (!confirmed) return;

    this.selectedSongs.forEach(songId => {
      const song = this.allSongs.find(s => s.id === songId);
      if (song) {
        this.storageService.saveRating(userId, songId, this.bulkRating);
        song.rating = this.bulkRating;
      }
    });

    this.showBulkRatingModal = false;
    this.applyFilters();
  }

  confirmBulkUnrate(): void {
    const userId = this.authService.currentUserValue?.id;
    if (!userId) return;

    this.selectedSongs.forEach(songId => {
      const song = this.allSongs.find(s => s.id === songId);
      if (song) {
        this.storageService.deleteRating(userId, songId);
        song.rating = undefined;
      }
    });

    this.showBulkRatingModal = false;
    this.applyFilters();
  }

  showBulkThemeModal: boolean = false;
  selectedBulkThemes: Set<string> = new Set();

  openBulkThemeAssignment(): void {
    if (this.selectedSongs.size === 0) return;
    this.selectedBulkThemes.clear();
    this.showBulkThemeModal = true;
  }

  toggleBulkTheme(themeId: string): void {
    if (this.selectedBulkThemes.has(themeId)) {
      this.selectedBulkThemes.delete(themeId);
    } else {
      this.selectedBulkThemes.add(themeId);
    }
  }

  confirmBulkThemeAssignment(): void {
    if (this.selectedBulkThemes.size === 0) return;
    
    const userId = this.authService.currentUserValue?.id;
    if (!userId) return;

    this.selectedSongs.forEach(songId => {
      const song = this.allSongs.find(s => s.id === songId);
      if (song) {
        const currentThemes = song.themes || [];
        const newThemes = [...currentThemes];
        
        this.selectedBulkThemes.forEach(themeId => {
          if (!newThemes.includes(themeId)) {
            this.storageService.assignThemeToSong(userId, songId, themeId);
            newThemes.push(themeId);
          }
        });
        
        song.themes = newThemes;
      }
    });

    this.showBulkThemeModal = false;
    this.selectedBulkThemes.clear();
    this.applyFilters();
  }
}

