export interface Category {
  id: string;
  name: string;
  color: string; // Hex color for UI display
  userId: string;
  createdAt: Date;
}

export interface SongCategory {
  songId: string;
  categoryId: string;
  userId: string;
  assignedAt: Date;
}
