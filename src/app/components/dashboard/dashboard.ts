import { Component, OnInit } from '@angular/core';
import { Router } from '@angular/router';
import { CommonModule } from '@angular/common';
import { AuthService } from '../../services/auth.service';
import { StorageService } from '../../services/storage.service';
import { ModalService } from '../../services/modal.service';
import { MusicPlayerService } from '../../services/music-player.service';

@Component({
  selector: 'app-dashboard',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './dashboard.html',
  styleUrl: './dashboard.scss'
})
export class Dashboard implements OnInit {
  userName = '';
  totalRatings = 0;

  constructor(
    private router: Router,
    private authService: AuthService,
    private storageService: StorageService,
    private modalService: ModalService,
    private musicPlayerService: MusicPlayerService
  ) {}

  ngOnInit(): void {
    const user = this.authService.currentUserValue;
    if (!user) {
      this.router.navigate(['/login']);
      return;
    }

    this.userName = user.displayName;
    this.totalRatings = this.storageService.getAllRatings(user.id).length;
  }

  importPlaylists(): void {
    this.router.navigate(['/import']);
  }

  viewLibrary(): void {
    this.router.navigate(['/library']);
  }

  async quickRating(): Promise<void> {
    // Navigate to library first, then they can click quick rating from there
    // Or get all songs and pass to rating component
    const user = this.authService.currentUserValue;
    if (!user) return;
    
    const songs = this.storageService.getImportedSongs(user.id);
    if (songs.length === 0) {
      await this.modalService.alert('No Songs', 'Please import playlists first!');
      this.router.navigate(['/import']);
      return;
    }
    
    this.router.navigate(['/rating'], { state: { songs } });
  }

  managePlaylists(): void {
    this.router.navigate(['/playlists']);
  }

  logout(): void {
    // Close player before logging out
    this.musicPlayerService.closePlayer();
    this.authService.logout();
    this.router.navigate(['/login']);
  }
}
