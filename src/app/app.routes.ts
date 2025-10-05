import { Routes } from '@angular/router';
import { Login } from './components/login/login';
import { Dashboard } from './components/dashboard/dashboard';
import { PlaylistImport } from './components/playlist-import/playlist-import';
import { SongLibrary } from './components/song-library/song-library';
import { SongRating } from './components/song-rating/song-rating';
import { PlaylistExport } from './components/playlist-export/playlist-export';

export const routes: Routes = [
  { path: '', redirectTo: '/login', pathMatch: 'full' },
  { path: 'login', component: Login },
  { path: 'auth/callback', component: Login }, // OAuth callback - will process and redirect to dashboard
  { path: 'dashboard', component: Dashboard },
  { path: 'import', component: PlaylistImport },
  { path: 'library', component: SongLibrary },
  { path: 'rating', component: SongRating },
  { path: 'export', component: PlaylistExport },
  { path: '**', redirectTo: '/login' }
];
