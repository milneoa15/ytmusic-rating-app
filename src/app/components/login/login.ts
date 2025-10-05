import { Component } from '@angular/core';
import { Router } from '@angular/router';
import { CommonModule } from '@angular/common';
import { AuthService } from '../../services/auth.service';

@Component({
  selector: 'app-login',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './login.html',
  styleUrl: './login.scss'
})
export class Login {
  isLoading = false;
  errorMessage = '';

  constructor(
    private authService: AuthService,
    private router: Router
  ) {}

  async loginWithYouTube(): Promise<void> {
    this.isLoading = true;
    this.errorMessage = '';

    try {
      await this.authService.loginWithYouTube();
      this.router.navigate(['/dashboard']);
    } catch (error) {
      this.errorMessage = 'Failed to login with YouTube Music. Please try again.';
      console.error('Login error:', error);
    } finally {
      this.isLoading = false;
    }
  }
}
