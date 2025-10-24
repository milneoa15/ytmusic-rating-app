import { Injectable } from '@angular/core';
import { HttpClient, HttpHeaders } from '@angular/common/http';
import { firstValueFrom } from 'rxjs';
import { environment } from '../../environments/environment';
import { Song } from '../models/song.model';
import { Theme } from '../models/theme.model';
import { LocalPlaylist } from '../models/playlist.model';

export interface LibraryResponse {
  user: {
    id: string;
    youtubeChannelId: string;
    displayName: string;
    email?: string;
  };
  songs: Array<Song & { importedAt?: string }>;
  ratings: Array<{ songId: string; rating: number; ratedAt?: string }>;
  themes: Array<Theme>;
  songThemes: Array<{ id: string; songId: string; themeId: string }>;
  playlists: Array<LocalPlaylist>;
}

@Injectable({
  providedIn: 'root'
})
export class ApiService {
  private readonly baseUrl = environment.apiBaseUrl ?? '/api';

  constructor(private http: HttpClient) {}

  private authHeaders(accessToken: string): HttpHeaders {
    return new HttpHeaders({
      Authorization: `Bearer ${accessToken}`
    });
  }

  getLibrary(accessToken: string): Promise<LibraryResponse> {
    return firstValueFrom(
      this.http.get<LibraryResponse>(`${this.baseUrl}/library`, {
        headers: this.authHeaders(accessToken)
      })
    );
  }

  saveImportedSongs(accessToken: string, songs: Song[]): Promise<void> {
    return firstValueFrom(
      this.http.post<void>(
        `${this.baseUrl}/imported-songs`,
        { songs },
        { headers: this.authHeaders(accessToken) }
      )
    );
  }

  removeImportedSong(accessToken: string, songId: string): Promise<void> {
    return firstValueFrom(
      this.http.request<void>('delete', `${this.baseUrl}/imported-songs`, {
        headers: this.authHeaders(accessToken),
        body: { songId }
      })
    );
  }

  saveRating(accessToken: string, song: Song, rating: number): Promise<void> {
    return firstValueFrom(
      this.http.post<void>(
        `${this.baseUrl}/ratings`,
        { song, rating },
        { headers: this.authHeaders(accessToken) }
      )
    );
  }

  deleteRating(accessToken: string, songId: string): Promise<void> {
    return firstValueFrom(
      this.http.request<void>('delete', `${this.baseUrl}/ratings`, {
        headers: this.authHeaders(accessToken),
        body: { songId }
      })
    );
  }

  saveTheme(accessToken: string, theme: Partial<Theme>): Promise<Theme> {
    return firstValueFrom(
      this.http.post<{ theme: Theme }>(
        `${this.baseUrl}/themes`,
        { theme },
        { headers: this.authHeaders(accessToken) }
      )
    ).then(response => response.theme);
  }

  deleteTheme(accessToken: string, themeId: string): Promise<void> {
    return firstValueFrom(
      this.http.request<void>('delete', `${this.baseUrl}/themes`, {
        headers: this.authHeaders(accessToken),
        body: { themeId }
      })
    );
  }

  assignTheme(accessToken: string, songId: string, themeId: string): Promise<void> {
    return firstValueFrom(
      this.http.post<void>(
        `${this.baseUrl}/song-themes`,
        { songId, themeId },
        { headers: this.authHeaders(accessToken) }
      )
    );
  }

  removeTheme(accessToken: string, songId: string, themeId: string): Promise<void> {
    return firstValueFrom(
      this.http.request<void>('delete', `${this.baseUrl}/song-themes`, {
        headers: this.authHeaders(accessToken),
        body: { songId, themeId }
      })
    );
  }

  savePlaylist(accessToken: string, playlist: Partial<LocalPlaylist>): Promise<LocalPlaylist> {
    return firstValueFrom(
      this.http.post<{ playlist: LocalPlaylist }>(
        `${this.baseUrl}/playlists`,
        { playlist },
        { headers: this.authHeaders(accessToken) }
      )
    ).then(response => response.playlist);
  }

  deletePlaylist(accessToken: string, playlistId: string): Promise<void> {
    return firstValueFrom(
      this.http.request<void>('delete', `${this.baseUrl}/playlists`, {
        headers: this.authHeaders(accessToken),
        body: { playlistId }
      })
    );
  }
}
