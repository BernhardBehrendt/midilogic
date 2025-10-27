import { Component, signal, OnDestroy, inject, computed } from '@angular/core';
import { CommonModule } from '@angular/common';
import { MidiService } from '../../services/midi/midi.service';
import { MidiPatternService } from '../../services/midi/midi-pattern.service';
import { SettingsService } from '../../services/settings';
import { ClockService } from '../../services/clock';
import { LabStateService } from '../../services/lab-state.service';
import { PlaybackService } from '../../services/playback.service';
import { NoteConfigComponent } from '../note-config/note-config.component';
import { ControlConfigComponent } from '../control-config/control-config.component';

@Component({
  selector: 'ml-lab',
  standalone: true,
  imports: [CommonModule, NoteConfigComponent, ControlConfigComponent],
  templateUrl: './lab.component.html',
})
export class LabComponent implements OnDestroy {
  private midiService = inject(MidiService);
  private patternService = inject(MidiPatternService);
  private settingsService = inject(SettingsService);
  private clockService = inject(ClockService);
  private labStateService = inject(LabStateService);
  private playbackService = inject(PlaybackService);

  // Settings from settings service
  protected readonly midiSettings = this.settingsService.midiSettings;
  protected readonly clockSettings = this.settingsService.clockSettings;
  protected readonly isClockRunning = this.clockService.isRunning;
  protected readonly currentBpm = this.settingsService.currentBpm;

  // MIDI state from service (for status display only)
  protected readonly midiConnected = this.midiService.isInitialized;
  protected readonly connectionStatus = this.midiService.connectionStatus;

  // Clock sync state from services
  protected readonly isReceivingClock = this.midiService.isReceivingClock;
  protected readonly clockBPM = this.midiService.detectedBPM;
  protected readonly quarterNoteTrigger = signal(false);

  // Playback state from service
  protected readonly playbackState = this.playbackService.playbackState;
  protected readonly isPlaybackEnabled = this.playbackService.isEnabled;
  protected readonly isPlaybackPlaying = this.playbackService.isPlaying;

  // Lab state from service
  protected readonly labState = this.labStateService.labState;
  protected readonly labLoading = this.labStateService.isLoading;
  protected readonly hasUnsavedChanges = this.labStateService.hasUnsavedChanges;
  protected readonly noteConfigs = this.labStateService.noteConfigs;
  protected readonly controlConfigs = this.labStateService.controlConfigs;

  // Computed status
  protected readonly clockStatus = computed(() => {
    const settings = this.clockSettings();
    const running = this.isClockRunning();
    const receiving = this.isReceivingClock();

    if (settings.source === 'external') {
      return receiving ? `SYNCED (${this.clockBPM()} BPM)` : 'WAITING FOR MIDI CLOCK';
    } else {
      return running ? `INTERNAL (${this.currentBpm()} BPM)` : 'STOPPED';
    }
  });

  protected readonly midiDeviceStatus = computed(() => {
    const settings = this.midiSettings();
    const hasInput = !!settings.inputDeviceId;
    const hasOutput = !!settings.outputDeviceId;

    if (hasInput && hasOutput && settings.syncEnabled) return 'FULLY CONNECTED';
    if (hasInput && hasOutput) return 'CONNECTED (SYNC OFF)';
    if (hasInput || hasOutput) return 'PARTIALLY CONNECTED';
    return 'DISCONNECTED';
  });

  private playbackTriggerListener: ((event: Event) => void) | null = null;

  constructor() {
    // Listen for playback trigger events from the playback service
    this.setupPlaybackTriggerListener();
  }

  ngOnDestroy() {
    // Cleanup playback trigger listener
    if (this.playbackTriggerListener) {
      window.removeEventListener('playbackTrigger', this.playbackTriggerListener);
      this.playbackTriggerListener = null;
    }
  }

  private setupPlaybackTriggerListener() {
    this.playbackTriggerListener = (event: Event) => {
      const customEvent = event as CustomEvent;
      // Visual feedback when playback triggers
      this.quarterNoteTrigger.set(true);

      // Reset visual feedback after short delay
      setTimeout(() => {
        this.quarterNoteTrigger.set(false);
      }, 100);
    };

    window.addEventListener('playbackTrigger', this.playbackTriggerListener as EventListener);
  }

  // Clock control methods
  protected toggleClock() {
    if (this.isClockRunning()) {
      this.clockService.stop();
    } else {
      this.clockService.start();
    }
  }

  protected resetClock() {
    this.clockService.reset();
  }

  // Test quarter note trigger manually
  protected testQuarterNote() {
    this.playbackService.manualTrigger();
  }

  // BPM testing methods
  protected testBpm(bpm: number) {
    console.log(`Testing BPM change to ${bpm}`);
    this.settingsService.setBpm(bpm);
  }

  protected quickBpmTest() {
    const currentBpm = this.currentBpm();
    console.log(`Current BPM: ${currentBpm}, testing rapid BPM changes`);

    // Test sequence: 60 -> 120 -> 180 -> back to original
    setTimeout(() => this.testBpm(60), 0);
    setTimeout(() => this.testBpm(120), 2000);
    setTimeout(() => this.testBpm(180), 4000);
    setTimeout(() => this.testBpm(currentBpm), 6000);
  }

  // Note Instance Management
  protected addNoteInstance() {
    const midiSettings = this.midiSettings();
    this.labStateService.addNoteConfig({
      enabled: false,
      note: 36,
      velocity: 100,
      channel: midiSettings.channel - 1,
    });
  }

  protected onNoteDelete(instanceId: string) {
    this.labStateService.removeNoteConfig(instanceId);
  }

  protected onNoteToggleEnabled(event: { id: string; enabled: boolean }) {
    this.labStateService.updateNoteConfig(event.id, { enabled: event.enabled });
  }

  protected onNoteConfigChange(event: { id: string; updates: any }) {
    this.labStateService.updateNoteConfig(event.id, event.updates);
  }

  // Control Instance Management
  protected addControlInstance() {
    const midiSettings = this.midiSettings();
    this.labStateService.addControlConfig({
      enabled: false,
      controller: 1,
      value: 64,
      channel: midiSettings.channel - 1,
    });
  }

  protected onControlDelete(instanceId: string) {
    this.labStateService.removeControlConfig(instanceId);
  }

  protected onControlToggleEnabled(event: { id: string; enabled: boolean }) {
    this.labStateService.updateControlConfig(event.id, { enabled: event.enabled });
  }

  protected onControlConfigChange(event: { id: string; updates: any }) {
    this.labStateService.updateControlConfig(event.id, event.updates);
  }

  // Utility methods for template
  protected getEnabledNoteCount(): number {
    return this.labStateService.enabledNoteCount();
  }

  protected getEnabledControlCount(): number {
    return this.labStateService.enabledControlCount();
  }

  protected getTotalInstanceCount(): number {
    return this.labStateService.totalConfigs();
  }

  protected getClockStatusBadge(): string {
    const settings = this.clockSettings();
    const running = this.isClockRunning();
    const receiving = this.isReceivingClock();

    if (settings.source === 'external') {
      return receiving ? 'badge-success' : 'badge-warning';
    } else {
      return running ? 'badge-success' : 'badge-neutral';
    }
  }

  protected getMidiStatusBadge(): string {
    const status = this.midiDeviceStatus();
    switch (status) {
      case 'FULLY CONNECTED':
        return 'badge-success';
      case 'CONNECTED (SYNC OFF)':
      case 'PARTIALLY CONNECTED':
        return 'badge-warning';
      default:
        return 'badge-error';
    }
  }

  // State management methods
  protected async saveLabState() {
    try {
      await this.labStateService.saveState();
    } catch (error) {
      console.error('Failed to save lab state:', error);
    }
  }

  protected async resetLabState() {
    if (confirm('Are you sure you want to reset all lab configurations? This cannot be undone.')) {
      try {
        await this.labStateService.resetToDefaults();
      } catch (error) {
        console.error('Failed to reset lab state:', error);
      }
    }
  }

  protected async exportLabState() {
    try {
      const exportData = await this.labStateService.exportState();
      const blob = new Blob([exportData], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `lab-config-${new Date().toISOString().split('T')[0]}.json`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    } catch (error) {
      console.error('Failed to export lab state:', error);
    }
  }

  protected async importLabState(event: Event) {
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0];

    if (!file) return;

    try {
      const text = await file.text();
      await this.labStateService.importState(text);
    } catch (error) {
      console.error('Failed to import lab state:', error);
      alert('Failed to import configuration. Please check the file format.');
    }

    // Clear the input
    input.value = '';
  }
}
