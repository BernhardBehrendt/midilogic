import { Component, computed, signal, effect } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { SettingsService } from '../../services/settings';
import { ClockService } from '../../services/clock';
import { OfflineSettingsComponent } from '../../shared/offline-settings/offline-settings';

@Component({
  selector: 'app-settings',
  standalone: true,
  imports: [CommonModule, FormsModule, OfflineSettingsComponent],
  templateUrl: './settings.html',
})
export class SettingsComponent {
  // UI state
  readonly activeTab = signal<'midi' | 'clock' | 'system'>('midi');
  readonly isTestingMidi = signal(false);
  readonly availableMidiInputs = signal<MIDIInput[]>([]);
  readonly availableMidiOutputs = signal<MIDIOutput[]>([]);
  readonly midiAccessError = signal<string | null>(null);

  // Settings signals - will be initialized in constructor
  readonly settings = computed(() => this.settingsService.settings());
  readonly midiSettings = computed(() => this.settingsService.midiSettings());
  readonly clockSettings = computed(() => this.settingsService.clockSettings());

  // Clock service signals
  readonly clockState = computed(() => this.clockService.clockState());
  readonly isClockRunning = computed(() => this.clockService.isRunning());
  readonly currentBpm = computed(() => this.settingsService.currentBpm());

  // Computed values
  readonly clockDebugInfo = computed(() => this.clockService.getDebugInfo());
  readonly canUseExternalClock = computed(
    () => this.midiSettings().syncEnabled && this.midiSettings().inputDeviceId !== null,
  );

  // Form helpers
  readonly bpmRange = { min: 60, max: 200, step: 1 };
  readonly midiChannelRange = { min: 1, max: 16, step: 1 };

  constructor(
    public settingsService: SettingsService,
    private clockService: ClockService,
  ) {
    this.initializeMidiAccess();

    // Watch for settings changes and sync with MIDI devices
    effect(() => {
      const midiSettings = this.midiSettings();
      this.syncMidiDeviceSelection(midiSettings);
    });
  }

  // Tab management
  setActiveTab(tab: 'midi' | 'clock' | 'system'): void {
    this.activeTab.set(tab);
  }

  // MIDI Methods
  private async initializeMidiAccess(): Promise<void> {
    try {
      if (!navigator.requestMIDIAccess) {
        throw new Error('Web MIDI API not supported in this browser');
      }

      const midiAccess = await navigator.requestMIDIAccess({ sysex: false });
      this.updateMidiDeviceList(midiAccess);

      // Listen for device changes
      midiAccess.onstatechange = () => {
        this.updateMidiDeviceList(midiAccess);
      };
    } catch (error) {
      console.error('MIDI access failed:', error);
      this.midiAccessError.set(error instanceof Error ? error.message : 'MIDI access failed');
    }
  }

  private updateMidiDeviceList(midiAccess: MIDIAccess): void {
    const inputs = Array.from(midiAccess.inputs.values());
    const outputs = Array.from(midiAccess.outputs.values());

    this.availableMidiInputs.set(inputs);
    this.availableMidiOutputs.set(outputs);

    // After updating device lists, sync with stored settings
    const midiSettings = this.midiSettings();
    this.syncMidiDeviceSelection(midiSettings);

    // Log for debugging
    console.log('MIDI devices updated:', {
      inputs: inputs.length,
      outputs: outputs.length,
      hasStoredInput: !!midiSettings.inputDeviceId,
      hasStoredOutput: !!midiSettings.outputDeviceId,
    });
  }

  setMidiInputDevice(deviceId: string): void {
    const actualDeviceId = deviceId === '' ? null : deviceId;
    this.settingsService.setMidiInputDevice(actualDeviceId);
  }

  setMidiOutputDevice(deviceId: string): void {
    const actualDeviceId = deviceId === '' ? null : deviceId;
    this.settingsService.setMidiOutputDevice(actualDeviceId);
  }

  setMidiChannel(channel: number): void {
    this.settingsService.setMidiChannel(channel);
  }

  toggleMidiSync(): void {
    this.settingsService.toggleMidiSync();
  }

  async testMidiOutput(): Promise<void> {
    if (this.isTestingMidi()) return;

    const outputDeviceId = this.midiSettings().outputDeviceId;
    if (!outputDeviceId) {
      console.warn('No output device selected for testing');
      return;
    }

    this.isTestingMidi.set(true);

    try {
      const midiAccess = await navigator.requestMIDIAccess();
      const output = midiAccess.outputs.get(outputDeviceId);

      if (output) {
        console.log('Testing MIDI output:', output.name);
        const channel = this.midiSettings().channel - 1; // MIDI channels are 0-indexed
        const velocity = 64;
        const note = 60; // Middle C

        // Send note on
        output.send([0x90 + channel, note, velocity]);

        // Send note off after 500ms
        setTimeout(() => {
          output.send([0x80 + channel, note, 0]);
          this.isTestingMidi.set(false);
          console.log('MIDI test completed');
        }, 500);
      } else {
        console.error('Output device not found:', outputDeviceId);
        this.isTestingMidi.set(false);
      }
    } catch (error) {
      console.error('MIDI test failed:', error);
      this.isTestingMidi.set(false);
    }
  }

  // Clock Methods
  setBpm(bpm: number): void {
    this.settingsService.setBpm(bpm);
  }

  setClockSource(source: 'internal' | 'external'): void {
    this.settingsService.setClockSource(source);
  }

  toggleClock(): void {
    if (this.isClockRunning()) {
      this.clockService.stop();
    } else {
      this.clockService.start();
    }
  }

  resetClock(): void {
    this.clockService.reset();
  }

  setBeatsPerBar(beats: number): void {
    this.clockService.setBeatsPerBar(beats);
  }

  setSubdivision(subdivision: number): void {
    this.clockService.setSubdivision(subdivision);
  }

  toggleMidiClockSync(): void {
    this.settingsService.toggleMidiClockSync();
  }

  // General Methods
  resetAllSettings(): void {
    if (
      confirm('Are you sure you want to reset all settings to defaults? This cannot be undone.')
    ) {
      this.settingsService.resetToDefaults();
    }
  }

  exportSettings(): void {
    const settingsJson = this.settingsService.exportSettings();
    const blob = new Blob([settingsJson], { type: 'application/json' });
    const url = URL.createObjectURL(blob);

    const a = document.createElement('a');
    a.href = url;
    a.download = `midilogic-settings-${new Date().toISOString().split('T')[0]}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }

  async importSettings(event: Event): Promise<void> {
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0];
    if (!file) return;

    try {
      const text = await file.text();
      const success = await this.settingsService.importSettings(text);

      if (success) {
        alert('Settings imported successfully!');
      } else {
        alert('Failed to import settings. Please check the file format.');
      }
    } catch (error) {
      console.error('Import failed:', error);
      alert('Failed to import settings. Please check the file format.');
    } finally {
      input.value = ''; // Reset input
    }
  }

  refreshMidiDevices(): void {
    this.initializeMidiAccess();
  }

  // Debug methods to help troubleshoot persistence issues
  logMidiState(): void {
    console.group('MIDI State Debug');
    console.log('Current MIDI Settings:', this.midiSettings());
    console.log(
      'Available Inputs:',
      this.availableMidiInputs().map((i) => ({ id: i.id, name: i.name })),
    );
    console.log(
      'Available Outputs:',
      this.availableMidiOutputs().map((o) => ({ id: o.id, name: o.name })),
    );
    console.log('MIDI Access Error:', this.midiAccessError());
    console.groupEnd();
  }

  // Test method to verify device persistence
  testDevicePersistence(): void {
    const settings = this.midiSettings();
    const inputs = this.availableMidiInputs();
    const outputs = this.availableMidiOutputs();

    console.group('Device Persistence Test');

    if (settings.inputDeviceId) {
      const inputExists = inputs.find((i) => i.id === settings.inputDeviceId);
      console.log('Stored input device:', settings.inputDeviceId);
      console.log('Input device exists:', !!inputExists);
      if (inputExists) {
        console.log('Input device found:', inputExists.name);
      }
    }

    if (settings.outputDeviceId) {
      const outputExists = outputs.find((o) => o.id === settings.outputDeviceId);
      console.log('Stored output device:', settings.outputDeviceId);
      console.log('Output device exists:', !!outputExists);
      if (outputExists) {
        console.log('Output device found:', outputExists.name);
      }
    }

    console.groupEnd();
  }

  // Sync MIDI device selection with stored settings
  private syncMidiDeviceSelection(midiSettings: any): void {
    const inputs = this.availableMidiInputs();
    const outputs = this.availableMidiOutputs();

    // Check if stored input device ID exists in current device list
    if (midiSettings.inputDeviceId) {
      const inputExists = inputs.some((input) => input.id === midiSettings.inputDeviceId);
      if (!inputExists) {
        console.warn('Stored input device not found, clearing selection');
        this.settingsService.setMidiInputDevice(null);
      }
    }

    // Check if stored output device ID exists in current device list
    if (midiSettings.outputDeviceId) {
      const outputExists = outputs.some((output) => output.id === midiSettings.outputDeviceId);
      if (!outputExists) {
        console.warn('Stored output device not found, clearing selection');
        this.settingsService.setMidiOutputDevice(null);
      }
    }
  }

  // Utility methods
  formatClockPosition(): string {
    const state = this.clockService.clockState();
    return `${state.currentBar}.${state.currentBeat}`;
  }

  getClockStatusBadge(): string {
    if (this.clockService.isRunning()) {
      return this.clockSettings().source === 'internal' ? 'badge-success' : 'badge-info';
    }
    return 'badge-neutral';
  }

  getClockStatusText(): string {
    const settings = this.clockSettings();
    const running = this.clockService.isRunning();

    if (!running) return 'Stopped';
    return settings.source === 'internal' ? 'Running (Internal)' : 'Running (External)';
  }

  getMidiStatusBadge(): string {
    const settings = this.midiSettings();
    if (settings.syncEnabled && settings.inputDeviceId && settings.outputDeviceId) {
      return 'badge-success';
    }
    if (settings.inputDeviceId || settings.outputDeviceId) {
      return 'badge-warning';
    }
    return 'badge-neutral';
  }

  getMidiStatusText(): string {
    const settings = this.midiSettings();
    const hasInput = !!settings.inputDeviceId;
    const hasOutput = !!settings.outputDeviceId;

    if (hasInput && hasOutput && settings.syncEnabled) return 'Fully Connected';
    if (hasInput && hasOutput) return 'Connected (Sync Off)';
    if (hasInput || hasOutput) return 'Partially Connected';
    return 'Disconnected';
  }
}
