import { ComponentFixture, TestBed } from '@angular/core/testing';

import { PlaylistExport } from './playlist-export';

describe('PlaylistExport', () => {
  let component: PlaylistExport;
  let fixture: ComponentFixture<PlaylistExport>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [PlaylistExport]
    })
    .compileComponents();

    fixture = TestBed.createComponent(PlaylistExport);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
