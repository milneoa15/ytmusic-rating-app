import { Component } from '@angular/core';
import { RouterOutlet } from '@angular/router';
import { ConfirmationModal } from './components/confirmation-modal/confirmation-modal';

@Component({
  selector: 'app-root',
  standalone: true,
  imports: [RouterOutlet, ConfirmationModal],
  templateUrl: './app.html',
  styleUrl: './app.scss'
})
export class App {
  title = 'YouTube Music Rating App';
}
