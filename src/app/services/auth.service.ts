import { Injectable } from '@angular/core';
import { Router } from '@angular/router';
import { BehaviorSubject, Observable } from 'rxjs';
import { User } from '../models/user.model';
import { environment } from '../../environments/environment';

@Injectable({
  providedIn: 'root'
})
export class AuthService {
  private currentUserSubject: BehaviorSubject<User | null>;
  public currentUser: Observable<User | null>;

  // OAuth 2.0 Configuration - now using environment variables
  private readonly CLIENT_ID = environment.googleClientId;
  private readonly CLIENT_SECRET = environment.googleClientSecret;
  private readonly REDIRECT_URI = environment.redirectUri;
  private readonly SCOPES = [
    'https://www.googleapis.com/auth/youtube',
    'https://www.googleapis.com/auth/youtube.force-ssl'
  ].join(' ');
  private readonly AUTH_ENDPOINT = 'https://accounts.google.com/o/oauth2/v2/auth';
  private readonly TOKEN_ENDPOINT = 'https://oauth2.googleapis.com/token';
  
  private readonly USE_MOCK_AUTH = false; // Set to false when ready to use real OAuth

  constructor(private router: Router) {
    const storedUser = localStorage.getItem('currentUser');
    this.currentUserSubject = new BehaviorSubject<User | null>(
      storedUser ? JSON.parse(storedUser) : null
    );
    this.currentUser = this.currentUserSubject.asObservable();
    
    // Check if we're returning from OAuth callback
    this.handleOAuthCallback();
  }

  public get currentUserValue(): User | null {
    return this.currentUserSubject.value;
  }

  public isAuthenticated(): boolean {
    return this.currentUserSubject.value !== null;
  }

  /**
   * Initiate YouTube OAuth 2.0 flow
   * This will redirect the user to Google's OAuth consent screen
   */
  async loginWithYouTube(): Promise<User> {
    if (this.USE_MOCK_AUTH) {
      return this.mockLogin();
    }

    // Generate random state for CSRF protection
    const state = this.generateRandomString(32);
    localStorage.setItem('oauth_state', state);

    // Build OAuth URL
    const params = new URLSearchParams({
      client_id: this.CLIENT_ID,
      redirect_uri: this.REDIRECT_URI,
      response_type: 'code',
      scope: this.SCOPES,
      state: state,
      access_type: 'offline', // To get refresh token
      prompt: 'consent' // Force consent screen to ensure refresh token
    });

    const authUrl = `${this.AUTH_ENDPOINT}?${params.toString()}`;
    
    // Redirect to Google OAuth
    window.location.href = authUrl;
    
    // This promise won't resolve because we're redirecting
    return new Promise(() => {});
  }

  /**
   * Handle OAuth callback after user grants permission
   * This is called automatically when user returns from Google OAuth
   */
  private handleOAuthCallback(): void {
    if (this.USE_MOCK_AUTH) return;

    const urlParams = new URLSearchParams(window.location.search);
    const code = urlParams.get('code');
    const state = urlParams.get('state');
    const storedState = localStorage.getItem('oauth_state');

    if (code && state === storedState) {
      localStorage.removeItem('oauth_state');
      this.exchangeCodeForToken(code);
    }
  }

  /**
   * Exchange authorization code for access token
   */
  private async exchangeCodeForToken(code: string): Promise<void> {
    console.log('🔄 Starting token exchange...');
    try {
      const response = await fetch(this.TOKEN_ENDPOINT, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
        },
        body: new URLSearchParams({
          code: code,
          client_id: this.CLIENT_ID,
          client_secret: this.CLIENT_SECRET,
          redirect_uri: this.REDIRECT_URI,
          grant_type: 'authorization_code'
        })
      });

      console.log('📡 Token response status:', response.status);

      if (!response.ok) {
        const errorData = await response.json();
        console.error('❌ Token exchange failed:', errorData);
        throw new Error(`Token exchange failed: ${errorData.error || 'Unknown error'}`);
      }

      const data = await response.json();
      console.log('✅ Token exchange successful!');
      await this.handleTokenResponse(data);
      
      // Clean up URL
      window.history.replaceState({}, document.title, window.location.pathname);
    } catch (error) {
      console.error('❌ Error exchanging code for token:', error);
      alert('Authentication failed. Please check the console for details.');
    }
  }

  /**
   * Handle the token response and fetch user info
   */
  private async handleTokenResponse(tokenData: any): Promise<void> {
    const accessToken = tokenData.access_token;
    const refreshToken = tokenData.refresh_token;
    const expiresIn = tokenData.expires_in;

    // Get user info from YouTube API
    const userInfo = await this.getUserInfo(accessToken);

    const user: User = {
      id: userInfo.id,
      email: userInfo.email,
      displayName: userInfo.name,
      youtubeAccessToken: accessToken,
      refreshToken: refreshToken,
      tokenExpiry: new Date(Date.now() + expiresIn * 1000)
    };

    localStorage.setItem('currentUser', JSON.stringify(user));
    this.currentUserSubject.next(user);
    
    // Navigate to dashboard after successful authentication
    this.router.navigate(['/dashboard']);
  }

  /**
   * Get user information from YouTube API
   */
  private async getUserInfo(accessToken: string): Promise<any> {
    try {
      const response = await fetch(
        'https://www.googleapis.com/youtube/v3/channels?part=snippet&mine=true',
        {
          headers: {
            'Authorization': `Bearer ${accessToken}`
          }
        }
      );

      if (!response.ok) {
        throw new Error('Failed to fetch user info');
      }

      const data = await response.json();
      const channel = data.items[0];

      return {
        id: channel.id,
        name: channel.snippet.title,
        email: channel.snippet.customUrl || 'user@youtube.com'
      };
    } catch (error) {
      console.error('Error fetching user info:', error);
      return {
        id: 'unknown',
        name: 'YouTube User',
        email: 'user@youtube.com'
      };
    }
  }

  /**
   * Refresh the access token using the refresh token
   */
  async refreshAccessToken(): Promise<boolean> {
    if (this.USE_MOCK_AUTH) return true;

    const user = this.currentUserValue;
    if (!user?.refreshToken) {
      console.error('No refresh token available');
      return false;
    }

    try {
      const response = await fetch(this.TOKEN_ENDPOINT, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
        },
        body: new URLSearchParams({
          client_id: this.CLIENT_ID,
          refresh_token: user.refreshToken,
          grant_type: 'refresh_token'
        })
      });

      if (!response.ok) {
        throw new Error('Token refresh failed');
      }

      const data = await response.json();
      this.updateUserTokens(
        data.access_token,
        user.refreshToken,
        new Date(Date.now() + data.expires_in * 1000)
      );

      return true;
    } catch (error) {
      console.error('Error refreshing token:', error);
      this.logout();
      return false;
    }
  }

  /**
   * Check if token is expired and refresh if needed
   */
  async ensureValidToken(): Promise<boolean> {
    if (this.USE_MOCK_AUTH) return true;

    const user = this.currentUserValue;
    if (!user?.tokenExpiry) return false;

    const now = new Date();
    const expiry = new Date(user.tokenExpiry);

    // Refresh if token expires in less than 5 minutes
    if (expiry.getTime() - now.getTime() < 5 * 60 * 1000) {
      return await this.refreshAccessToken();
    }

    return true;
  }

  logout(): void {
    localStorage.removeItem('currentUser');
    this.currentUserSubject.next(null);
  }

  updateUserTokens(accessToken: string, refreshToken: string, expiry: Date): void {
    const user = this.currentUserValue;
    if (user) {
      user.youtubeAccessToken = accessToken;
      user.refreshToken = refreshToken;
      user.tokenExpiry = expiry;
      localStorage.setItem('currentUser', JSON.stringify(user));
      this.currentUserSubject.next(user);
    }
  }

  // Mock authentication for development
  private async mockLogin(): Promise<User> {
    const mockUser: User = {
      id: 'UCmock_' + Date.now(),
      email: 'testuser@youtube.com',
      displayName: 'Test User',
      youtubeAccessToken: 'mock_access_token_' + Date.now(),
      refreshToken: 'mock_refresh_token',
      tokenExpiry: new Date(Date.now() + 3600000) // 1 hour from now
    };
    
    localStorage.setItem('currentUser', JSON.stringify(mockUser));
    this.currentUserSubject.next(mockUser);
    return mockUser;
  }

  // Generate random string for CSRF protection
  private generateRandomString(length: number): string {
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
    let result = '';
    for (let i = 0; i < length; i++) {
      result += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return result;
  }
}
