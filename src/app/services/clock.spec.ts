import { TestBed } from '@angular/core/testing';
import { provideZonelessChangeDetection } from '@angular/core';
import { ClockService } from './clock';
import { SettingsService } from './settings';
import { OfflineStorageService } from '../core/storage/offline-storage';
import { MockOfflineStorageService } from '../../test-mocks/offline-storage.mock';

describe('ClockService', () => {
  let service: ClockService;
  let settingsService: SettingsService;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [
        provideZonelessChangeDetection(),
        ClockService,
        SettingsService,
        { provide: OfflineStorageService, useClass: MockOfflineStorageService },
      ],
    });
    service = TestBed.inject(ClockService);
    settingsService = TestBed.inject(SettingsService);
  });

  it('should be created', () => {
    expect(service).toBeTruthy();
  });

  it('should have initial clock state', () => {
    const state = service.clockState();
    expect(state.isRunning).toBe(false);
    expect(state.currentBeat).toBe(1);
    expect(state.currentBar).toBe(1);
    expect(state.beatsPerBar).toBe(4);
  });

  it('should calculate timing correctly', () => {
    settingsService.setBpm(120);
    expect(service.millisecondsPerBeat()).toBe(500); // 60000 / 120
  });

  it('should respond to settings changes', () => {
    settingsService.setBpm(140);
    expect(service.currentBpm()).toBe(140);
  });

  it('should set beats per bar', () => {
    service.setBeatsPerBar(3);
    expect(service.clockState().beatsPerBar).toBe(3);
  });

  it('should not allow invalid beats per bar', () => {
    const originalBeats = service.clockState().beatsPerBar;
    service.setBeatsPerBar(0);
    expect(service.clockState().beatsPerBar).toBe(originalBeats);

    service.setBeatsPerBar(20);
    expect(service.clockState().beatsPerBar).toBe(originalBeats);
  });

  it('should set subdivision', () => {
    service.setSubdivision(8);
    expect(service.clockState().subdivision).toBe(8);
  });

  it('should only allow valid subdivisions', () => {
    const originalSubdivision = service.clockState().subdivision;
    service.setSubdivision(7); // Invalid
    expect(service.clockState().subdivision).toBe(originalSubdivision);

    service.setSubdivision(16); // Valid
    expect(service.clockState().subdivision).toBe(16);
  });

  it('should reset clock state', () => {
    service.setBeatsPerBar(3);
    service.reset();
    const state = service.clockState();
    expect(state.currentBeat).toBe(1);
    expect(state.currentBar).toBe(1);
    expect(state.isRunning).toBe(false);
  });
});
