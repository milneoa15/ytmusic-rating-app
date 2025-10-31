import { ChangeDetectorRef } from '@angular/core';
import { Router } from '@angular/router';
import { Subject } from 'rxjs';
import { App } from './app';
import { MusicPlayerService } from './services/music-player.service';
import { ModalService } from './services/modal.service';

describe('App closePlayer', () => {
  let component: App;
  let musicPlayerService: MusicPlayerService;
  let closePlayerSpy: jasmine.Spy;
  let modalService: jasmine.SpyObj<ModalService>;
  let changeDetector: jasmine.SpyObj<ChangeDetectorRef>;
  let router: jasmine.SpyObj<Router>;

  beforeEach(() => {
    musicPlayerService = new MusicPlayerService();
    closePlayerSpy = spyOn(musicPlayerService, 'closePlayer').and.callThrough();

    modalService = jasmine.createSpyObj<ModalService>('ModalService', ['confirm']);
    changeDetector = jasmine.createSpyObj<ChangeDetectorRef>('ChangeDetectorRef', ['detectChanges']);
    router = jasmine.createSpyObj<Router>(
      'Router',
      ['navigate', 'navigateByUrl', 'getCurrentNavigation'],
      { events: new Subject(), url: '/' }
    );

    component = new App(musicPlayerService, changeDetector, router, modalService);
  });

  it('should confirm with the user before destroying the player', async () => {
    modalService.confirm.and.returnValue(Promise.resolve(true));
    const ytPlayerMock = {
      stopVideo: jasmine.createSpy('stopVideo'),
      destroy: jasmine.createSpy('destroy')
    };
    (component as any).ytPlayer = ytPlayerMock;
    component.showQueue = true;
    component.isPlaying = true;
    component.playerReady = true;

    await component.closePlayer();

    expect(modalService.confirm).toHaveBeenCalledWith(
      'Close player?',
      'Closing the player will stop playback and clear your queue. Continue?',
      'Close player',
      'Keep listening'
    );
    expect(closePlayerSpy).toHaveBeenCalled();
    expect(ytPlayerMock.stopVideo).toHaveBeenCalled();
    expect(ytPlayerMock.destroy).toHaveBeenCalled();
    expect((component as any).ytPlayer).toBeNull();
    expect(component.showQueue).toBeFalse();
    expect(component.isPlaying).toBeFalse();
    expect(component.playerReady).toBeFalse();
  });

  it('should abort closing when the user cancels the confirmation', async () => {
    modalService.confirm.and.returnValue(Promise.resolve(false));
    const ytPlayerMock = {
      stopVideo: jasmine.createSpy('stopVideo'),
      destroy: jasmine.createSpy('destroy')
    };
    (component as any).ytPlayer = ytPlayerMock;

    await component.closePlayer();

    expect(modalService.confirm).toHaveBeenCalled();
    expect(closePlayerSpy).not.toHaveBeenCalled();
    expect((component as any).ytPlayer).toBe(ytPlayerMock);
    expect(ytPlayerMock.stopVideo).not.toHaveBeenCalled();
    expect(ytPlayerMock.destroy).not.toHaveBeenCalled();
  });

  it('should skip confirmation when skipConfirm is true', async () => {
    modalService.confirm.and.returnValue(Promise.resolve(true));

    await component.closePlayer(undefined, true);

    expect(modalService.confirm).not.toHaveBeenCalled();
    expect(closePlayerSpy).toHaveBeenCalled();
  });
});
