import { Component, OnInit, OnDestroy, ChangeDetectorRef, ViewChild, ElementRef, HostListener } from '@angular/core';
import { Router, NavigationStart } from '@angular/router';
import { RouterOutlet } from '@angular/router';
import { CommonModule } from '@angular/common';
import { Subscription, filter } from 'rxjs';
import { ConfirmationModal } from './components/confirmation-modal/confirmation-modal';
import { PlaylistSelector } from './components/playlist-selector/playlist-selector';
import { MusicPlayerService, PlayerState } from './services/music-player.service';
import { ModalService } from './services/modal.service';
import { SongWithMetadata } from './models/song.model';

declare const YT: any; // YouTube IFrame API global

@Component({
  selector: 'app-root',
  standalone: true,
  imports: [RouterOutlet, ConfirmationModal, PlaylistSelector, CommonModule],
  templateUrl: './app.html',
  styleUrl: './app.scss'
})
export class App implements OnInit, OnDestroy {
  title = 'YouTube Music Rating App';

  // Playback (YouTube IFrame API)
  playingSongId: string | null = null;
  currentSong: SongWithMetadata | null = null;
  miniPlayerVisible: boolean = false;
  private ytPlayer: any = null;
  private ytApiLoading = false;
  private ytApiLoaded = false;
  playerReady: boolean = false;
  currentTime: number = 0;
  duration: number = 0;
  private progressTimer: any;
  isPlaying: boolean = false;
  volume: number = 100; // Default volume at 100%

  // Queue management
  showQueue: boolean = false;
  showVolumeSlider: boolean = false;
  queueActionMenuIndex: number | null = null;
  private playerStateSubscription: Subscription | null = null;
  private navigationSubscription: Subscription | null = null;

  // Queue list reference for auto-scroll
  @ViewChild('queueList') queueList: ElementRef<HTMLElement> | undefined;
  @ViewChild('volumeControl') volumeControlRef: ElementRef<HTMLElement> | undefined;

  constructor(
    public musicPlayerService: MusicPlayerService,
    private cdr: ChangeDetectorRef,
    private router: Router,
    private modalService: ModalService
  ) {}

  ngOnInit(): void {
    // Subscribe to player state changes
    this.playerStateSubscription = this.musicPlayerService.state$.subscribe(
      (state: PlayerState) => {
        this.handlePlayerStateChange(state);
      }
    );

    // Intercept navigation to /rating route
    this.navigationSubscription = this.router.events
      .pipe(filter(event => event instanceof NavigationStart))
      .subscribe(async (event: any) => {
        if (event.url === '/rating' && this.miniPlayerVisible) {
          // Capture the navigation state before cancelling
          const navigation = this.router.getCurrentNavigation();
          const navigationState = navigation?.extras?.state;

          // Cancel navigation temporarily
          const currentUrl = this.router.url;
          this.router.navigateByUrl(currentUrl, { skipLocationChange: true });

          const confirmed = await this.modalService.confirm(
            'Close Player?',
            'Starting a quick rating session will close the current player and clear the queue. Continue?',
            'Continue',
            'Cancel'
          );

          if (confirmed) {
            await this.closePlayer(undefined, true);
            // Navigate with the preserved state
            this.router.navigate(['/rating'], { state: navigationState });
          }
        }
      });
  }

  private handlePlayerStateChange(state: PlayerState): void {
    // Load new video when song changes
    const songChanged = state.currentSong && state.currentSong.id !== this.playingSongId;

    if (state.currentSong) {
      this.playingSongId = state.currentSong.id;
      this.currentSong = state.currentSong;

      if (songChanged) {
        this.loadVideoInPlayer(state.currentSong.videoId);
      }
    } else {
      this.playingSongId = null;
      this.currentSong = null;
    }

    this.miniPlayerVisible = state.miniPlayerVisible;

    this.cdr.detectChanges();
  }

  private async loadVideoInPlayer(videoId: string): Promise<void> {
    this.playerReady = false;
    this.isPlaying = false;
    this.currentTime = 0;
    this.stopProgressTimer();

    await this.ensureYouTubeApi();

    if (this.ytPlayer) {
      try {
        this.ytPlayer.stopVideo();
      } catch {}
      this.ytPlayer.loadVideoById(videoId);
    } else {
      this.initPlayer(videoId);
    }
    this.cdr.detectChanges();
  }

  private ensureYouTubeApi(): Promise<void> {
    if (this.ytApiLoaded) return Promise.resolve();
    if (this.ytApiLoading) {
      return new Promise(resolve => {
        const check = () => {
          if (this.ytApiLoaded) { resolve(); } else { setTimeout(check, 50); }
        }; check();
      });
    }
    this.ytApiLoading = true;
    return new Promise(resolve => {
      const scriptId = 'youtube-iframe-api';
      if (document.getElementById(scriptId)) {
        this.ytApiLoaded = true; this.ytApiLoading = false; resolve(); return;
      }
      const tag = document.createElement('script');
      tag.id = scriptId;
      tag.src = 'https://www.youtube.com/iframe_api';
      (window as any).onYouTubeIframeAPIReady = () => {
        this.ytApiLoaded = true;
        this.ytApiLoading = false;
        resolve();
      };
      document.body.appendChild(tag);
    });
  }

  private initPlayer(videoId: string): void {
    const target = document.getElementById('yt-player');
    if (!target) {
      setTimeout(() => this.initPlayer(videoId), 0);
      return;
    }

    this.ytPlayer = new YT.Player(target, {
      width: '100%',
      height: '100%',
      videoId,
      playerVars: {
        autoplay: 1,
        rel: 0
      },
      events: {
        'onReady': () => {
          this.playerReady = true;
          this.duration = this.ytPlayer.getDuration() || 0;
          this.startProgressTimer();
          this.isPlaying = true;
        },
        'onStateChange': (event: any) => {
          if (event.data === 0) {
            this.stopProgressTimer();
            this.currentTime = this.duration;
            this.isPlaying = false;
            this.musicPlayerService.setPlaying(false);
            this.playNextSong();
          } else if (event.data === 1) {
            if (!this.playerReady) {
              this.playerReady = true;
            }
            this.startProgressTimer();
            this.duration = this.ytPlayer.getDuration() || this.duration;
            this.isPlaying = true;
            this.musicPlayerService.setPlaying(true);
          } else if (event.data === 2) {
            this.stopProgressTimer();
            this.isPlaying = false;
            this.musicPlayerService.setPlaying(false);
          }
        }
      }
    });
  }

  private startProgressTimer(): void {
    this.stopProgressTimer();
    this.progressTimer = setInterval(() => {
      if (this.ytPlayer && this.playerReady) {
        try {
          this.currentTime = this.ytPlayer.getCurrentTime() || 0;
          this.duration = this.ytPlayer.getDuration() || this.duration;
          this.cdr.detectChanges();
        } catch {}
      }
    }, 500);
  }

  private stopProgressTimer(): void {
    if (this.progressTimer) {
      clearInterval(this.progressTimer);
      this.progressTimer = null;
    }
  }

  onSeek(event: Event): void {
    if (!this.ytPlayer || !this.playerReady) return;
    const value = Number((event.target as HTMLInputElement).value);
    this.ytPlayer.seekTo(value, true);
    this.currentTime = value;
  }

  onVolumeChange(event: Event): void {
    if (!this.ytPlayer || !this.playerReady) return;
    const input = event.target as HTMLInputElement;
    const value = Number(input.value);
    this.volume = value;
    this.ytPlayer.setVolume(value);
  }

  toggleVolumeSlider(): void {
    this.showVolumeSlider = !this.showVolumeSlider;
  }

  @HostListener('document:mousedown', ['$event'])
  handleDocumentClick(event: MouseEvent): void {
    const target = event.target as Node | null;
    let shouldDetect = false;

    if (this.showVolumeSlider) {
      const host = this.volumeControlRef?.nativeElement;
      if (host && target && !host.contains(target)) {
        this.showVolumeSlider = false;
        shouldDetect = true;
      }
    }

    if (this.queueActionMenuIndex !== null) {
      const insideQueueActions = target instanceof HTMLElement ? target.closest('.queue-actions') : null;
      if (!insideQueueActions) {
        this.queueActionMenuIndex = null;
        shouldDetect = true;
      }
    }

    if (shouldDetect) {
      this.cdr.detectChanges();
    }
  }

  @HostListener('document:keydown.escape', ['$event'])
  handleEscapeKey(event: Event): void {
    const keyboardEvent = event as KeyboardEvent;
    let updated = false;

    if (this.queueActionMenuIndex !== null) {
      this.queueActionMenuIndex = null;
      updated = true;
    }

    if (this.showVolumeSlider) {
      this.showVolumeSlider = false;
      updated = true;
    }

    if (updated) {
      keyboardEvent.stopPropagation();
      this.cdr.detectChanges();
    }
  }

  togglePlayback(event?: Event): void {
    event?.stopPropagation();
    if (!this.ytPlayer || !this.playerReady) return;
    try {
      const state = this.ytPlayer.getPlayerState?.();
      if (state === 1) {
        this.ytPlayer.pauseVideo();
        this.stopProgressTimer();
        this.isPlaying = false;
      } else {
        this.ytPlayer.playVideo();
        this.startProgressTimer();
        this.isPlaying = true;
      }
    } catch {}
  }

  formatTime(sec: number): string {
    if (!sec || isNaN(sec)) return '0:00';
    const m = Math.floor(sec / 60);
    const s = Math.floor(sec % 60).toString().padStart(2, '0');
    return `${m}:${s}`;
  }

  async closePlayer(event?: Event, skipConfirm = false): Promise<void> {
    event?.stopPropagation();

    if (!skipConfirm) {
      const confirmed = await this.modalService.confirm(
        'Close player?',
        'Closing the player will stop playback and clear your queue. Continue?',
        'Close player',
        'Keep listening'
      );

      if (!confirmed) {
        return;
      }
    }

    this.finalizePlayerClose();
  }

  private finalizePlayerClose(): void {
    this.musicPlayerService.closePlayer();
    this.stopProgressTimer();
    try { this.ytPlayer?.stopVideo(); } catch {}
    try { this.ytPlayer?.destroy(); } catch {}
    this.ytPlayer = null;
    this.isPlaying = false;
    this.playerReady = false;
    this.currentTime = 0;
    this.duration = 0;
    this.showQueue = false;
  }

  async playNextSong(): Promise<void> {
    const nextSong = this.musicPlayerService.playNext();
    if (nextSong) {
      await this.loadVideoInPlayer(nextSong.videoId);
    }
  }

  async playPreviousSong(): Promise<void> {
    const prevSong = this.musicPlayerService.playPrevious();
    if (prevSong) {
      await this.loadVideoInPlayer(prevSong.videoId);
    }
  }

  async playFromQueue(index: number): Promise<void> {
    const song = this.musicPlayerService.playFromQueue(index);
    if (song) {
      await this.loadVideoInPlayer(song.videoId);
    }
  }

  toggleQueue(): void {
    this.showQueue = !this.showQueue;
    if (!this.showQueue) {
      this.queueActionMenuIndex = null;
    }
  }

  toggleQueueActionMenu(index: number, event: Event): void {
    event.stopPropagation();
    this.queueActionMenuIndex = this.queueActionMenuIndex === index ? null : index;
  }

  removeFromQueue(index: number, event?: Event): void {
    event?.stopPropagation();
    const currentIndex = this.musicPlayerService.getCurrentIndex();
    if (index === currentIndex) {
      return;
    }
    this.musicPlayerService.removeFromQueue(index);
    if (this.queueActionMenuIndex !== null) {
      this.queueActionMenuIndex = null;
    }
  }

  cutoffQueueAt(index: number, event: Event): void {
    event.stopPropagation();
    if (index >= this.musicPlayerService.getQueue().length - 1) {
      return;
    }
    this.musicPlayerService.cutoffQueueAt(index);
    if (this.queueActionMenuIndex !== null) {
      this.queueActionMenuIndex = null;
    }
  }

  // Drag and drop state
  draggedIndex: number | null = null;
  dragOverIndex: number | null = null;
  dropPosition: 'before' | 'after' = 'after';
  private autoScrollInterval: any = null;
  private globalDragOverHandler = (event: DragEvent) => {
    if (this.draggedIndex === null) {
      return;
    }

    event.preventDefault();
    if (event.dataTransfer) {
      event.dataTransfer.dropEffect = 'move';
    }
  };
  private globalDragEnterHandler = (event: DragEvent) => {
    if (this.draggedIndex === null) {
      return;
    }

    event.preventDefault();
    if (event.dataTransfer) {
      event.dataTransfer.dropEffect = 'move';
    }
  };
  private globalDropHandler = (event: DragEvent) => {
    if (this.draggedIndex === null) {
      return;
    }

    event.preventDefault();
    if (event.dataTransfer) {
      event.dataTransfer.dropEffect = 'move';
    }
  };

  onDragStart(event: DragEvent, index: number): void {
    if (this.queueActionMenuIndex !== null) {
      this.queueActionMenuIndex = null;
    }
    this.draggedIndex = index;
    document.body.classList.add('dragging-queue-item');
    document.addEventListener('dragover', this.globalDragOverHandler, true);
    document.addEventListener('dragenter', this.globalDragEnterHandler, true);
    document.addEventListener('drop', this.globalDropHandler, true);
    if (event.dataTransfer) {
      event.dataTransfer.effectAllowed = 'move';
      event.dataTransfer.setData('text/plain', index.toString());
    }
  }

  onDragEnd(event: DragEvent): void {
    this.draggedIndex = null;
    this.dragOverIndex = null;
    this.dropPosition = 'after';
    this.stopAutoScroll();
    document.body.classList.remove('dragging-queue-item');
    document.removeEventListener('dragover', this.globalDragOverHandler, true);
    document.removeEventListener('dragenter', this.globalDragEnterHandler, true);
    document.removeEventListener('drop', this.globalDropHandler, true);
  }

  onDragOver(event: DragEvent, index: number): void {
    event.preventDefault();
    if (event.dataTransfer) {
      event.dataTransfer.dropEffect = 'move';
    }

    // Calculate which half of the element the mouse is over
    const target = event.currentTarget as HTMLElement;
    const rect = target.getBoundingClientRect();
    const mouseY = event.clientY;
    const elementMiddle = rect.top + rect.height / 2;

    this.dragOverIndex = index;
    this.dropPosition = mouseY < elementMiddle ? 'before' : 'after';

    // Auto-scroll when dragging near top or bottom
    this.handleAutoScroll(event.clientY);
  }

  onDragLeave(event: DragEvent): void {
    // Only clear if we're actually leaving the element
    const relatedTarget = event.relatedTarget as HTMLElement;
    const currentTarget = event.currentTarget as HTMLElement;

    if (!currentTarget.contains(relatedTarget)) {
      this.dragOverIndex = null;
      this.dropPosition = 'after';
    }
  }

  onDrop(event: DragEvent, dropIndex: number): void {
    event.preventDefault();
    event.stopPropagation();
    document.body.classList.remove('dragging-queue-item');
    document.removeEventListener('dragover', this.globalDragOverHandler, true);
    document.removeEventListener('dragenter', this.globalDragEnterHandler, true);
    document.removeEventListener('drop', this.globalDropHandler, true);

    if (this.draggedIndex !== null) {
      let targetIndex = dropIndex;

      // Adjust target index based on drop position
      if (this.dropPosition === 'after') {
        targetIndex = dropIndex + 1;
      }

      // Adjust for dragging from before the drop target
      if (this.draggedIndex < targetIndex) {
        targetIndex--;
      }

      // Only reorder if we're actually moving to a different position
      if (this.draggedIndex !== targetIndex) {
        this.musicPlayerService.reorderQueue(this.draggedIndex, targetIndex);
      }
    }

    this.draggedIndex = null;
    this.dragOverIndex = null;
    this.dropPosition = 'after';
    this.stopAutoScroll();
  }

  private handleAutoScroll(clientY: number): void {
    if (!this.queueList) return;

    const container = this.queueList.nativeElement;
    const rect = container.getBoundingClientRect();
    const scrollZone = 60; // pixels from edge to trigger scroll
    const scrollSpeed = 10; // pixels per interval

    // Distance from top and bottom edges
    const distFromTop = clientY - rect.top;
    const distFromBottom = rect.bottom - clientY;

    // Clear existing interval
    this.stopAutoScroll();

    // Scroll up if near top
    if (distFromTop < scrollZone && distFromTop > 0) {
      this.autoScrollInterval = setInterval(() => {
        if (container.scrollTop > 0) {
          container.scrollTop -= scrollSpeed;
        } else {
          this.stopAutoScroll();
        }
      }, 50);
    }
    // Scroll down if near bottom
    else if (distFromBottom < scrollZone && distFromBottom > 0) {
      this.autoScrollInterval = setInterval(() => {
        if (container.scrollTop < container.scrollHeight - container.clientHeight) {
          container.scrollTop += scrollSpeed;
        } else {
          this.stopAutoScroll();
        }
      }, 50);
    }
  }

  private stopAutoScroll(): void {
    if (this.autoScrollInterval) {
      clearInterval(this.autoScrollInterval);
      this.autoScrollInterval = null;
    }
  }

  ngOnDestroy(): void {
    this.stopProgressTimer();
    this.stopAutoScroll();
    document.body.classList.remove('dragging-queue-item');
    document.removeEventListener('dragover', this.globalDragOverHandler, true);
    document.removeEventListener('dragenter', this.globalDragEnterHandler, true);
    document.removeEventListener('drop', this.globalDropHandler, true);
    try { this.ytPlayer?.destroy(); } catch {}
    this.playerStateSubscription?.unsubscribe();
    this.navigationSubscription?.unsubscribe();
  }
}
