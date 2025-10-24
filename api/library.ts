import type { VercelRequest, VercelResponse } from '@vercel/node';
import { authenticateRequest } from './_lib/auth';
import { methodNotAllowed, sendJson } from './_lib/http';
import { getServiceSupabaseClient } from './_lib/supabaseClient';

type SongRow = {
  id: string;
  youtube_song_id: string | null;
  title: string | null;
  artist: string | null;
  album: string | null;
  duration_text: string | null;
  thumbnail_url: string | null;
} | null;

type UserSongRow = {
  song_id: string;
  rating: number | null;
  rated_at: string | null;
  imported_at: string | null;
  metadata: Record<string, any> | null;
  songs?: SongRow;
};

export default async function handler(req: VercelRequest, res: VercelResponse): Promise<void> {
  if (req.method !== 'GET') {
    methodNotAllowed(res, ['GET']);
    return;
  }

  try {
    const auth = await authenticateRequest(req);
    const supabase = getServiceSupabaseClient();

    const [userSongsResult, themesResult, songThemesResult, playlistsResult] = await Promise.all([
      supabase
        .from('user_songs')
        .select(
          `
            song_id,
            rating,
            rated_at,
            imported_at,
            metadata,
            songs (
              id,
              youtube_song_id,
              title,
              artist,
              album,
              duration_text,
              thumbnail_url
            )
          `
        )
        .eq('user_id', auth.userId),
      supabase
        .from('themes')
        .select('id, name, color, description, created_at, updated_at')
        .eq('user_id', auth.userId)
        .order('created_at', { ascending: true }),
      supabase
        .from('song_themes')
        .select('id, song_id, theme_id, created_at')
        .eq('user_id', auth.userId),
      supabase
        .from('playlists')
        .select(
          `
            id,
            name,
            description,
            filters,
            starred,
            created_at,
            updated_at,
            playlist_songs:playlist_songs(song_id, position)
          `
        )
        .eq('user_id', auth.userId)
        .order('created_at', { ascending: false })
    ]);

    if (userSongsResult.error) throw userSongsResult.error;
    if (themesResult.error) throw themesResult.error;
    if (songThemesResult.error) throw songThemesResult.error;
    if (playlistsResult.error) throw playlistsResult.error;

    const userSongs = (userSongsResult.data ?? []) as unknown as UserSongRow[];
    const songs = userSongs.map(entry => ({
      id: entry.songs?.id ?? entry.song_id,
      videoId: entry.songs?.youtube_song_id ?? undefined,
      title: entry.songs?.title ?? entry.metadata?.['title'] ?? 'Unknown title',
      artist: entry.songs?.artist ?? entry.metadata?.['artist'] ?? undefined,
      album: entry.songs?.album ?? entry.metadata?.['album'] ?? undefined,
      duration: entry.songs?.duration_text ?? entry.metadata?.['duration'] ?? undefined,
      thumbnailUrl: entry.songs?.thumbnail_url ?? entry.metadata?.['thumbnailUrl'] ?? undefined,
      importedAt: entry.imported_at
    }));

    const ratings = userSongs
      .filter(entry => typeof entry.rating === 'number')
      .map(entry => ({
        songId: entry.song_id,
        rating: entry.rating,
        ratedAt: entry.rated_at
      }));

    const themes =
      themesResult.data?.map(item => ({
        id: item.id,
        userId: auth.userId,
        name: item.name,
        color: item.color,
        description: item.description ?? undefined,
        createdAt: item.created_at,
        updatedAt: item.updated_at
      })) ?? [];

    const songThemes =
      songThemesResult.data?.map(item => ({
        id: item.id,
        userId: auth.userId,
        songId: item.song_id,
        themeId: item.theme_id,
        assignedAt: item.created_at
      })) ?? [];

    const playlists =
      playlistsResult.data?.map(item => ({
        id: item.id,
        userId: auth.userId,
        name: item.name,
        description: item.description ?? undefined,
        filters: item.filters ?? undefined,
        starred: item.starred ?? false,
        songIds:
          item.playlist_songs
            ?.sort((a: any, b: any) => (a.position ?? 0) - (b.position ?? 0))
            .map((entry: any) => entry.song_id) ?? [],
        createdAt: item.created_at,
        updatedAt: item.updated_at
      })) ?? [];

    sendJson(res, 200, {
      user: {
        id: auth.userId,
        youtubeChannelId: auth.youtubeChannelId,
        displayName: auth.displayName,
        email: auth.email
      },
      songs,
      ratings,
      themes,
      songThemes,
      playlists
    });
  } catch (error: any) {
    console.error('[api/library] error', error);
    res.status(500).json({ error: error.message ?? 'Unexpected error' });
  }
}
