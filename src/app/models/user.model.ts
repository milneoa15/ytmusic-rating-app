export interface User {
  id: string;
  email: string;
  displayName: string;
  youtubeAccessToken?: string;
  refreshToken?: string;
  tokenExpiry?: Date;
}
