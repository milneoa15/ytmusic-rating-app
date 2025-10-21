import { Routes } from '@angular/router';
import { Login } from './components/login/login';
import { SongLibrary } from './components/song-library/song-library';
import { SongRating } from './components/song-rating/song-rating';
import { PlaylistManager } from './components/playlist-manager/playlist-manager';

export const routes: Routes = [
  { path: '', redirectTo: '/login', pathMatch: 'full' },
  { path: 'login', component: Login },
  { path: 'auth/callback', component: Login }, // OAuth callback - will process and redirect to library
  { path: 'library', component: SongLibrary },
  { path: 'rating', component: SongRating },
  { path: 'export', component: PlaylistManager },
  { path: 'dashboard', redirectTo: '/library', pathMatch: 'full' }, // Redirect old dashboard route
  { path: 'playlists', redirectTo: '/export', pathMatch: 'full' }, // Redirect old playlists route
  { path: 'import', redirectTo: '/export', pathMatch: 'full' }, // Redirect old import route to export page
  { path: '**', redirectTo: '/login' }
];
