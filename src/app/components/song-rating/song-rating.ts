import { Component, OnInit, ViewChild, ElementRef, AfterViewInit } from '@angular/core';
import { Router } from '@angular/router';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Song } from '../../models/song.model';
import { Playlist } from '../../models/playlist.model';
import { StorageService } from '../../services/storage.service';
import { AuthService } from '../../services/auth.service';
import { ModalService } from '../../services/modal.service';

interface Theme {
  id: string;
  name: string;
  color: string;
}

@Component({
  selector: 'app-song-rating',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './song-rating.html',
  styleUrl: './song-rating.scss'
})
export class SongRating implements OnInit, AfterViewInit {
  @ViewChild('themesContainer') themesContainer!: ElementRef;
  playlist: Playlist | null = null;
  songs: Song[] = [];
  currentIndex = 0;
  ratings: Map<string, number> = new Map();
  hoveredRating: number | null = null;
  sessionRatedCount: number = 0; // Track songs rated in this session only
  
  // Theme assignment
  themes: Theme[] = [];
  showThemeModal: boolean = false;
  songThemes: Map<string, string[]> = new Map(); // songId -> themeIds[]
  
  // Theme creation
  newThemeName: string = '';
  newThemeColor: string = '#c62828';
  editingTheme: Theme | null = null;

  constructor(
    private router: Router,
    private storageService: StorageService,
    private authService: AuthService,
    private modalService: ModalService
  ) {
    const navigation = this.router.getCurrentNavigation();
    if (navigation?.extras?.state) {
      this.playlist = navigation.extras.state['playlist'];
      this.songs = navigation.extras.state['songs'];
    }
  }

  async ngOnInit(): Promise<void> {
    if (!this.songs || this.songs.length === 0) {
      this.router.navigate(['/import']);
      return;
    }

    // Load themes
    const userId = this.authService.currentUserValue?.id;
    if (userId) {
      this.themes = this.storageService.getThemes(userId);
      
      // Filter to only show unrated songs
      this.songs = this.songs.filter(song => {
        const existingRating = this.storageService.getRating(userId, song.id);
        if (existingRating) {
          this.ratings.set(song.id, existingRating.rating);
          return false; // Exclude already rated songs
        }
        return true; // Include unrated songs
      });
      
      // Load existing theme assignments
      this.songs.forEach(song => {
        const themes = this.storageService.getSongThemes(userId, song.id);
        this.songThemes.set(song.id, themes);
      });
    }

    // If all songs are already rated, go back to library
    if (this.songs.length === 0) {
      await this.modalService.alert('All Rated', 'All songs are already rated!');
      this.router.navigate(['/library']);
      return;
    }
  }

  ngAfterViewInit(): void {
    // Add horizontal scroll on mouse wheel for themes container
    if (this.themesContainer) {
      const container = this.themesContainer.nativeElement;
      container.addEventListener('wheel', (e: WheelEvent) => {
        if (e.deltaY !== 0) {
          e.preventDefault();
          container.scrollLeft += e.deltaY;
        }
      });
    }
  }

  get currentSong(): Song | null {
    return this.songs[this.currentIndex] || null;
  }

  get progress(): number {
    return this.songs.length > 0 ? ((this.currentIndex + 1) / this.songs.length) * 100 : 0;
  }

  get currentRating(): number | null {
    return this.currentSong ? this.ratings.get(this.currentSong.id) || null : null;
  }

  rateSong(rating: number): void {
    if (!this.currentSong) return;

    const userId = this.authService.currentUserValue?.id;
    if (!userId) return;

    // Only increment if this song wasn't already rated in this session
    if (!this.ratings.has(this.currentSong.id)) {
      this.sessionRatedCount++;
    }

    this.ratings.set(this.currentSong.id, rating);
    this.storageService.saveRating(userId, this.currentSong.id, rating);
    
    // Auto-advance to next song
    this.nextSong();
  }

  previousSong(): void {
    if (this.currentIndex > 0) {
      this.currentIndex--;
    }
  }

  nextSong(): void {
    if (this.currentIndex < this.songs.length - 1) {
      this.currentIndex++;
    }
  }
  
  backToDashboard(): void {
    this.router.navigate(['/dashboard']);
  }

  skipSong(): void {
    this.nextSong();
  }

  finishRating(): void {
    this.router.navigate(['/library']);
  }

  getRatingLabel(rating: number): string {
    const labels: { [key: number]: string } = {
      1: 'Terrible',
      2: 'Very Bad',
      3: 'Bad',
      4: 'Poor',
      5: 'Below Average',
      6: 'Average',
      7: 'Good',
      8: 'Very Good',
      9: 'Excellent',
      10: 'Masterpiece'
    };
    return labels[rating] || '';
  }

  get ratedCount(): number {
    return this.sessionRatedCount;
  }

  setHoveredRating(rating: number | null): void {
    this.hoveredRating = rating;
  }

  openThemeModal(): void {
    this.newThemeName = '';
    this.newThemeColor = '#c62828';
    this.editingTheme = null;
    this.showThemeModal = true;
  }

  closeThemeModal(): void {
    this.showThemeModal = false;
    this.newThemeName = '';
    this.editingTheme = null;
  }

  saveTheme(): void {
    if (!this.newThemeName.trim()) return;
    
    const userId = this.authService.currentUserValue?.id;
    if (!userId) return;

    if (this.editingTheme) {
      // Update existing theme
      this.storageService.updateTheme(
        userId, 
        this.editingTheme.id,
        this.newThemeName.trim(),
        this.newThemeColor
      );
    } else {
      // Create new theme
      this.storageService.createTheme(
        userId, 
        this.newThemeName.trim(),
        this.newThemeColor
      );
    }

    // Reload themes
    this.themes = this.storageService.getThemes(userId);
    this.closeThemeModal();
  }

  getSortedThemes(): Theme[] {
    // Sort themes: selected ones first, then alphabetically
    if (!this.currentSong) return this.themes.sort((a, b) => a.name.localeCompare(b.name));
    
    const currentThemeIds = this.songThemes.get(this.currentSong.id) || [];
    const selected = this.themes.filter(t => currentThemeIds.includes(t.id)).sort((a, b) => a.name.localeCompare(b.name));
    const unselected = this.themes.filter(t => !currentThemeIds.includes(t.id)).sort((a, b) => a.name.localeCompare(b.name));
    
    return [...selected, ...unselected];
  }

  isSongInTheme(themeId: string): boolean {
    if (!this.currentSong) return false;
    const themes = this.songThemes.get(this.currentSong.id) || [];
    return themes.includes(themeId);
  }

  toggleSongTheme(themeId: string): void {
    if (!this.currentSong) return;
    
    const userId = this.authService.currentUserValue?.id;
    if (!userId) return;

    const currentThemes = this.songThemes.get(this.currentSong.id) || [];
    
    if (currentThemes.includes(themeId)) {
      this.storageService.removeThemeFromSong(userId, this.currentSong.id, themeId);
      this.songThemes.set(
        this.currentSong.id, 
        currentThemes.filter(id => id !== themeId)
      );
    } else {
      this.storageService.assignThemeToSong(userId, this.currentSong.id, themeId);
      this.songThemes.set(
        this.currentSong.id, 
        [...currentThemes, themeId]
      );
    }
  }
}
