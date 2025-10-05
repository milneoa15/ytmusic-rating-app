import { ComponentFixture, TestBed } from '@angular/core/testing';

import { SongRating } from './song-rating';

describe('SongRating', () => {
  let component: SongRating;
  let fixture: ComponentFixture<SongRating>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [SongRating]
    })
    .compileComponents();

    fixture = TestBed.createComponent(SongRating);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
