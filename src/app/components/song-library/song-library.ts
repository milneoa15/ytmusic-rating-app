import { Component, OnInit, OnDestroy, ChangeDetectorRef } from '@angular/core';
import { Router } from '@angular/router';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Song, SongWithMetadata } from '../../models/song.model';
import { Theme } from '../../models/theme.model';
import { LocalPlaylist, PlaylistFilters } from '../../models/playlist.model';
import { StorageService } from '../../services/storage.service';
import { AuthService } from '../../services/auth.service';
import { ModalService } from '../../services/modal.service';
import { MusicPlayerService } from '../../services/music-player.service';
import { PlaylistSelector } from '../playlist-selector/playlist-selector';

type SortOption = 'title' | 'artist' | 'rating' | 'recent';
type CreatePlaylistMode = 'simple' | 'advanced';

@Component({
  selector: 'app-song-library',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './song-library.html',
  styleUrl: './song-library.scss',
  host: {
    '(document:click)': 'onDocumentClick($event)'
  }
})

export class SongLibrary implements OnInit, OnDestroy {
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

  // Playlist viewing
  showPlaylistViewerModal: boolean = false;
  playlists: LocalPlaylist[] = [];
  currentPlaylist: LocalPlaylist | null = null;

  // Shuffle preferences
  ratingBiasStrength: number = 0;
  readonly ratingBiasOptions = [
    { value: 0, label: 'Off (pure shuffle)', shortLabel: 'Off' },
    { value: 15, label: 'Gentle bias', shortLabel: 'Gentle' },
    { value: 35, label: 'Balanced bias', shortLabel: 'Balanced' },
    { value: 55, label: 'Bold bias', shortLabel: 'Bold' },
    { value: 75, label: 'Strong bias', shortLabel: 'Strong' },
    { value: 90, label: 'Intense bias', shortLabel: 'Intense' },
    { value: 100, label: 'Max bias', shortLabel: 'Max' }
  ];
  showRatingBiasDropdown: boolean = false;

  // Create playlist modal
  showCreatePlaylistModal: boolean = false;
  createMode: CreatePlaylistMode = 'simple';
  newPlaylistName: string = '';
  newPlaylistDescription: string = '';
  newPlaylistFilters: PlaylistFilters = {
    minRating: 0,
    maxRating: 10,
    includeUnrated: true,
    themeIds: [],
    themeFilterMode: 'any',
    artistIds: [],
    artistFilterMode: 'any'
  };

  // Edit playlist modal
  showEditPlaylistModal: boolean = false;
  editPlaylistFilters: PlaylistFilters = {
    minRating: 0,
    maxRating: 10,
    includeUnrated: true,
    themeIds: [],
    themeFilterMode: 'any',
    artistIds: [],
    artistFilterMode: 'any'
  };

  // Edit playlist name/description modal
  showEditPlaylistInfoModal: boolean = false;
  editPlaylistName: string = '';
  editPlaylistDescription: string = '';
  editPlaylistInfoTab: 'info' | 'filters' = 'info';

  constructor(
    private storageService: StorageService,
    private authService: AuthService,
    private router: Router,
    private cdr: ChangeDetectorRef,
    private modalService: ModalService,
    private musicPlayerService: MusicPlayerService
  ) {}

  // Back to top button
  showBackToTop: boolean = false;

  ngOnInit(): void {
    this.loadLibrary();

    // Add scroll listener for back-to-top button
    window.addEventListener('scroll', this.handleScroll.bind(this));
  }

  ngOnDestroy(): void {
    // Restore body overflow when component is destroyed (in case a modal was open)
    document.body.style.overflow = '';

    // Remove scroll listener
    window.removeEventListener('scroll', this.handleScroll.bind(this));
  }

  handleScroll(): void {
    this.showBackToTop = window.scrollY > 300;
  }

  scrollToTop(): void {
    window.scrollTo({
      top: 0,
      behavior: 'smooth'
    });
  }

  // Playback controls
  playSong(song: SongWithMetadata): void {
    if (this.selectMode) return;

    if (song.videoAvailabilityStatus === 'unavailable') {
      const reason = song.videoUnavailableReason
        ? `\nReason: ${song.videoUnavailableReason}`
        : '';
      void this.modalService.alert(
        'Video unavailable',
        `YouTube does not allow this song to play in the embedded player.${reason}`
      );
      return;
    }

    // Update the music player service with the new song and queue
    this.musicPlayerService.playSong(song, this.filteredSongs);
  }

  get playingSongId(): string | null {
    return this.musicPlayerService.currentState.currentSong?.id || null;
  }

  get miniPlayerVisible(): boolean {
    return this.musicPlayerService.currentState.miniPlayerVisible;
  }

  loadLibrary(): void {
    const userId = this.authService.currentUserValue?.id;
    if (!userId) {
      this.router.navigate(['/login']);
      return;
    }

    const run = async () => {
      await this.storageService.waitUntilReady();

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

      // Load playlists
      this.playlists = this.storageService.getLocalPlaylists(userId);

      // Apply filters
      this.applyFilters();
    };

    void run();
  }

  get uniqueArtists(): string[] {
    const artists = new Set(this.allSongs.map(s => s.artist));
    return Array.from(artists).sort();
  }

  get artistSongCounts(): Map<string, number> {
    const counts = new Map<string, number>();
    this.allSongs.forEach(song => {
      counts.set(song.artist, (counts.get(song.artist) || 0) + 1);
    });
    return counts;
  }

  getArtistSongCount(artist: string): number {
    return this.artistSongCounts.get(artist) || 0;
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
    // Start with all songs or playlist songs
    let songsToFilter = this.allSongs;

    // If viewing a specific playlist, start with only those songs
    if (this.currentPlaylist) {
      const playlistSongIds = new Set(this.currentPlaylist.songIds);
      songsToFilter = this.allSongs.filter(song => playlistSongIds.has(song.id));
    }

    this.filteredSongs = songsToFilter.filter(song => {
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

  shuffleSongs(): void {
    if (this.filteredSongs.length === 0) return;

    const biasStrength = Math.min(Math.max(this.ratingBiasStrength, 0), 100) / 100;
    const shuffled =
      biasStrength > 0
        ? this.createWeightedShuffle(this.filteredSongs, biasStrength)
        : this.createUniformShuffle(this.filteredSongs);

    const firstPlayable = shuffled.find(song => song.videoAvailabilityStatus !== 'unavailable');
    if (!firstPlayable) {
      void this.modalService.alert(
        'No playable songs',
        'Every song in this view is blocked from playback. Try importing alternate versions or clearing filters.'
      );
      return;
    }

    // Start playing the first playable song from the shuffled list
    this.musicPlayerService.playSong(firstPlayable, shuffled);
  }

  get ratingBiasLabel(): string {
    return (
      this.ratingBiasOptions.find(option => option.value === this.ratingBiasStrength)?.shortLabel ?? 'Custom'
    );
  }

  updateRatingBiasStrength(value: number | string): void {
    const parsed = typeof value === 'number' ? value : Number(value);
    if (Number.isNaN(parsed)) {
      return;
    }
    this.ratingBiasStrength = Math.min(Math.max(parsed, 0), 100);
  }

  toggleRatingBiasDropdown(event: Event): void {
    event.stopPropagation();
    this.showRatingBiasDropdown = !this.showRatingBiasDropdown;
  }

  closeRatingBiasDropdown(): void {
    this.showRatingBiasDropdown = false;
  }

  setRatingBiasStrength(value: number): void {
    this.updateRatingBiasStrength(value);
  }

  private createUniformShuffle(songs: SongWithMetadata[]): SongWithMetadata[] {
    const shuffled = [...songs];
    for (let i = shuffled.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
    }
    return shuffled;
  }

  private createWeightedShuffle(songs: SongWithMetadata[], biasStrength: number): SongWithMetadata[] {
    const pool = [...songs];
    const result: SongWithMetadata[] = [];

    while (pool.length > 0) {
      const weights = pool.map(song => this.calculateSongWeight(song, biasStrength));
      const totalWeight = weights.reduce((sum, weight) => sum + weight, 0);

      if (totalWeight <= 0) {
        result.push(...pool.splice(0));
        break;
      }

      let threshold = Math.random() * totalWeight;
      let selectedIndex = 0;

      for (let i = 0; i < pool.length; i++) {
        threshold -= weights[i];
        if (threshold <= 0) {
          selectedIndex = i;
          break;
        }
      }

      const [selectedSong] = pool.splice(selectedIndex, 1);
      result.push(selectedSong);
    }

    return result;
  }

  private calculateSongWeight(song: SongWithMetadata, biasStrength: number): number {
    const baselineWeight = 1;
    const ratingValue = song.rating ?? 1;
    const ratingWeight = Math.max(ratingValue, 1);
    return baselineWeight * (1 - biasStrength) + ratingWeight * biasStrength;
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
    document.body.style.overflow = 'hidden';
  }

  closeThemeModal(): void {
    this.showThemeModal = false;
    this.editingTheme = null;
    this.newThemeName = '';
    this.newThemeColor = '#c62828';
    document.body.style.overflow = '';
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
    document.body.style.overflow = 'hidden';
  }

  closeThemeAssignment(): void {
    this.assigningThemesForSong = null;
    document.body.style.overflow = '';
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

  goToPlaylists(): void {
    this.showPlaylistViewerModal = true;
    document.body.style.overflow = 'hidden';
  }

  goToImport(): void {
    if (this.showPlaylistViewerModal) {
      this.closePlaylistViewer();
    }
    this.router.navigate(['/export'], {
      state: { tab: 'import' }
    });
  }

  // Playlist Management
  closePlaylistViewer(): void {
    this.showPlaylistViewerModal = false;
    document.body.style.overflow = '';
  }

  viewPlaylist(playlist: LocalPlaylist): void {
    this.currentPlaylist = playlist;
    this.showPlaylistViewerModal = false;
    document.body.style.overflow = '';
    this.closeRatingBiasDropdown();
    this.applyFilters();
  }

  clearPlaylistView(): void {
    this.currentPlaylist = null;
    this.closeRatingBiasDropdown();
    this.applyFilters();
  }

  openCreatePlaylistModal(mode: CreatePlaylistMode = 'simple'): void {
    this.createMode = mode;
    this.newPlaylistName = '';
    this.newPlaylistDescription = '';
    this.newPlaylistFilters = {
      minRating: 0,
      maxRating: 10,
      includeUnrated: true,
      themeIds: [],
      themeFilterMode: 'any',
      artistIds: [],
      artistFilterMode: 'any'
    };
    this.showCreatePlaylistModal = true;
    this.showPlaylistViewerModal = false;
    document.body.style.overflow = 'hidden';
  }

  closeCreatePlaylistModal(): void {
    this.showCreatePlaylistModal = false;
    document.body.style.overflow = '';
  }

  togglePlaylistFilterTheme(themeId: string): void {
    const index = this.newPlaylistFilters.themeIds?.indexOf(themeId) ?? -1;
    if (index > -1) {
      this.newPlaylistFilters.themeIds?.splice(index, 1);
    } else {
      this.newPlaylistFilters.themeIds?.push(themeId);
    }
  }

  togglePlaylistFilterArtist(artist: string): void {
    const index = this.newPlaylistFilters.artistIds?.indexOf(artist) ?? -1;
    if (index > -1) {
      this.newPlaylistFilters.artistIds?.splice(index, 1);
    } else {
      this.newPlaylistFilters.artistIds?.push(artist);
    }
  }

  get createPlaylistFilteredSongs(): SongWithMetadata[] {
    if (this.createMode === 'simple') {
      return this.filteredSongs; // Use currently filtered songs
    }

    // Advanced mode - use filter criteria
    const filters = this.newPlaylistFilters;
    return this.allSongs.filter(song => {
      // Rating filter
      if (song.rating === undefined) {
        if (!filters.includeUnrated) return false;
      } else {
        if (filters.minRating && filters.minRating > 0 && song.rating < filters.minRating) return false;
        if (filters.maxRating && song.rating > filters.maxRating) return false;
      }

      // Theme filter
      if (filters.themeIds && filters.themeIds.length > 0) {
        const songThemes = song.themes || [];
        if (filters.themeFilterMode === 'any') {
          const hasAnyTheme = filters.themeIds.some(themeId => songThemes.includes(themeId));
          if (!hasAnyTheme) return false;
        } else {
          const hasAllThemes = filters.themeIds.every(themeId => songThemes.includes(themeId));
          if (!hasAllThemes) return false;
        }
      }

      // Artist filter
      if (filters.artistIds && filters.artistIds.length > 0) {
        if (filters.artistFilterMode === 'any') {
          const hasAnyArtist = filters.artistIds.includes(song.artist);
          if (!hasAnyArtist) return false;
        } else {
          // For 'all' mode, song must match all artists (which only makes sense if there's one artist)
          // In practice, a song has one artist, so 'all' mode means the song's artist must be in the list
          const hasAllArtists = filters.artistIds.includes(song.artist);
          if (!hasAllArtists) return false;
        }
      }

      return true;
    });
  }

  createPlaylist(): void {
    const userId = this.authService.currentUserValue?.id;
    if (!userId || !this.newPlaylistName.trim()) return;

    const songIds = this.createMode === 'simple' ? [] : this.createPlaylistFilteredSongs.map(s => s.id);

    // Only show error for advanced mode when no songs match
    if (this.createMode === 'advanced' && songIds.length === 0) {
      this.modalService.alert('Empty Playlist', 'No songs match the selected criteria.');
      return;
    }

    // Create playlist without storing filters (filters are just for selecting songs at creation time)
    const playlist = this.storageService.createLocalPlaylist(
      userId,
      this.newPlaylistName.trim(),
      this.newPlaylistDescription.trim() || undefined
    );

    if (songIds.length > 0) {
      this.storageService.addSongsToLocalPlaylist(userId, playlist.id, songIds);
    }

    this.loadLibrary();
    this.closeCreatePlaylistModal();

    const message = songIds.length > 0
      ? `Created playlist "${playlist.name}" with ${songIds.length} song${songIds.length > 1 ? 's' : ''}!`
      : `Created empty playlist "${playlist.name}"!`;
    this.modalService.alert('Success', message);
  }

  openEditPlaylistModal(): void {
    if (!this.currentPlaylist) return;
    // Reset filters when opening
    this.editPlaylistFilters = {
      minRating: 0,
      maxRating: 10,
      includeUnrated: true,
      themeIds: [],
      themeFilterMode: 'any',
      artistIds: [],
      artistFilterMode: 'any'
    };
    this.showEditPlaylistModal = true;
    document.body.style.overflow = 'hidden';
  }

  closeEditPlaylistModal(): void {
    this.showEditPlaylistModal = false;
    document.body.style.overflow = '';
  }

  toggleEditPlaylistFilterTheme(themeId: string): void {
    const index = this.editPlaylistFilters.themeIds?.indexOf(themeId) ?? -1;
    if (index > -1) {
      this.editPlaylistFilters.themeIds?.splice(index, 1);
    } else {
      this.editPlaylistFilters.themeIds?.push(themeId);
    }
  }

  toggleEditPlaylistFilterArtist(artist: string): void {
    const index = this.editPlaylistFilters.artistIds?.indexOf(artist) ?? -1;
    if (index > -1) {
      this.editPlaylistFilters.artistIds?.splice(index, 1);
    } else {
      this.editPlaylistFilters.artistIds?.push(artist);
    }
  }

  get editPlaylistFilteredSongs(): SongWithMetadata[] {
    const filters = this.editPlaylistFilters;
    return this.allSongs.filter(song => {
      // Rating filter
      if (song.rating === undefined) {
        if (!filters.includeUnrated) return false;
      } else {
        if (filters.minRating && filters.minRating > 0 && song.rating < filters.minRating) return false;
        if (filters.maxRating && song.rating > filters.maxRating) return false;
      }

      // Theme filter
      if (filters.themeIds && filters.themeIds.length > 0) {
        const songThemes = song.themes || [];
        if (filters.themeFilterMode === 'any') {
          const hasAnyTheme = filters.themeIds.some(themeId => songThemes.includes(themeId));
          if (!hasAnyTheme) return false;
        } else {
          const hasAllThemes = filters.themeIds.every(themeId => songThemes.includes(themeId));
          if (!hasAllThemes) return false;
        }
      }

      // Artist filter
      if (filters.artistIds && filters.artistIds.length > 0) {
        if (filters.artistFilterMode === 'any') {
          const hasAnyArtist = filters.artistIds.includes(song.artist);
          if (!hasAnyArtist) return false;
        } else {
          // For 'all' mode, song must match all artists (which only makes sense if there's one artist)
          // In practice, a song has one artist, so 'all' mode means the song's artist must be in the list
          const hasAllArtists = filters.artistIds.includes(song.artist);
          if (!hasAllArtists) return false;
        }
      }

      return true;
    });
  }

  get editPlaylistNewSongsCount(): number {
    if (!this.currentPlaylist) return 0;
    const playlistSongIds = new Set(this.currentPlaylist.songIds);
    return this.editPlaylistFilteredSongs.filter(song => !playlistSongIds.has(song.id)).length;
  }

  async addFilteredSongsToPlaylist(): Promise<void> {
    if (!this.currentPlaylist) return;

    const userId = this.authService.currentUserValue?.id;
    if (!userId) return;

    // Get filtered songs from edit modal that aren't already in the playlist
    const playlistSongIds = new Set(this.currentPlaylist.songIds);
    const newSongs = this.editPlaylistFilteredSongs.filter(song => !playlistSongIds.has(song.id));

    if (newSongs.length === 0) {
      await this.modalService.alert('No New Songs', 'All filtered songs are already in this playlist or no songs match the filters.');
      return;
    }

    const confirmed = await this.modalService.confirm(
      'Add Songs',
      `Add ${newSongs.length} song${newSongs.length > 1 ? 's' : ''} to "${this.currentPlaylist.name}"?`
    );

    if (!confirmed) return;

    const newSongIds = newSongs.map(s => s.id);
    this.storageService.addSongsToLocalPlaylist(userId, this.currentPlaylist.id, newSongIds);

    // Reload playlist
    const updatedPlaylist = this.storageService.getLocalPlaylist(userId, this.currentPlaylist.id);
    if (updatedPlaylist) {
      this.currentPlaylist = updatedPlaylist;
    }

    this.loadLibrary();
    this.closeEditPlaylistModal();
    await this.modalService.alert('Success', `Added ${newSongs.length} song${newSongs.length > 1 ? 's' : ''} to the playlist!`);
  }

  async deletePlaylistFromViewer(playlist: LocalPlaylist): Promise<void> {
    const userId = this.authService.currentUserValue?.id;
    if (!userId) return;

    const confirmed = await this.modalService.confirm(
      'Delete Playlist',
      `Delete playlist "${playlist.name}"? This will remove the playlist but not the songs from your library.`,
      'Delete',
      'Cancel'
    );

    if (!confirmed) return;

    this.storageService.deleteLocalPlaylist(userId, playlist.id);

    // If we're currently viewing this playlist, clear the view
    if (this.currentPlaylist?.id === playlist.id) {
      this.currentPlaylist = null;
    }

    this.loadLibrary();
  }

  togglePlaylistStar(playlist: LocalPlaylist): void {
    const userId = this.authService.currentUserValue?.id;
    if (!userId) return;

    this.storageService.togglePlaylistStarred(userId, playlist.id);
    this.loadLibrary();
  }

  goToExportPage(): void {
    this.router.navigate(['/playlists']);
  }

  logout(): void {
    this.authService.logout();
    this.router.navigate(['/login']);
  }

  async deleteSong(song: Song, event?: Event): Promise<void> {
    if (event) {
      event.stopPropagation();
    }
    const confirmed = await this.modalService.confirm(
      'Delete Song',
      `Delete "${song.title}" by ${song.artist}? This will remove it from your library, including its rating and theme assignments.`,
      'Delete',
      'Cancel'
    );

    if (!confirmed) return;

    const userId = this.authService.currentUserValue?.id;
    if (!userId) return;

    // Remove the song from all playlists that contain it
    const allPlaylists = this.storageService.getLocalPlaylists(userId);
    allPlaylists.forEach(playlist => {
      if (playlist.songIds.includes(song.id)) {
        this.storageService.removeSongFromLocalPlaylist(userId, playlist.id, song.id);
      }
    });

    // Delete the song from the library
    this.storageService.deleteSong(userId, song.id);
    
    // Remove from local arrays
    this.allSongs = this.allSongs.filter(s => s.id !== song.id);
    
    // Reload playlists to get updated counts
    this.playlists = this.storageService.getLocalPlaylists(userId);
    
    this.closeSongMenu();
    this.applyFilters();
  }

  async removeFromPlaylist(song: Song, event: Event): Promise<void> {
    event.stopPropagation();
    
    if (!this.currentPlaylist) return;
    
    const confirmed = await this.modalService.confirm(
      'Remove from Playlist',
      `Remove "${song.title}" by ${song.artist} from "${this.currentPlaylist.name}"?`,
      'Remove',
      'Cancel'
    );

    if (!confirmed) return;

    const userId = this.authService.currentUserValue?.id;
    if (!userId) return;

    // Update the playlist by removing the song
    const updatedSongIds = this.currentPlaylist.songIds.filter(id => id !== song.id);
    
    this.storageService.updateLocalPlaylist(userId, this.currentPlaylist.id, {
      songIds: updatedSongIds
    });
    
    // Update currentPlaylist reference
    const updatedPlaylist = this.storageService.getLocalPlaylist(userId, this.currentPlaylist.id);
    if (updatedPlaylist) {
      this.currentPlaylist = updatedPlaylist;
    }
    
    this.closeSongMenu();
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

    // Get all playlists once for efficiency
    const allPlaylists = this.storageService.getLocalPlaylists(userId);

    this.selectedSongs.forEach(songId => {
      // Remove the song from all playlists that contain it
      allPlaylists.forEach(playlist => {
        if (playlist.songIds.includes(songId)) {
          this.storageService.removeSongFromLocalPlaylist(userId, playlist.id, songId);
        }
      });
      
      // Delete the song from the library
      this.storageService.deleteSong(userId, songId);
    });

    this.allSongs = this.allSongs.filter(s => !this.selectedSongs.has(s.id));
    this.selectedSongs.clear();
    
    // Reload playlists to get updated counts
    this.playlists = this.storageService.getLocalPlaylists(userId);
    
    this.applyFilters();
  }

  bulkRating: number = 5;
  showBulkRatingModal: boolean = false;

  openBulkRating(): void {
    if (this.selectedSongs.size === 0) return;
    this.bulkRating = 5;
    this.showBulkRatingModal = true;
    document.body.style.overflow = 'hidden';
  }

  closeBulkRatingModal(): void {
    this.showBulkRatingModal = false;
    document.body.style.overflow = '';
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
    document.body.style.overflow = '';
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
    document.body.style.overflow = '';
    this.applyFilters();
  }

  showBulkThemeModal: boolean = false;
  selectedBulkThemes: Set<string> = new Set();

  openBulkThemeAssignment(): void {
    if (this.selectedSongs.size === 0) return;
    this.selectedBulkThemes.clear();
    this.showBulkThemeModal = true;
    document.body.style.overflow = 'hidden';
  }

  closeBulkThemeModal(): void {
    this.showBulkThemeModal = false;
    document.body.style.overflow = '';
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
    document.body.style.overflow = '';
    this.selectedBulkThemes.clear();
    this.applyFilters();
  }

  // 3-dots menu state
  openMenuForSong: string | null = null;

  toggleSongMenu(songId: string, event: Event): void {
    event.stopPropagation();
    this.openMenuForSong = this.openMenuForSong === songId ? null : songId;
  }

  closeSongMenu(): void {
    this.openMenuForSong = null;
  }

  onDocumentClick(event: Event): void {
    const target = event.target as HTMLElement;

    // Close song action menu when clicking anywhere outside
    if (this.openMenuForSong) {
      const menuContainer = target.closest('.song-menu-container');
      if (!menuContainer) {
        this.closeSongMenu();
      }
    }

    if (this.showRatingBiasDropdown) {
      const biasContainer = target.closest('.rating-bias-dropdown');
      if (!biasContainer) {
        this.closeRatingBiasDropdown();
      }
    }
  }

  addSongToQueue(song: SongWithMetadata, event: Event): void {
    event.stopPropagation();
    if (song.videoAvailabilityStatus === 'unavailable') {
      const reason = song.videoUnavailableReason ? `\nReason: ${song.videoUnavailableReason}` : '';
      void this.modalService.alert(
        'Cannot add to queue',
        `This song cannot be played in the embedded player.${reason}`
      );
      return;
    }
    this.musicPlayerService.addToQueue(song);
    this.closeSongMenu();
  }

  playSongNext(song: SongWithMetadata, event: Event): void {
    event.stopPropagation();
    if (song.videoAvailabilityStatus === 'unavailable') {
      const reason = song.videoUnavailableReason ? `\nReason: ${song.videoUnavailableReason}` : '';
      void this.modalService.alert(
        'Cannot play next',
        `This song cannot be played in the embedded player.${reason}`
      );
      return;
    }
    this.musicPlayerService.addToPlayNext(song);
    this.closeSongMenu();
  }

  // Add to playlist functionality
  async addSongToPlaylist(song: Song): Promise<void> {
    try {
      const playlists = await PlaylistSelector.show([song.id]);
      if (playlists.length > 0) {
        this.loadLibrary(); // Refresh to show updated playlist
        await this.modalService.alert(
          'Success',
          `Added "${song.title}" to ${playlists.length} playlist${playlists.length > 1 ? 's' : ''}`
        );
      }
    } catch {
      // User cancelled
    }
  }

  async addSelectedToPlaylist(): Promise<void> {
    if (this.selectedSongs.size === 0) return;

    try {
      const songIds = Array.from(this.selectedSongs);
      const playlists = await PlaylistSelector.show(songIds);
      if (playlists.length > 0) {
        this.loadLibrary(); // Refresh to show updated playlists
        await this.modalService.alert(
          'Success',
          `Added ${songIds.length} song${songIds.length > 1 ? 's' : ''} to ${playlists.length} playlist${playlists.length > 1 ? 's' : ''}`
        );
        this.selectedSongs.clear();
        this.selectMode = false;
      }
    } catch {
      // User cancelled
    }
  }

  // Edit playlist info (name & description)
  openEditPlaylistInfoModal(playlist: LocalPlaylist): void {
    this.currentPlaylist = playlist;
    this.editPlaylistName = playlist.name;
    this.editPlaylistDescription = playlist.description || '';
    this.editPlaylistInfoTab = 'info';
    // Initialize filters for the second tab
    this.editPlaylistFilters = {
      minRating: 0,
      maxRating: 10,
      includeUnrated: true,
      themeIds: [],
      themeFilterMode: 'any',
      artistIds: [],
      artistFilterMode: 'any'
    };
    this.showEditPlaylistInfoModal = true;
    document.body.style.overflow = 'hidden';
  }

  closeEditPlaylistInfoModal(): void {
    this.showEditPlaylistInfoModal = false;
    document.body.style.overflow = '';
  }

  async savePlaylistInfo(): Promise<void> {
    if (!this.currentPlaylist || !this.editPlaylistName.trim()) return;

    const userId = this.authService.currentUserValue?.id;
    if (!userId) return;

    this.storageService.updateLocalPlaylist(userId, this.currentPlaylist.id, {
      name: this.editPlaylistName.trim(),
      description: this.editPlaylistDescription.trim() || undefined
    });

    this.loadLibrary();
    this.closeEditPlaylistInfoModal();
    await this.modalService.alert('Success', 'Playlist updated successfully!');
  }
}

