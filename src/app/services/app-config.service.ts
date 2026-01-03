import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { firstValueFrom } from 'rxjs';

export interface AppConfig {
  googleClientId?: string;
  redirectUri?: string;
}

@Injectable({
  providedIn: 'root'
})
export class AppConfigService {
  private appConfig?: AppConfig;

  constructor(private http: HttpClient) {}

  async load() {
    try {
      this.appConfig = await firstValueFrom(this.http.get<AppConfig>('/api/config'));
      console.log('App config loaded:', this.appConfig);
    } catch (error) {
      console.error('FATAL: Could not load app configuration.', error);
      // In a real app, you might want to show a fatal error screen
    }
  }

  get config(): AppConfig | undefined {
    return this.appConfig;
  }

  get googleClientId(): string | undefined {
    return this.appConfig?.googleClientId;
  }

  get redirectUri(): string | undefined {
    return this.appConfig?.redirectUri;
  }
}
