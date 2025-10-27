import { Injectable } from '@angular/core';
import { BehaviorSubject, Observable } from 'rxjs';
import { SongWithMetadata } from '../models/song.model';

export interface PlayerState {
  queue: SongWithMetadata[];
  currentIndex: number;
  currentSong: SongWithMetadata | null;
  isPlaying: boolean;
  miniPlayerVisible: boolean;
}

@Injectable({
  providedIn: 'root'
})
export class MusicPlayerService {
  private readonly initialState: PlayerState = {
    queue: [],
    currentIndex: -1,
    currentSong: null,
    isPlaying: false,
    miniPlayerVisible: false
  };

  private stateSubject = new BehaviorSubject<PlayerState>(this.initialState);
  public state$: Observable<PlayerState> = this.stateSubject.asObservable();

  constructor() {}

  get currentState(): PlayerState {
    return this.stateSubject.value;
  }

  /**
   * Play a specific song and set up the queue from the current filtered list
   * @param song The song to play
   * @param allSongs All available songs in current view (for queue)
   */
  playSong(song: SongWithMetadata, allSongs: SongWithMetadata[]): void {
    const currentSongIndex = allSongs.findIndex(s => s.id === song.id);

    this.stateSubject.next({
      ...this.currentState,
      queue: [...allSongs], // Create a copy to prevent external changes from affecting the queue
      currentIndex: currentSongIndex,
      currentSong: song,
      miniPlayerVisible: true
    });
  }

  /**
   * Skip to the next song in the queue
   * Returns the next song or null if at the end
   */
  playNext(): SongWithMetadata | null {
    const state = this.currentState;

    for (let index = state.currentIndex + 1; index < state.queue.length; index++) {
      const candidate = state.queue[index];
      if (candidate.videoAvailabilityStatus === 'unavailable') {
        continue;
      }

      this.stateSubject.next({
        ...state,
        currentIndex: index,
        currentSong: candidate
      });

      return candidate;
    }

    return null;
  }

  /**
   * Skip to the previous song in the queue
   * Returns the previous song or null if at the beginning
   */
  playPrevious(): SongWithMetadata | null {
    const state = this.currentState;

    for (let index = state.currentIndex - 1; index >= 0; index--) {
      const candidate = state.queue[index];
      if (candidate.videoAvailabilityStatus === 'unavailable') {
        continue;
      }

      this.stateSubject.next({
        ...state,
        currentIndex: index,
        currentSong: candidate
      });

      return candidate;
    }

    return null;
  }

  /**
   * Play a specific song from the queue by index
   */
  playFromQueue(index: number): SongWithMetadata | null {
    const state = this.currentState;

    if (index >= 0 && index < state.queue.length) {
      if (state.queue[index].videoAvailabilityStatus !== 'unavailable') {
        const song = state.queue[index];

        this.stateSubject.next({
          ...state,
          currentIndex: index,
          currentSong: song
        });

        return song;
      }

      for (let forward = index + 1; forward < state.queue.length; forward++) {
        const candidate = state.queue[forward];
        if (candidate.videoAvailabilityStatus === 'unavailable') {
          continue;
        }

        this.stateSubject.next({
          ...state,
          currentIndex: forward,
          currentSong: candidate
        });

        return candidate;
      }

      for (let backward = index - 1; backward >= 0; backward--) {
        const candidate = state.queue[backward];
        if (candidate.videoAvailabilityStatus === 'unavailable') {
          continue;
        }

        this.stateSubject.next({
          ...state,
          currentIndex: backward,
          currentSong: candidate
        });

        return candidate;
      }
    }

    return null;
  }

  /**
   * Update playing state
   */
  setPlaying(isPlaying: boolean): void {
    this.stateSubject.next({
      ...this.currentState,
      isPlaying
    });
  }

  /**
   * Close the player and clear the queue
   */
  closePlayer(): void {
    this.stateSubject.next(this.initialState);
  }

  /**
   * Get the current queue
   */
  getQueue(): SongWithMetadata[] {
    return this.currentState.queue;
  }

  /**
   * Get the current song index
   */
  getCurrentIndex(): number {
    return this.currentState.currentIndex;
  }

  /**
   * Check if there's a next song
   */
  hasNext(): boolean {
    const state = this.currentState;
    for (let index = state.currentIndex + 1; index < state.queue.length; index++) {
      if (state.queue[index].videoAvailabilityStatus !== 'unavailable') {
        return true;
      }
    }
    return false;
  }

  /**
   * Check if there's a previous song
   */
  hasPrevious(): boolean {
    for (let index = this.currentState.currentIndex - 1; index >= 0; index--) {
      if (this.currentState.queue[index].videoAvailabilityStatus !== 'unavailable') {
        return true;
      }
    }
    return false;
  }

  /**
   * Remove a song from the queue
   */
  removeFromQueue(index: number): void {
    const state = this.currentState;
    const newQueue = [...state.queue];
    newQueue.splice(index, 1);

    let newIndex = state.currentIndex;

    // If we removed a song before the current one, adjust the index
    if (index < state.currentIndex) {
      newIndex--;
    }
    // If we removed the current song
    else if (index === state.currentIndex) {
      // If there are songs after, keep the same index (which now points to the next song)
      // If we're at the end, move back one
      if (newIndex >= newQueue.length) {
        newIndex = Math.max(0, newQueue.length - 1);
      }
    }

    this.stateSubject.next({
      ...state,
      queue: newQueue,
      currentIndex: newIndex,
      currentSong: newQueue.length > 0 ? newQueue[newIndex] : null
    });
  }

  /**
   * Reorder the queue by moving a song from one index to another
   */
  reorderQueue(fromIndex: number, toIndex: number): void {
    const state = this.currentState;
    const newQueue = [...state.queue];

    // Remove the song from its original position
    const [movedSong] = newQueue.splice(fromIndex, 1);

    // Insert it at the new position
    newQueue.splice(toIndex, 0, movedSong);

    // Adjust current index to track the currently playing song
    let newIndex = state.currentIndex;

    if (fromIndex === state.currentIndex) {
      // The currently playing song was moved
      newIndex = toIndex;
    } else if (fromIndex < state.currentIndex && toIndex >= state.currentIndex) {
      // Song moved from before to after current position
      newIndex--;
    } else if (fromIndex > state.currentIndex && toIndex <= state.currentIndex) {
      // Song moved from after to before current position
      newIndex++;
    }

    this.stateSubject.next({
      ...state,
      queue: newQueue,
      currentIndex: newIndex,
      currentSong: newQueue[newIndex]
    });
  }

  /**
   * Remove all songs after the specified index (cutoff the queue)
   */
  cutoffQueueAt(index: number): void {
    const state = this.currentState;

    // Keep songs from index 0 up to and including the specified index
    const newQueue = state.queue.slice(0, index + 1);

    // If the current song is beyond the cutoff point, adjust to the last song
    let newIndex = state.currentIndex;
    if (newIndex > index) {
      newIndex = index;
    }

    this.stateSubject.next({
      ...state,
      queue: newQueue,
      currentIndex: newIndex,
      currentSong: newQueue[newIndex]
    });
  }

  /**
   * Add a song to the end of the queue
   */
  addToQueue(song: SongWithMetadata): void {
    if (song.videoAvailabilityStatus === 'unavailable') {
      return;
    }

    const state = this.currentState;
    const newQueue = [...state.queue, song];

    this.stateSubject.next({
      ...state,
      queue: newQueue
    });
  }

  /**
   * Add a song to play next (right after the current song)
   */
  addToPlayNext(song: SongWithMetadata): void {
    if (song.videoAvailabilityStatus === 'unavailable') {
      return;
    }

    const state = this.currentState;
    const newQueue = [...state.queue];

    // Insert after the current song
    const insertIndex = state.currentIndex + 1;
    newQueue.splice(insertIndex, 0, song);

    this.stateSubject.next({
      ...state,
      queue: newQueue
    });
  }
}
