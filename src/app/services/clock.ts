import { Injectable, computed, effect, signal } from '@angular/core';
import { SettingsService } from './settings';

export interface ClockPulse {
  timestamp: number;
  beat: number;
  bar: number;
  subdivision: number;
}

export interface ClockState {
  isRunning: boolean;
  currentBeat: number;
  currentBar: number;
  beatsPerBar: number;
  subdivision: number; // 16th notes per beat (4 = quarter notes, 8 = eighth notes, 16 = sixteenth notes)
}

@Injectable({
  providedIn: 'root',
})
export class ClockService {
  private intervalId: number | null = null;
  private startTime: number = 0;
  private pausedTime: number = 0;
  private lastPulseTime: number = 0;

  // Clock state signals
  private _clockState = signal<ClockState>({
    isRunning: false,
    currentBeat: 1,
    currentBar: 1,
    beatsPerBar: 4,
    subdivision: 16, // 16th note subdivision
  });

  // Pulse event signal
  private _lastPulse = signal<ClockPulse | null>(null);

  // Public readonly signals
  readonly clockState = this._clockState.asReadonly();
  readonly lastPulse = this._lastPulse.asReadonly();

  // Computed values
  readonly isRunning = computed(() => this.clockState().isRunning);
  readonly currentBeat = computed(() => this.clockState().currentBeat);
  readonly currentBar = computed(() => this.clockState().currentBar);
  readonly beatsPerBar = computed(() => this.clockState().beatsPerBar);

  // Timing calculations with safety checks
  readonly currentBpm = computed(() => this.settingsService.currentBpm());
  readonly millisecondsPerBeat = computed(() => {
    const bpm = this.currentBpm();
    // Safety check for valid BPM
    if (bpm <= 0 || bpm > 1000) {
      console.warn(`Invalid BPM: ${bpm}, using default 120`);
      return 60000 / 120;
    }
    return 60000 / bpm;
  });
  readonly millisecondsPerSubdivision = computed(() => {
    const subdivision = this.clockState().subdivision;
    const millisecondsPerBeat = this.millisecondsPerBeat();

    // Safety check for valid subdivision
    if (subdivision <= 0 || subdivision > 64) {
      console.warn(`Invalid subdivision: ${subdivision}, using default 16`);
      return millisecondsPerBeat / 4;
    }

    const result = millisecondsPerBeat / (subdivision / 4);

    // Ensure minimum subdivision interval to prevent freezing
    if (result < 5) {
      console.warn(`Subdivision interval too small (${result}ms), clamping to 5ms`);
      return 5;
    }

    return result;
  });

  constructor(private settingsService: SettingsService) {
    // React to clock control changes from settings
    effect(() => {
      const clockSettings = this.settingsService.clockSettings();
      const currentState = this.clockState();

      // Handle start/stop from settings
      if (clockSettings.isRunning && !currentState.isRunning) {
        if (clockSettings.source === 'internal') {
          this.startInternalClock();
        }
      } else if (!clockSettings.isRunning && currentState.isRunning) {
        this.stopInternalClock();
      }

      // Handle BPM changes while running
      if (currentState.isRunning && clockSettings.source === 'internal') {
        this.updateClockTiming();
      }
    });
  }

  // Public control methods
  start(): void {
    if (this.settingsService.clockSource() === 'internal') {
      this.settingsService.startClock();
    } else {
      // For external clock, we just mark as running and wait for MIDI clock
      this._clockState.update((state) => ({ ...state, isRunning: true }));
      this.settingsService.startClock();
    }
  }

  stop(): void {
    this.settingsService.stopClock();
  }

  reset(): void {
    this.stop();
    this._clockState.update((state) => ({
      ...state,
      currentBeat: 1,
      currentBar: 1,
    }));
    this.pausedTime = 0;
  }

  setBpm(bpm: number): void {
    this.settingsService.setBpm(bpm);
  }

  setBeatsPerBar(beats: number): void {
    if (beats >= 1 && beats <= 16) {
      this._clockState.update((state) => ({ ...state, beatsPerBar: beats }));
    }
  }

  setSubdivision(subdivision: number): void {
    const validSubdivisions = [4, 8, 16, 32];
    if (validSubdivisions.includes(subdivision)) {
      this._clockState.update((state) => ({ ...state, subdivision }));
      if (this.isRunning()) {
        this.updateClockTiming();
      }
    }
  }

  // Internal clock management
  private startInternalClock(): void {
    if (this.intervalId !== null) {
      clearInterval(this.intervalId);
    }

    this.startTime = performance.now() - this.pausedTime;
    this.lastPulseTime = this.startTime;

    this._clockState.update((state) => ({ ...state, isRunning: true }));

    this.scheduleNextPulse();
  }

  private stopInternalClock(): void {
    if (this.intervalId !== null) {
      clearTimeout(this.intervalId); // Use clearTimeout since we're using setTimeout
      this.intervalId = null;
    }

    this.pausedTime = performance.now() - this.startTime;
    this._clockState.update((state) => ({ ...state, isRunning: false }));
  }

  private scheduleNextPulse(): void {
    if (!this.isRunning()) return;

    const now = performance.now();
    const timeSinceLastPulse = now - this.lastPulseTime;
    const subdivisionInterval = this.millisecondsPerSubdivision();

    let nextPulseDelay = subdivisionInterval - (timeSinceLastPulse % subdivisionInterval);

    // Ensure minimum delay to prevent excessive CPU usage and browser freezing
    nextPulseDelay = Math.max(nextPulseDelay, 10); // Increased minimum from 1ms to 10ms

    // Add maximum frequency protection - no faster than 200Hz (5ms intervals)
    nextPulseDelay = Math.max(nextPulseDelay, 5);

    // Safety check for reasonable subdivision intervals
    if (subdivisionInterval < 5) {
      console.warn('Subdivision interval too small, clamping to 5ms');
      nextPulseDelay = 5;
    }

    this.intervalId = window.setTimeout(() => {
      if (this.isRunning()) {
        // Double-check we're still running
        this.generatePulse();
        this.scheduleNextPulse();
      }
    }, nextPulseDelay);
  }

  private generatePulse(): void {
    const now = performance.now();
    const currentState = this.clockState();

    // Safety check for subdivision interval
    const subdivisionInterval = this.millisecondsPerSubdivision();
    if (subdivisionInterval < 5) {
      console.warn('Subdivision interval too small, skipping pulse generation');
      return;
    }

    // Calculate current position
    const elapsedTime = now - this.startTime;
    const totalSubdivisions = Math.floor(elapsedTime / subdivisionInterval);

    const subdivisionsPerBeat = currentState.subdivision / 4;
    const subdivisionsPerBar = subdivisionsPerBeat * currentState.beatsPerBar;

    const currentSubdivision = (totalSubdivisions % subdivisionsPerBeat) + 1;
    const currentBeat =
      (Math.floor(totalSubdivisions / subdivisionsPerBeat) % currentState.beatsPerBar) + 1;
    const currentBar = Math.floor(totalSubdivisions / subdivisionsPerBar) + 1;

    // Update state only if values have changed to prevent unnecessary updates
    const currentClockState = this.clockState();
    if (
      currentClockState.currentBeat !== currentBeat ||
      currentClockState.currentBar !== currentBar
    ) {
      this._clockState.update((state) => ({
        ...state,
        currentBeat,
        currentBar,
      }));
    }

    // Create pulse event
    const pulse: ClockPulse = {
      timestamp: now,
      beat: currentBeat,
      bar: currentBar,
      subdivision: currentSubdivision,
    };

    this._lastPulse.set(pulse);
    this.lastPulseTime = now;

    // Emit pulse for other services to listen to
    this.onPulse(pulse);
  }

  private updateClockTiming(): void {
    if (this.isRunning() && this.settingsService.clockSource() === 'internal') {
      // Instead of stopping/starting, just reschedule the next pulse
      // This prevents timing glitches and potential freezing
      if (this.intervalId !== null) {
        clearInterval(this.intervalId);
        this.intervalId = null;
      }
      // Reschedule with new timing
      this.scheduleNextPulse();
    }
  }

  // Pulse event handler for other services to override
  protected onPulse(pulse: ClockPulse): void {
    // Can be used by other services or components to react to clock pulses
    // For example, triggering MIDI events, updating UI, etc.
  }

  // External MIDI clock synchronization
  handleMidiClockStart(): void {
    if (this.settingsService.clockSource() === 'external') {
      this._clockState.update((state) => ({ ...state, isRunning: true }));
      this.startTime = performance.now();
      this.pausedTime = 0;
    }
  }

  handleMidiClockStop(): void {
    if (this.settingsService.clockSource() === 'external') {
      this._clockState.update((state) => ({ ...state, isRunning: false }));
      this.pausedTime = performance.now() - this.startTime;
    }
  }

  handleMidiClockPulse(): void {
    if (this.settingsService.clockSource() === 'external' && this.isRunning()) {
      const now = performance.now();

      // MIDI clock sends 24 pulses per quarter note
      // We need to convert this to our subdivision system
      const midiPulsesPerBeat = 24;
      const ourSubdivisionsPerBeat = this.clockState().subdivision / 4;

      // This is a simplified implementation - in practice, you'd want to
      // calculate BPM from MIDI clock timing and smooth out irregularities
      this.generatePulse();
    }
  }

  // Utility methods
  getTimePosition(): { bar: number; beat: number; subdivision: number } {
    const state = this.clockState();
    return {
      bar: state.currentBar,
      beat: state.currentBeat,
      subdivision: 1, // This could be calculated more precisely
    };
  }

  getElapsedTime(): number {
    if (!this.isRunning()) {
      return this.pausedTime;
    }
    return performance.now() - this.startTime;
  }

  getElapsedBeats(): number {
    return this.getElapsedTime() / this.millisecondsPerBeat();
  }

  // Metronome functionality
  shouldPlayMetronomeClick(pulse: ClockPulse): boolean {
    // Play on beat 1 (stronger) and other beats (weaker)
    return pulse.subdivision === 1; // Only on beat subdivisions
  }

  isDownbeat(pulse: ClockPulse): boolean {
    return pulse.beat === 1 && pulse.subdivision === 1;
  }

  // Debug methods
  getDebugInfo(): any {
    return {
      clockState: this.clockState(),
      currentBpm: this.currentBpm(),
      millisecondsPerBeat: this.millisecondsPerBeat(),
      millisecondsPerSubdivision: this.millisecondsPerSubdivision(),
      isRunning: this.isRunning(),
      elapsedTime: this.getElapsedTime(),
      elapsedBeats: this.getElapsedBeats(),
      timePosition: this.getTimePosition(),
    };
  }

  // Cleanup
  ngOnDestroy(): void {
    if (this.intervalId !== null) {
      clearTimeout(this.intervalId); // Use clearTimeout since we're using setTimeout
      this.intervalId = null;
    }
  }
}
