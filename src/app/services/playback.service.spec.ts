import { TestBed } from '@angular/core/testing';
import { signal, provideZonelessChangeDetection } from '@angular/core';
import { vi } from 'vitest';

import { PlaybackService } from './playback.service';
import { MidiService } from './midi/midi.service';
import { SettingsService } from './settings';
import { ClockService } from './clock';
import { LabStateService } from './lab-state.service';

describe('PlaybackService', () => {
  let service: PlaybackService;
  let mockMidiService: any;
  let mockSettingsService: any;
  let mockClockService: any;
  let mockLabStateService: any;

  beforeEach(() => {
    // Create mock services with required signals and methods
    mockMidiService = {
      playNote: vi.fn(),
      sendControlChange: vi.fn(),
      isInitialized: signal(true),
      isReceivingClock: signal(false),
      detectedBPM: signal(120),
    };

    mockSettingsService = {
      setBpm: vi.fn(),
      clockSettings: signal({
        source: 'internal' as const,
        bpm: 120,
        isRunning: false,
        syncToMidiClock: false,
      }),
      currentBpm: signal(120),
    };

    mockClockService = {
      start: vi.fn(),
      stop: vi.fn(),
      isRunning: signal(false),
      lastPulse: signal(null),
      clockState: signal({
        subdivision: 16,
        currentBeat: 1,
        currentBar: 1,
      }),
    };

    mockLabStateService = {
      addNoteConfig: vi.fn(),
      noteConfigs: signal([]),
      controlConfigs: signal([]),
      enabledNoteCount: signal(0),
      enabledControlCount: signal(0),
    };

    TestBed.configureTestingModule({
      providers: [
        provideZonelessChangeDetection(),
        PlaybackService,
        { provide: MidiService, useValue: mockMidiService },
        { provide: SettingsService, useValue: mockSettingsService },
        { provide: ClockService, useValue: mockClockService },
        { provide: LabStateService, useValue: mockLabStateService },
      ],
    });

    service = TestBed.inject(PlaybackService);
  });

  it('should be created', () => {
    expect(service).toBeTruthy();
  });

  it('should initialize with default state', () => {
    expect(service.isEnabled()).toBe(false);
    expect(service.isPlaying()).toBe(false);
    expect(service.lastTriggerTime()).toBeNull();
  });

  it('should enable playback', () => {
    service.enablePlayback();
    expect(service.isEnabled()).toBe(true);
  });

  it('should disable playback', () => {
    service.enablePlayback();
    service.startPlayback();

    service.disablePlayback();

    expect(service.isEnabled()).toBe(false);
    expect(service.isPlaying()).toBe(false);
  });

  it('should start playback when enabled', () => {
    service.enablePlayback();
    service.startPlayback();

    expect(service.isPlaying()).toBe(true);
  });

  it('should not start playback when disabled', () => {
    service.startPlayback();

    expect(service.isPlaying()).toBe(false);
  });

  it('should toggle playback state', () => {
    service.enablePlayback();

    service.togglePlayback();
    expect(service.isPlaying()).toBe(true);

    service.togglePlayback();
    expect(service.isPlaying()).toBe(false);
  });

  it('should determine canPlay correctly', () => {
    // Initially should not be able to play
    expect(service.canPlay()).toBe(false);

    // Enable playback but no configs
    service.enablePlayback();
    expect(service.canPlay()).toBe(false);

    // Mock some enabled configs
    mockLabStateService.enabledNoteCount.set(1);
    expect(service.canPlay()).toBe(true);
  });

  it('should provide correct playback status', () => {
    expect(service.playbackStatus()).toBe('DISABLED');

    service.enablePlayback();
    expect(service.playbackStatus()).toBe('STOPPED');

    service.startPlayback();
    expect(service.playbackStatus()).toBe('CLOCK STOPPED');
  });

  afterEach(() => {
    // Cleanup if service has ngOnDestroy
    if (service && typeof service.ngOnDestroy === 'function') {
      service.ngOnDestroy();
    }
  });
});
