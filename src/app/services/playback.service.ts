import { Injectable, signal, computed, effect, inject, OnDestroy } from '@angular/core';
import { MidiService } from './midi/midi.service';
import { SettingsService } from './settings';
import { ClockService } from './clock';
import { LabStateService } from './lab-state.service';

export interface PlaybackState {
  isPlaying: boolean;
  isEnabled: boolean;
  lastTriggerTime: number | null;
}

@Injectable({
  providedIn: 'root',
})
export class PlaybackService implements OnDestroy {
  private midiService = inject(MidiService);
  private settingsService = inject(SettingsService);
  private clockService = inject(ClockService);
  private labStateService = inject(LabStateService);

  // Internal state
  private _playbackState = signal<PlaybackState>({
    isPlaying: false,
    isEnabled: false,
    lastTriggerTime: null,
  });

  // Public readonly signals
  readonly playbackState = this._playbackState.asReadonly();
  readonly isPlaying = computed(() => this._playbackState().isPlaying);
  readonly isEnabled = computed(() => this._playbackState().isEnabled);
  readonly lastTriggerTime = computed(() => this._playbackState().lastTriggerTime);

  // Computed status from settings services
  readonly clockSettings = this.settingsService.clockSettings;
  readonly isClockRunning = this.clockService.isRunning;
  readonly currentBpm = this.settingsService.currentBpm;
  readonly isReceivingClock = this.midiService.isReceivingClock;
  readonly clockBPM = this.midiService.detectedBPM;

  // Lab state for playback
  readonly noteConfigs = this.labStateService.noteConfigs;
  readonly controlConfigs = this.labStateService.controlConfigs;
  readonly enabledNoteCount = this.labStateService.enabledNoteCount;
  readonly enabledControlCount = this.labStateService.enabledControlCount;

  // Computed playback status
  readonly playbackStatus = computed(() => {
    const state = this._playbackState();
    const clockRunning = this.isClockRunning();
    const clockSettings = this.clockSettings();
    const receiving = this.isReceivingClock();

    if (!state.isEnabled) return 'DISABLED';
    if (!state.isPlaying) return 'STOPPED';

    if (clockSettings.source === 'external') {
      return receiving ? `PLAYING (SYNCED ${this.clockBPM()} BPM)` : 'WAITING FOR MIDI CLOCK';
    } else {
      return clockRunning ? `PLAYING (${this.currentBpm()} BPM)` : 'CLOCK STOPPED';
    }
  });

  readonly playbackStatusBadge = computed(() => {
    const status = this.playbackStatus();
    if (status.includes('PLAYING')) return 'badge-success';
    if (status.includes('WAITING') || status.includes('STOPPED')) return 'badge-warning';
    return 'badge-neutral';
  });

  // Private cleanup tracking
  private quarterNoteListener: ((event: Event) => void) | null = null;
  private effectCleanup: (() => void) | null = null;

  constructor() {
    this.setupMidiQuarterNoteListener();
    this.setupClockPulseListener();
  }

  ngOnDestroy() {
    this.cleanup();
  }

  private cleanup() {
    // Cleanup MIDI quarter note listener
    if (this.quarterNoteListener) {
      window.removeEventListener('midiQuarterNote', this.quarterNoteListener);
      this.quarterNoteListener = null;
    }

    // Cleanup effect
    if (this.effectCleanup) {
      this.effectCleanup();
      this.effectCleanup = null;
    }
  }

  private setupMidiQuarterNoteListener() {
    this.quarterNoteListener = (event: Event) => {
      if (this.isPlaying() && this.isEnabled()) {
        this.triggerPlayback();
      }
    };

    window.addEventListener('midiQuarterNote', this.quarterNoteListener);
  }

  private setupClockPulseListener() {
    // React to clock pulse changes from the clock service
    const effectRef = effect(() => {
      const lastPulse = this.clockService.lastPulse();
      const clockSettings = this.clockSettings();
      const clockState = this.clockService.clockState();
      const isPlaying = this.isPlaying();
      const isEnabled = this.isEnabled();

      // Only trigger on internal clock pulses when playback is active
      if (
        lastPulse &&
        clockSettings.source === 'internal' &&
        this.isClockRunning() &&
        isPlaying &&
        isEnabled
      ) {
        // Calculate if this is a quarter note beat
        const subdivisionsPerQuarterNote = Math.max(1, clockState.subdivision / 4);

        // Debug logging for BPM tracking
        if (localStorage.getItem('debug-playback') === 'true') {
          console.log('Playback pulse:', {
            bpm: this.currentBpm(),
            subdivision: lastPulse.subdivision,
            subdivisionsPerQuarterNote,
            shouldTrigger: (lastPulse.subdivision - 1) % subdivisionsPerQuarterNote === 0,
          });
        }

        // Trigger on quarter note boundaries
        if ((lastPulse.subdivision - 1) % subdivisionsPerQuarterNote === 0) {
          this.triggerPlayback();
        }
      }
    });

    // Store cleanup function
    this.effectCleanup = () => effectRef.destroy();
  }

  private triggerPlayback() {
    const now = Date.now();

    // Update last trigger time
    this._playbackState.update((state) => ({
      ...state,
      lastTriggerTime: now,
    }));

    // Debug logging
    if (localStorage.getItem('debug-playback') === 'true') {
      console.log('Triggering playback at BPM:', this.currentBpm());
    }

    // Trigger all enabled note instances
    const enabledNoteConfigs = this.noteConfigs().filter((config) => config.enabled);
    enabledNoteConfigs.forEach((config) => {
      this.midiService.playNote(config.note, config.velocity, config.channel, 100);
    });

    // Send all enabled control instances
    const enabledControlConfigs = this.controlConfigs().filter((config) => config.enabled);
    enabledControlConfigs.forEach((config) => {
      this.midiService.sendControlChange(config.controller, config.value, config.channel);
    });

    // Emit playback trigger event for UI components that need to react
    window.dispatchEvent(
      new CustomEvent('playbackTrigger', {
        detail: {
          timestamp: now,
          noteCount: enabledNoteConfigs.length,
          controlCount: enabledControlConfigs.length,
        },
      }),
    );
  }

  // Public control methods
  enablePlayback() {
    this._playbackState.update((state) => ({
      ...state,
      isEnabled: true,
    }));
  }

  disablePlayback() {
    this._playbackState.update((state) => ({
      ...state,
      isEnabled: false,
      isPlaying: false,
    }));
  }

  startPlayback() {
    if (!this.isEnabled()) {
      console.warn('Cannot start playback: playback is disabled');
      return;
    }

    this._playbackState.update((state) => ({
      ...state,
      isPlaying: true,
    }));

    // Auto-start clock if using internal clock and it's not running
    const clockSettings = this.clockSettings();
    if (clockSettings.source === 'internal' && !this.isClockRunning()) {
      this.clockService.start();
    }
  }

  stopPlayback() {
    this._playbackState.update((state) => ({
      ...state,
      isPlaying: false,
    }));
  }

  togglePlayback() {
    if (this.isPlaying()) {
      this.stopPlayback();
    } else {
      this.startPlayback();
    }
  }

  // Manual trigger for testing
  manualTrigger() {
    if (this.isEnabled()) {
      this.triggerPlayback();
    }
  }

  // Status methods
  canPlay(): boolean {
    return (
      this.isEnabled() &&
      (this.enabledNoteCount() > 0 || this.enabledControlCount() > 0) &&
      this.midiService.isInitialized()
    );
  }

  getPlaybackSummary() {
    return {
      isEnabled: this.isEnabled(),
      isPlaying: this.isPlaying(),
      canPlay: this.canPlay(),
      enabledNotes: this.enabledNoteCount(),
      enabledControls: this.enabledControlCount(),
      lastTrigger: this.lastTriggerTime(),
      status: this.playbackStatus(),
      clockSource: this.clockSettings().source,
      bpm: this.currentBpm(),
    };
  }

  // Debug methods
  logPlaybackState() {
    console.log('Playback State:', this.getPlaybackSummary());
  }
}
