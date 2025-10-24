import { Injectable, computed, effect, signal } from '@angular/core';
import { OfflineStorageService } from '../core/storage/offline-storage';

export interface MidiSettings {
  inputDeviceId: string | null;
  outputDeviceId: string | null;
  syncEnabled: boolean;
  channel: number; // MIDI channel (1-16)
}

export interface ClockSettings {
  source: 'internal' | 'external';
  bpm: number;
  isRunning: boolean;
  syncToMidiClock: boolean;
}

export interface AppSettings {
  midi: MidiSettings;
  clock: ClockSettings;
}

const DEFAULT_SETTINGS: AppSettings = {
  midi: {
    inputDeviceId: null,
    outputDeviceId: null,
    syncEnabled: false,
    channel: 1,
  },
  clock: {
    source: 'internal',
    bpm: 120,
    isRunning: false,
    syncToMidiClock: false,
  },
};

@Injectable({
  providedIn: 'root',
})
export class SettingsService {
  private readonly STORAGE_KEY = 'app-settings';

  // Settings signals
  private _settings = signal<AppSettings>(DEFAULT_SETTINGS);

  // Public readonly signals for reactive access
  readonly settings = this._settings.asReadonly();
  readonly midiSettings = computed(() => this.settings().midi);
  readonly clockSettings = computed(() => this.settings().clock);

  // Specific computed values for common use cases
  readonly currentBpm = computed(() => this.clockSettings().bpm);
  readonly clockSource = computed(() => this.clockSettings().source);
  readonly isClockRunning = computed(() => this.clockSettings().isRunning);
  readonly midiChannel = computed(() => this.midiSettings().channel);
  readonly isMidiSyncEnabled = computed(() => this.midiSettings().syncEnabled);

  constructor(private offlineStorage: OfflineStorageService) {
    this.loadSettings();

    // Auto-save settings when they change
    effect(() => {
      this.saveSettings(this.settings());
    });
  }

  // MIDI Settings Methods
  updateMidiSettings(updates: Partial<MidiSettings>): void {
    this._settings.update((current) => ({
      ...current,
      midi: { ...current.midi, ...updates },
    }));
  }

  setMidiInputDevice(deviceId: string | null): void {
    this.updateMidiSettings({ inputDeviceId: deviceId });
  }

  setMidiOutputDevice(deviceId: string | null): void {
    this.updateMidiSettings({ outputDeviceId: deviceId });
  }

  setMidiChannel(channel: number): void {
    if (channel >= 1 && channel <= 16) {
      this.updateMidiSettings({ channel });
    }
  }

  toggleMidiSync(): void {
    this.updateMidiSettings({ syncEnabled: !this.midiSettings().syncEnabled });
  }

  // Clock Settings Methods
  updateClockSettings(updates: Partial<ClockSettings>): void {
    this._settings.update((current) => ({
      ...current,
      clock: { ...current.clock, ...updates },
    }));
  }

  setBpm(bpm: number): void {
    // Validate BPM range - reject invalid values
    if (bpm < 60 || bpm > 200) {
      console.warn(`BPM ${bpm} out of valid range (60-200), ignoring`);
      return;
    }
    this.updateClockSettings({ bpm: Math.round(bpm) });
  }

  setClockSource(source: 'internal' | 'external'): void {
    // Stop clock when changing sources to prevent timing conflicts
    if (this.clockSettings().isRunning) {
      this.stopClock();
    }
    this.updateClockSettings({ source });
  }

  startClock(): void {
    this.updateClockSettings({ isRunning: true });
  }

  stopClock(): void {
    this.updateClockSettings({ isRunning: false });
  }

  toggleClock(): void {
    this.updateClockSettings({ isRunning: !this.clockSettings().isRunning });
  }

  toggleMidiClockSync(): void {
    this.updateClockSettings({ syncToMidiClock: !this.clockSettings().syncToMidiClock });
  }

  // General Methods
  resetToDefaults(): void {
    this._settings.set(DEFAULT_SETTINGS);
  }

  updateSettings(updates: Partial<AppSettings>): void {
    this._settings.update((current) => ({
      ...current,
      ...updates,
    }));
  }

  // Storage Methods
  private async loadSettings(): Promise<void> {
    try {
      // Use localStorage as fallback for app settings since OfflineStorageService
      // is designed for MIDI-specific data
      const stored = localStorage.getItem(this.STORAGE_KEY);
      if (stored) {
        const parsedSettings = JSON.parse(stored) as Partial<AppSettings>;
        // Merge stored settings with defaults to handle new settings
        const mergedSettings = this.mergeWithDefaults(parsedSettings);
        this._settings.set(mergedSettings);
      }
    } catch (error) {
      console.warn('Failed to load settings from storage:', error);
    }
  }

  private async saveSettings(settings: AppSettings): Promise<void> {
    try {
      // Use localStorage for app settings
      localStorage.setItem(this.STORAGE_KEY, JSON.stringify(settings));
    } catch (error) {
      console.warn('Failed to save settings to storage:', error);
    }
  }

  private mergeWithDefaults(stored: Partial<AppSettings>): AppSettings {
    const merged = {
      midi: { ...DEFAULT_SETTINGS.midi, ...stored.midi },
      clock: { ...DEFAULT_SETTINGS.clock, ...stored.clock },
    };

    // Validate merged settings
    if (merged.clock.bpm < 60 || merged.clock.bpm > 200) {
      console.warn(`Invalid BPM ${merged.clock.bpm} in stored settings, using default`);
      merged.clock.bpm = DEFAULT_SETTINGS.clock.bpm;
    }

    if (merged.midi.channel < 1 || merged.midi.channel > 16) {
      console.warn(`Invalid MIDI channel ${merged.midi.channel} in stored settings, using default`);
      merged.midi.channel = DEFAULT_SETTINGS.midi.channel;
    }

    return merged;
  }

  // Export/Import functionality
  exportSettings(): string {
    return JSON.stringify(this.settings(), null, 2);
  }

  async importSettings(settingsJson: string): Promise<boolean> {
    try {
      const imported = JSON.parse(settingsJson) as Partial<AppSettings>;
      const mergedSettings = this.mergeWithDefaults(imported);
      this._settings.set(mergedSettings);
      return true;
    } catch (error) {
      console.error('Failed to import settings:', error);
      return false;
    }
  }

  // Debug helpers
  logCurrentSettings(): void {
    console.log('Current Settings:', this.settings());
  }

  getSettingsSnapshot(): AppSettings {
    return structuredClone(this.settings());
  }
}
