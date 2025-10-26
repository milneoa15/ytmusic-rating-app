import { Injectable } from '@angular/core';
import { Observable, from, of, forkJoin } from 'rxjs';
import { map, catchError, switchMap, delay } from 'rxjs/operators';
import { Playlist } from '../models/playlist.model';
import { Song } from '../models/song.model';
import { AuthService } from './auth.service';

// YouTube API Response Interfaces
interface YouTubePlaylistResponse {
  items: Array<{
    id: string;
    snippet: {
      title: string;
      description: string;
      thumbnails: {
        default?: { url: string };
        medium?: { url: string };
        high?: { url: string };
      };
    };
    contentDetails: {
      itemCount: number;
    };
  }>;
  nextPageToken?: string;
}

interface YouTubePlaylistItemResponse {
  items: Array<{
    id: string;
    snippet: {
      title: string;
      description: string;
      videoOwnerChannelTitle?: string;
      thumbnails: {
        default?: { url: string };
        medium?: { url: string };
      };
      resourceId: {
        videoId: string;
      };
    };
    contentDetails?: {
      videoId: string;
    };
  }>;
  nextPageToken?: string;
}

interface YouTubeVideosResponse {
  items: Array<{
    id: string;
    status?: {
      uploadStatus?: string;
      privacyStatus?: string;
      embeddable?: boolean;
      rejectionReason?: string;
    };
    contentDetails?: {
      regionRestriction?: {
        blocked?: string[];
        allowed?: string[];
      };
    };
  }>;
}

interface YouTubeSearchResponse {
  items: Array<{
    id?: {
      videoId?: string;
    };
    snippet?: {
      title?: string;
      channelTitle?: string;
      thumbnails?: {
        default?: { url: string };
        medium?: { url: string };
        high?: { url: string };
      };
    };
  }>;
}

type VideoAvailabilityInfo = {
  playable: boolean;
  reason?: string;
};

@Injectable({
  providedIn: 'root'
})
export class YoutubeMusicService {
  private readonly API_BASE_URL = 'https://www.googleapis.com/youtube/v3';
  private readonly USE_MOCK_DATA = false; // Set to false when ready to use real API
  private readonly MAX_VIDEO_IDS_PER_REQUEST = 50;

  constructor(private authService: AuthService) {}

  /**
   * Get user's playlists from YouTube
   * GET https://www.googleapis.com/youtube/v3/playlists?part=snippet,contentDetails&mine=true
   */
  getUserPlaylists(): Observable<Playlist[]> {
    if (this.USE_MOCK_DATA) {
      return this.getMockPlaylists();
    }

    const accessToken = this.authService.currentUserValue?.youtubeAccessToken;
    if (!accessToken) {
      console.error('No access token available');
      return of([]);
    }

    const url = `${this.API_BASE_URL}/playlists?part=snippet,contentDetails&mine=true&maxResults=50`;
    
    return from(
      fetch(url, {
        headers: {
          'Authorization': `Bearer ${accessToken}`,
          'Accept': 'application/json'
        }
      })
    ).pipe(
      switchMap(response => {
        if (!response.ok) {
          throw new Error(`HTTP error! status: ${response.status}`);
        }
        return from(response.json() as Promise<YouTubePlaylistResponse>);
      }),
      map(data => this.transformPlaylistsResponse(data)),
      catchError(error => {
        console.error('Error fetching playlists:', error);
        return of([]);
      })
    );
  }

  /**
   * Get songs from a specific playlist
   * GET https://www.googleapis.com/youtube/v3/playlistItems?part=snippet,contentDetails&playlistId={playlistId}
   */
  getPlaylistSongs(playlistId: string): Observable<Song[]> {
    if (this.USE_MOCK_DATA) {
      return this.getMockSongs(playlistId);
    }

    const accessToken = this.authService.currentUserValue?.youtubeAccessToken;
    if (!accessToken) {
      console.error('No access token available');
      return of([]);
    }

    console.log(`🎵 Fetching all songs from playlist ${playlistId}...`);
    // Fetch all pages of songs
    return this.fetchAllPlaylistPages(playlistId, accessToken, []);
  }

  /**
   * Recursively fetch all pages of playlist items using pagination
   */
  private fetchAllPlaylistPages(
    playlistId: string, 
    accessToken: string, 
    allSongs: Song[], 
    pageToken?: string
  ): Observable<Song[]> {
    // Build URL with pagination token if available
    let url = `${this.API_BASE_URL}/playlistItems?part=snippet,contentDetails&playlistId=${playlistId}&maxResults=50`;
    if (pageToken) {
      url += `&pageToken=${pageToken}`;
    }
    
    return from(
      fetch(url, {
        headers: {
          'Authorization': `Bearer ${accessToken}`,
          'Accept': 'application/json'
        }
      })
    ).pipe(
      switchMap(response => {
        if (!response.ok) {
          throw new Error(`HTTP error! status: ${response.status}`);
        }
        return from(response.json() as Promise<YouTubePlaylistItemResponse>);
      }),
      switchMap(data => {
        // Transform the current page of songs
        const currentPageSongs = this.transformPlaylistItemsResponse(data, playlistId);
        const combinedSongs = [...allSongs, ...currentPageSongs];
        
        console.log(`Fetched ${currentPageSongs.length} songs (Total so far: ${combinedSongs.length})`);
        
        // Check if there are more pages
        if (data.nextPageToken) {
          console.log(`➡️ Fetching next page...`);
          // Recursively fetch the next page
          return this.fetchAllPlaylistPages(playlistId, accessToken, combinedSongs, data.nextPageToken);
        } else {
          // No more pages, return all songs
          console.log(`✅ Finished! Total songs fetched: ${combinedSongs.length}`);
          return from(this.ensureSongsPlayable(combinedSongs, accessToken));
        }
      }),
      catchError(error => {
        console.error('Error fetching playlist items:', error);
        // Return whatever songs we've fetched so far
        return of(allSongs);
      })
    );
  }

  private async ensureSongsPlayable(songs: Song[], accessToken: string): Promise<Song[]> {
    if (songs.length === 0) {
      return [];
    }

    const nowIso = new Date().toISOString();

    try {
      const idsToCheck = songs
        .map(song => song.originalVideoId || song.videoId)
        .filter((id): id is string => typeof id === 'string' && id.length > 0);

      const availabilityMap = await this.fetchVideoAvailabilityMap(idsToCheck, accessToken);
      const processed: Song[] = [];

      for (const song of songs) {
        const originalId = song.originalVideoId && song.originalVideoId.length > 0
          ? song.originalVideoId
          : song.videoId;
        const availability = originalId ? availabilityMap.get(originalId) : undefined;

        const baseSong: Song = {
          ...song,
          originalVideoId: originalId || undefined,
          videoCheckedAt: nowIso
        };

        if (!originalId) {
          processed.push({
            ...baseSong,
            videoId: '',
            videoAvailabilityStatus: 'unavailable',
            videoUnavailableReason: 'Missing video identifier'
          });
          continue;
        }

        if (!availability || availability.playable) {
          processed.push({
            ...baseSong,
            videoAvailabilityStatus: 'playable',
            videoUnavailableReason: undefined
          });
          continue;
        }

        const fallback = await this.searchFallbackVideo(baseSong, accessToken, new Set([originalId]));
        if (fallback) {
          processed.push({
            ...baseSong,
            videoId: fallback.videoId,
            fallbackVideoId: fallback.videoId,
            thumbnailUrl: baseSong.thumbnailUrl ?? fallback.thumbnailUrl,
            videoAvailabilityStatus: 'fallback',
            videoUnavailableReason: availability.reason
          });
        } else {
          processed.push({
            ...baseSong,
            videoId: originalId,
            videoAvailabilityStatus: 'unavailable',
            videoUnavailableReason: availability.reason
          });
        }
      }

      return processed;
    } catch (error) {
      console.error('Failed to verify song availability', error);
      return songs.map(song => ({
        ...song,
        originalVideoId: song.originalVideoId || song.videoId || undefined
      }));
    }
  }

  private async fetchVideoAvailabilityMap(videoIds: string[], accessToken: string): Promise<Map<string, VideoAvailabilityInfo>> {
    const uniqueIds = Array.from(new Set(videoIds.filter(id => typeof id === 'string' && id.length > 0)));
    const availabilityMap = new Map<string, VideoAvailabilityInfo>();

    if (uniqueIds.length === 0) {
      return availabilityMap;
    }

    const batches = this.chunkArray(uniqueIds, this.MAX_VIDEO_IDS_PER_REQUEST);

    for (const batch of batches) {
      const url = `${this.API_BASE_URL}/videos?part=contentDetails,status&id=${batch.join(',')}`;

      try {
        const response = await fetch(url, {
          headers: {
            'Authorization': `Bearer ${accessToken}`,
            'Accept': 'application/json'
          }
        });

        if (!response.ok) {
          const message = await response.text().catch(() => '');
          console.warn(`Unable to fetch video availability (${response.status}): ${message}`);
          continue;
        }

        const data = (await response.json()) as YouTubeVideosResponse;
        const returnedIds = new Set<string>();

        data.items?.forEach(item => {
          if (!item?.id) {
            return;
          }
          returnedIds.add(item.id);
          availabilityMap.set(item.id, this.interpretVideoAvailability(item));
        });

        batch.forEach(id => {
          if (!availabilityMap.has(id)) {
            availabilityMap.set(id, { playable: false, reason: 'Video not found or removed' });
          }
        });
      } catch (error) {
        console.error('Error checking video availability', error);
      }
    }

    return availabilityMap;
  }

  private interpretVideoAvailability(item: YouTubeVideosResponse['items'][number]): VideoAvailabilityInfo {
    const status = item.status ?? {};
    const contentDetails = item.contentDetails ?? {};

    if (status.embeddable === false) {
      return { playable: false, reason: 'Embedding disabled by video owner' };
    }

    if (status.privacyStatus === 'private') {
      return { playable: false, reason: 'Video is private' };
    }

    if (status.uploadStatus && status.uploadStatus !== 'processed') {
      return { playable: false, reason: `Upload status: ${status.uploadStatus}` };
    }

    if (status.rejectionReason) {
      return { playable: false, reason: `Rejected: ${status.rejectionReason}` };
    }

    const blockedRegions = contentDetails.regionRestriction?.blocked;
    if (Array.isArray(blockedRegions) && blockedRegions.length > 0) {
      return { playable: false, reason: 'Region restricted' };
    }

    return { playable: true };
  }

  private async searchFallbackVideo(
    song: Song,
    accessToken: string,
    skipIds: Set<string>
  ): Promise<{ videoId: string; thumbnailUrl?: string } | null> {
    const queryParts = [song.title, song.artist].filter(part => typeof part === 'string' && part.trim().length > 0);
    if (queryParts.length === 0) {
      return null;
    }

    const query = encodeURIComponent(queryParts.join(' - '));
    const url = `${this.API_BASE_URL}/search?part=snippet&type=video&videoCategoryId=10&maxResults=5&q=${query}`;

    try {
      const response = await fetch(url, {
        headers: {
          'Authorization': `Bearer ${accessToken}`,
          'Accept': 'application/json'
        }
      });

      if (!response.ok) {
        const message = await response.text().catch(() => '');
        console.warn(`YouTube search failed (${response.status}): ${message}`);
        return null;
      }

      const data = (await response.json()) as YouTubeSearchResponse;
      const candidates = (data.items ?? [])
        .map(item => ({
          videoId: item.id?.videoId ?? '',
          thumbnailUrl: item.snippet?.thumbnails?.medium?.url || item.snippet?.thumbnails?.default?.url || undefined
        }))
        .filter(candidate => candidate.videoId.length > 0 && !skipIds.has(candidate.videoId));

      if (candidates.length === 0) {
        return null;
      }

      const availabilityMap = await this.fetchVideoAvailabilityMap(
        candidates.map(candidate => candidate.videoId),
        accessToken
      );

      for (const candidate of candidates) {
        const availability = availabilityMap.get(candidate.videoId);
        if (!availability || availability.playable) {
          return candidate;
        }
      }
    } catch (error) {
      console.error('Error searching for fallback video', error);
    }

    return null;
  }

  private chunkArray<T>(items: T[], size: number): T[][] {
    const result: T[][] = [];
    for (let index = 0; index < items.length; index += size) {
      result.push(items.slice(index, index + size));
    }
    return result;
  }

  /**
   * Create a new playlist
   * POST https://www.googleapis.com/youtube/v3/playlists?part=snippet,status
   */
  createPlaylist(name: string, description: string, songs: Song[]): Observable<Playlist> {
    if (this.USE_MOCK_DATA) {
      return this.getMockCreatedPlaylist(name, description, songs);
    }

    const accessToken = this.authService.currentUserValue?.youtubeAccessToken;
    if (!accessToken) {
      console.error('No access token available');
      return of({} as Playlist);
    }

    const url = `${this.API_BASE_URL}/playlists?part=snippet,status`;
    const body = {
      snippet: {
        title: name,
        description: description
      },
      status: {
        privacyStatus: 'private' // Can be 'public', 'private', or 'unlisted'
      }
    };

    return from(
      fetch(url, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${accessToken}`,
          'Accept': 'application/json',
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(body)
      })
    ).pipe(
      switchMap(response => {
        if (!response.ok) {
          throw new Error(`HTTP error! status: ${response.status}`);
        }
        return from(response.json());
      }),
      switchMap((playlist: any) => {
        // After creating playlist, add songs to it
        const playlistId = playlist.id;
        if (songs.length > 0) {
          return this.addSongsToPlaylist(playlistId, songs).pipe(
            map(() => ({
              id: playlistId,
              title: name,
              description: description,
              songCount: songs.length,
              songs: songs
            }))
          );
        }
        return of({
          id: playlistId,
          title: name,
          description: description,
          songCount: 0,
          songs: []
        });
      }),
      catchError(error => {
        console.error('Error creating playlist:', error);
        return of({} as Playlist);
      })
    );
  }

  /**
   * Add songs to a playlist
   * POST https://www.googleapis.com/youtube/v3/playlistItems?part=snippet
   */
  addSongsToPlaylist(playlistId: string, songs: Song[]): Observable<boolean> {
    if (this.USE_MOCK_DATA) {
      console.log(`Mock: Adding ${songs.length} songs to playlist ${playlistId}`);
      return of(true);
    }

    const accessToken = this.authService.currentUserValue?.youtubeAccessToken;
    if (!accessToken) {
      console.error('No access token available');
      return of(false);
    }

    console.log(`🎵 Adding ${songs.length} songs to playlist sequentially...`);
    
    // Add songs one at a time with a delay to avoid rate limiting and 409 conflicts
    return this.addSongsSequentially(playlistId, songs, accessToken, 0);
  }

  /**
   * Helper method to add songs sequentially with delay between requests
   */
  private addSongsSequentially(
    playlistId: string, 
    songs: Song[], 
    accessToken: string,
    successCount: number
  ): Observable<boolean> {
    if (songs.length === 0) {
      console.log(`✅ Successfully added ${successCount} songs to playlist`);
      return of(successCount > 0);
    }

    const song = songs[0];
    const remainingSongs = songs.slice(1);
    
    const url = `${this.API_BASE_URL}/playlistItems?part=snippet`;
    const body = {
      snippet: {
        playlistId: playlistId,
        resourceId: {
          kind: 'youtube#video',
          videoId: song.videoId
        }
      }
    };

    return from(
      fetch(url, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${accessToken}`,
          'Accept': 'application/json',
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(body)
      })
    ).pipe(
      switchMap(async response => {
        if (!response.ok) {
          const errorData = await response.json();
          console.warn(`⚠️ Failed to add "${song.title}": ${response.status} - ${errorData.error?.message || 'Unknown error'}`);
          // Continue with remaining songs even if one fails
          return { success: false, song };
        }
        console.log(`✓ Added "${song.title}"`);
        return { success: true, song };
      }),
      catchError(error => {
        console.error(`❌ Error adding "${song.title}":`, error);
        return of({ success: false, song });
      }),
      // Add a 200ms delay before next request to avoid rate limiting
      switchMap(result => {
        const newSuccessCount = successCount + (result.success ? 1 : 0);
        
        if (remainingSongs.length === 0) {
          return of(newSuccessCount > 0);
        }
        
        // Wait 200ms before adding next song
        return of(null).pipe(
          delay(200),
          switchMap(() => this.addSongsSequentially(playlistId, remainingSongs, accessToken, newSuccessCount))
        );
      })
    );
  }

  // Helper methods to transform API responses

  private transformPlaylistsResponse(response: YouTubePlaylistResponse): Playlist[] {
    return response.items.map(item => ({
      id: item.id,
      title: item.snippet.title,
      description: item.snippet.description,
      thumbnailUrl: item.snippet.thumbnails.medium?.url || 
                    item.snippet.thumbnails.default?.url || 
                    'https://via.placeholder.com/150',
      songCount: item.contentDetails.itemCount
    }));
  }

  private transformPlaylistItemsResponse(response: YouTubePlaylistItemResponse, playlistId: string): Song[] {
    return response.items.map((item, index) => {
      // Remove " - Topic" from artist names for display purposes
      let artistName = item.snippet.videoOwnerChannelTitle || 'Unknown Artist';
      if (artistName.endsWith(' - Topic')) {
        artistName = artistName.replace(/ - Topic$/, '');
      }
      const resolvedVideoId = item.snippet.resourceId?.videoId || item.contentDetails?.videoId || '';

      return {
        id: item.id,
        videoId: resolvedVideoId,
        originalVideoId: resolvedVideoId || undefined,
        videoAvailabilityStatus: resolvedVideoId ? 'playable' : 'unavailable',
        videoUnavailableReason: resolvedVideoId ? undefined : 'Missing video identifier',
        title: item.snippet.title,
        artist: artistName,
        album: '', // YouTube API doesn't provide album info directly
        duration: '', // Would need additional API call to get duration
        thumbnailUrl: item.snippet.thumbnails.medium?.url || 
                      item.snippet.thumbnails.default?.url || 
                      'https://via.placeholder.com/80',
        playlistId: playlistId
      };
    });
  }

  // Mock data methods for development

  private getMockPlaylists(): Observable<Playlist[]> {
    const mockPlaylists: Playlist[] = [
      {
        id: 'PLrAXtmErZgOeiKm4sgNOknGvNjby9efdf',
        title: 'My Favorites 2024',
        description: 'My favorite songs from 2024',
        songCount: 25,
        thumbnailUrl: 'https://i.ytimg.com/vi/dQw4w9WgXcQ/mqdefault.jpg'
      },
      {
        id: 'PLrAXtmErZgOdyH_Bmdo4G63JfSBWZZgeU',
        title: 'Workout Mix',
        description: 'High energy tracks for working out',
        songCount: 30,
        thumbnailUrl: 'https://i.ytimg.com/vi/kJQP7kiw5Fk/mqdefault.jpg'
      },
      {
        id: 'PLrAXtmErZgOcNCRbygNPDmYl8TDO9bEJv',
        title: 'Chill Vibes',
        description: 'Relaxing music for studying',
        songCount: 42,
        thumbnailUrl: 'https://i.ytimg.com/vi/jfKfPfyJRdk/mqdefault.jpg'
      },
      {
        id: 'PLrAXtmErZgOdSK_8KEbjLdbleUNa2d5bl',
        title: 'Party Playlist',
        description: 'Best party anthems',
        songCount: 50,
        thumbnailUrl: 'https://i.ytimg.com/vi/9bZkp7q19f0/mqdefault.jpg'
      }
    ];

    return of(mockPlaylists);
  }

  private getMockSongs(playlistId: string): Observable<Song[]> {
    const mockSongs: Song[] = [
      {
        id: `${playlistId}_1`,
        videoId: 'dQw4w9WgXcQ',
        title: 'Never Gonna Give You Up',
        artist: 'Rick Astley',
        album: 'Whenever You Need Somebody',
        duration: '3:33',
        thumbnailUrl: 'https://i.ytimg.com/vi/dQw4w9WgXcQ/mqdefault.jpg',
        playlistId: playlistId
      },
      {
        id: `${playlistId}_2`,
        videoId: 'kJQP7kiw5Fk',
        title: 'Luis Fonsi - Despacito ft. Daddy Yankee',
        artist: 'Luis Fonsi',
        album: 'VIDA',
        duration: '4:41',
        thumbnailUrl: 'https://i.ytimg.com/vi/kJQP7kiw5Fk/mqdefault.jpg',
        playlistId: playlistId
      },
      {
        id: `${playlistId}_3`,
        videoId: 'fJ9rUzIMcZQ',
        title: 'Queen – Bohemian Rhapsody',
        artist: 'Queen',
        album: 'A Night at the Opera',
        duration: '5:55',
        thumbnailUrl: 'https://i.ytimg.com/vi/fJ9rUzIMcZQ/mqdefault.jpg',
        playlistId: playlistId
      },
      {
        id: `${playlistId}_4`,
        videoId: '9bZkp7q19f0',
        title: 'PSY - GANGNAM STYLE',
        artist: 'officialpsy',
        album: '',
        duration: '4:13',
        thumbnailUrl: 'https://i.ytimg.com/vi/9bZkp7q19f0/mqdefault.jpg',
        playlistId: playlistId
      },
      {
        id: `${playlistId}_5`,
        videoId: 'JGwWNGJdvx8',
        title: 'Ed Sheeran - Shape of You',
        artist: 'Ed Sheeran',
        album: '÷ (Divide)',
        duration: '3:54',
        thumbnailUrl: 'https://i.ytimg.com/vi/JGwWNGJdvx8/mqdefault.jpg',
        playlistId: playlistId
      }
    ];

    return of(mockSongs);
  }

  private getMockCreatedPlaylist(name: string, description: string, songs: Song[]): Observable<Playlist> {
    const newPlaylist: Playlist = {
      id: 'PLmock_' + Date.now(),
      title: name,
      description: description,
      songCount: songs.length,
      songs: songs,
      thumbnailUrl: songs[0]?.thumbnailUrl || 'https://via.placeholder.com/150'
    };

    console.log('Mock: Created playlist:', newPlaylist);
    return of(newPlaylist);
  }
}
