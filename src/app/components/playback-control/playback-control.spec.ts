import { ComponentFixture, TestBed } from '@angular/core/testing';
import { signal, provideZonelessChangeDetection } from '@angular/core';
import { vi } from 'vitest';

import { PlaybackControlComponent } from './playback-control';
import { PlaybackService } from '../../services/playback.service';

describe('PlaybackControlComponent', () => {
  let component: PlaybackControlComponent;
  let fixture: ComponentFixture<PlaybackControlComponent>;
  let mockPlaybackService: any;

  beforeEach(async () => {
    mockPlaybackService = {
      isEnabled: signal(false),
      isPlaying: signal(false),
      playbackStatus: signal('DISABLED'),
      playbackStatusBadge: signal('badge-neutral'),
      enabledNoteCount: signal(0),
      enabledControlCount: signal(0),
      canPlay: vi.fn().mockReturnValue(false),
      enablePlayback: vi.fn(),
      disablePlayback: vi.fn(),
      togglePlayback: vi.fn(),
      manualTrigger: vi.fn(),
    };

    await TestBed.configureTestingModule({
      imports: [PlaybackControlComponent],
      providers: [
        provideZonelessChangeDetection(),
        { provide: PlaybackService, useValue: mockPlaybackService },
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(PlaybackControlComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  it('should toggle enabled state', () => {
    component['toggleEnabled']();
    expect(mockPlaybackService.enablePlayback).toHaveBeenCalled();
  });

  it('should toggle playback', () => {
    component['togglePlayback']();
    expect(mockPlaybackService.togglePlayback).toHaveBeenCalled();
  });

  it('should trigger manual playback', () => {
    component['manualTrigger']();
    expect(mockPlaybackService.manualTrigger).toHaveBeenCalled();
  });
});
