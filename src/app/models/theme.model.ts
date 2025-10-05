export interface Theme {
  id: string;
  name: string;
  color: string; // Hex color for UI display
  userId: string;
  createdAt: Date;
}

export interface SongTheme {
  songId: string;
  themeId: string;
  userId: string;
  assignedAt: Date;
}
