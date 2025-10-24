import {
  Component,
  signal,
  OnDestroy,
  inject,
  ViewChildren,
  QueryList,
  AfterViewInit,
  computed,
  effect,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { MidiService } from '../../services/midi/midi.service';
import { MidiPatternService } from '../../services/midi/midi-pattern.service';
import { SettingsService } from '../../services/settings';
import { ClockService } from '../../services/clock';
import { LabStateService } from '../../services/lab-state.service';
import { NoteConfigComponent } from '../note-config/note-config.component';
import { ControlConfigComponent } from '../control-config/control-config.component';

@Component({
  selector: 'ml-lab',
  standalone: true,
  imports: [CommonModule, NoteConfigComponent, ControlConfigComponent],
  templateUrl: './lab.component.html',
})
export class LabComponent implements OnDestroy, AfterViewInit {
  private midiService = inject(MidiService);
  private patternService = inject(MidiPatternService);
  private settingsService = inject(SettingsService);
  private clockService = inject(ClockService);
  private labStateService = inject(LabStateService);

  @ViewChildren(NoteConfigComponent) noteComponents!: QueryList<NoteConfigComponent>;
  @ViewChildren(ControlConfigComponent) controlComponents!: QueryList<ControlConfigComponent>;

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

  private intervalId: number | null = null;

  constructor() {
    // Listen for quarter note events from MIDI service
    this.setupMidiQuarterNoteListener();

    // Setup effect to monitor clock service pulses
    this.setupClockPulseListener();
  }

  ngAfterViewInit() {
    // ViewChildren are now available
  }

  ngOnDestroy() {
    // Cleanup quarter note listener
    window.removeEventListener('midiQuarterNote', this.onQuarterNote as EventListener);

    // Cleanup interval if exists
    if (this.intervalId !== null) {
      clearInterval(this.intervalId);
    }
  }

  private setupMidiQuarterNoteListener() {
    // Listen for MIDI clock quarter notes
    window.addEventListener('midiQuarterNote', this.onQuarterNote as EventListener);
  }

  private setupClockPulseListener() {
    // React to clock pulse changes from the clock service
    effect(() => {
      const lastPulse = this.clockService.lastPulse();
      const clockSettings = this.clockSettings();
      const clockState = this.clockService.clockState();

      // Only trigger on internal clock pulses
      if (lastPulse && clockSettings.source === 'internal' && this.isClockRunning()) {
        // Calculate if this is a quarter note beat
        // With subdivision = 16 (sixteenth notes), quarter notes occur every 4 subdivisions
        // With subdivision = 8 (eighth notes), quarter notes occur every 2 subdivisions
        // With subdivision = 4 (quarter notes), quarter notes occur every 1 subdivision
        const subdivisionsPerQuarterNote = Math.max(1, clockState.subdivision / 4);

        // Debug logging for BPM tracking
        if (localStorage.getItem('debug-clock') === 'true') {
          console.log('Clock pulse:', {
            bpm: this.currentBpm(),
            subdivision: lastPulse.subdivision,
            subdivisionsPerQuarterNote,
            shouldTrigger: (lastPulse.subdivision - 1) % subdivisionsPerQuarterNote === 0,
          });
        }

        // Trigger on quarter note boundaries
        if ((lastPulse.subdivision - 1) % subdivisionsPerQuarterNote === 0) {
          this.triggerQuarterNote();
        }
      }
    });
  }

  private onQuarterNote = (event: Event) => {
    this.triggerQuarterNote();
  };

  private triggerQuarterNote() {
    this.quarterNoteTrigger.set(true);

    // Debug logging for note triggers
    if (localStorage.getItem('debug-clock') === 'true') {
      console.log('Triggering quarter note at BPM:', this.currentBpm());
    }

    // Trigger all enabled note instances based on persisted state
    const enabledNoteConfigs = this.noteConfigs().filter((config) => config.enabled);
    enabledNoteConfigs.forEach((config) => {
      // Find the corresponding component and trigger it
      const component = this.noteComponents?.find((comp) => comp.instanceId() === config.id);
      if (component) {
        component.playNote(100);
      }
    });

    // Send all enabled control instances based on persisted state
    const enabledControlConfigs = this.controlConfigs().filter((config) => config.enabled);
    enabledControlConfigs.forEach((config) => {
      // Find the corresponding component and trigger it
      const component = this.controlComponents?.find((comp) => comp.instanceId() === config.id);
      if (component) {
        component.sendControl();
      }
    });

    // Reset trigger visual after short delay
    setTimeout(() => {
      this.quarterNoteTrigger.set(false);
    }, 100);
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
    this.triggerQuarterNote();
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
