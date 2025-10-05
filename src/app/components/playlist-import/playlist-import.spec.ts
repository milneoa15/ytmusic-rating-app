import { ComponentFixture, TestBed } from '@angular/core/testing';

import { PlaylistImport } from './playlist-import';

describe('PlaylistImport', () => {
  let component: PlaylistImport;
  let fixture: ComponentFixture<PlaylistImport>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [PlaylistImport]
    })
    .compileComponents();

    fixture = TestBed.createComponent(PlaylistImport);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
