import { TestBed } from '@angular/core/testing';
import { provideZonelessChangeDetection } from '@angular/core';
import { SettingsService } from './settings';
import { OfflineStorageService } from '../core/storage/offline-storage';
import { MockOfflineStorageService } from '../../test-mocks/offline-storage.mock';

describe('SettingsService', () => {
  let service: SettingsService;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [
        provideZonelessChangeDetection(),
        SettingsService,
        { provide: OfflineStorageService, useClass: MockOfflineStorageService },
      ],
    });
    service = TestBed.inject(SettingsService);
  });

  it('should be created', () => {
    expect(service).toBeTruthy();
  });

  it('should have default settings', () => {
    const settings = service.settings();
    expect(settings.midi.channel).toBe(1);
    expect(settings.clock.bpm).toBe(120);
    expect(settings.clock.source).toBe('internal');
  });

  it('should update BPM correctly', () => {
    service.setBpm(140);
    expect(service.currentBpm()).toBe(140);
  });

  it('should not allow invalid BPM values', () => {
    const originalBpm = service.currentBpm();
    service.setBpm(50); // Too low
    expect(service.currentBpm()).toBe(originalBpm);

    service.setBpm(250); // Too high
    expect(service.currentBpm()).toBe(originalBpm);
  });

  it('should update MIDI channel correctly', () => {
    service.setMidiChannel(10);
    expect(service.midiChannel()).toBe(10);
  });

  it('should not allow invalid MIDI channels', () => {
    const originalChannel = service.midiChannel();
    service.setMidiChannel(0); // Too low
    expect(service.midiChannel()).toBe(originalChannel);

    service.setMidiChannel(17); // Too high
    expect(service.midiChannel()).toBe(originalChannel);
  });

  it('should toggle clock source', () => {
    expect(service.clockSource()).toBe('internal');
    service.setClockSource('external');
    expect(service.clockSource()).toBe('external');
  });

  it('should toggle MIDI sync', () => {
    expect(service.isMidiSyncEnabled()).toBe(false);
    service.toggleMidiSync();
    expect(service.isMidiSyncEnabled()).toBe(true);
  });
});
