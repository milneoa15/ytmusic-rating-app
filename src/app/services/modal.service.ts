import { Injectable } from '@angular/core';
import { Subject, Observable } from 'rxjs';

export interface ModalConfig {
  title: string;
  message: string;
  confirmText?: string;
  cancelText?: string;
  type?: 'confirm' | 'alert';
}

export interface ModalResult {
  confirmed: boolean;
}

@Injectable({
  providedIn: 'root'
})
export class ModalService {
  private modalSubject = new Subject<ModalConfig>();
  private resultSubject = new Subject<ModalResult>();

  modal$ = this.modalSubject.asObservable();
  result$ = this.resultSubject.asObservable();

  confirm(title: string, message: string, confirmText: string = 'Confirm', cancelText: string = 'Cancel'): Promise<boolean> {
    return new Promise((resolve) => {
      const config: ModalConfig = {
        title,
        message,
        confirmText,
        cancelText,
        type: 'confirm'
      };

      this.modalSubject.next(config);

      // Subscribe once to get the result
      const subscription = this.result$.subscribe(result => {
        subscription.unsubscribe();
        resolve(result.confirmed);
      });
    });
  }

  alert(title: string, message: string, confirmText: string = 'OK'): Promise<void> {
    return new Promise((resolve) => {
      const config: ModalConfig = {
        title,
        message,
        confirmText,
        type: 'alert'
      };

      this.modalSubject.next(config);

      // Subscribe once to get the result
      const subscription = this.result$.subscribe(() => {
        subscription.unsubscribe();
        resolve();
      });
    });
  }

  sendResult(confirmed: boolean): void {
    this.resultSubject.next({ confirmed });
  }
}
