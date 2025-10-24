import { Component, OnInit, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Subject, Subscription } from 'rxjs';
import { LocalPlaylist } from '../../models/playlist.model';
import { StorageService } from '../../services/storage.service';
import { AuthService } from '../../services/auth.service';

export interface PlaylistSelectorData {
  songIds: string[];
  resolve: (playlists: LocalPlaylist[]) => void;
  reject: () => void;
}

@Component({
  selector: 'app-playlist-selector',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './playlist-selector.html',
  styleUrl: './playlist-selector.scss'
})
export class PlaylistSelector implements OnInit, OnDestroy {
  isVisible = false;
  playlists: LocalPlaylist[] = [];
  selectedPlaylistIds: Set<string> = new Set();
  songIds: string[] = [];

  // For creating new playlist
  showCreateForm = false;
  newPlaylistName = '';

  private currentData: PlaylistSelectorData | null = null;
  private subscription: Subscription | null = null;

  // Static subject for showing the modal
  private static showSubject = new Subject<PlaylistSelectorData>();

  constructor(
    private storageService: StorageService,
    private authService: AuthService
  ) {}

  ngOnInit(): void {
    this.subscription = PlaylistSelector.showSubject.subscribe(data => {
      this.show(data);
    });
  }

  ngOnDestroy(): void {
    this.subscription?.unsubscribe();
  }

  static show(songIds: string[]): Promise<LocalPlaylist[]> {
    return new Promise((resolve, reject) => {
      this.showSubject.next({
        songIds,
        resolve,
        reject
      });
    });
  }

  private show(data: PlaylistSelectorData): void {
    this.currentData = data;
    this.songIds = data.songIds;
    this.loadPlaylists();
    this.isVisible = true;
    this.selectedPlaylistIds.clear();
    this.showCreateForm = false;
    this.newPlaylistName = '';
    // Prevent background scroll
    document.documentElement.style.overflow = 'hidden';
    document.body.style.overflow = 'hidden';
  }

  loadPlaylists(): void {
    const userId = this.authService.currentUserValue?.id;
    if (!userId) return;

    const run = async () => {
      await this.storageService.waitUntilReady();
      this.playlists = this.storageService.getLocalPlaylists(userId);
    };

    void run();
  }

  togglePlaylist(playlistId: string): void {
    if (this.selectedPlaylistIds.has(playlistId)) {
      this.selectedPlaylistIds.delete(playlistId);
    } else {
      this.selectedPlaylistIds.add(playlistId);
    }
  }

  toggleCreateForm(): void {
    this.showCreateForm = !this.showCreateForm;
    this.newPlaylistName = '';
  }

  createPlaylist(): void {
    const userId = this.authService.currentUserValue?.id;
    if (!userId || !this.newPlaylistName.trim()) return;

    const playlist = this.storageService.createLocalPlaylist(
      userId,
      this.newPlaylistName.trim()
    );

    // Add songs to the new playlist
    this.storageService.addSongsToLocalPlaylist(userId, playlist.id, this.songIds);

    this.loadPlaylists();
    this.selectedPlaylistIds.add(playlist.id);
    this.showCreateForm = false;
    this.newPlaylistName = '';
  }

  addToPlaylists(): void {
    const userId = this.authService.currentUserValue?.id;
    if (!userId || this.selectedPlaylistIds.size === 0) return;

    const selectedPlaylists: LocalPlaylist[] = [];

    this.selectedPlaylistIds.forEach(playlistId => {
      this.storageService.addSongsToLocalPlaylist(userId, playlistId, this.songIds);
      const playlist = this.storageService.getLocalPlaylist(userId, playlistId);
      if (playlist) {
        selectedPlaylists.push(playlist);
      }
    });

    if (this.currentData) {
      this.currentData.resolve(selectedPlaylists);
    }
    // Restore background scroll before closing
    document.documentElement.style.overflow = '';
    document.body.style.overflow = '';
    this.close();
  }

  close(): void {
    if (this.currentData) {
      this.currentData.reject();
    }
    this.isVisible = false;
    this.selectedPlaylistIds.clear();
    this.showCreateForm = false;
    this.newPlaylistName = '';
    // Restore background scroll
    document.documentElement.style.overflow = '';
    document.body.style.overflow = '';
  }
}
