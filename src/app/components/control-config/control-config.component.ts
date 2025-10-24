import { Component, signal, OnDestroy, inject, input, output, effect } from '@angular/core';
import { CommonModule } from '@angular/common';
import { MidiPatternService, MidiControl } from '../../services/midi/midi-pattern.service';
import { LabStateService } from '../../services/lab-state.service';

@Component({
  selector: 'ml-control-config',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './control-config.component.html',
})
export class ControlConfigComponent implements OnDestroy {
  private patternService = inject(MidiPatternService);
  private labStateService = inject(LabStateService);

  // Input signals
  public instanceId = input<string>('');
  public initialController = input<number>(1);
  public initialValue = input<number>(64);
  public initialChannel = input<number>(0);
  public showDelete = input<boolean>(true);

  // Output events
  public onDelete = output<string>();
  public onTest = output<MidiControl>();
  public onToggleEnabled = output<{ id: string; enabled: boolean }>();
  public onConfigChange = output<{ id: string; updates: any }>();

  // Internal state
  private controlInstance: MidiControl | null = null;
  protected readonly controlEnabled = signal(false);

  // UI binding signals that sync with the MidiControl instance
  protected readonly controlValue = signal(64);
  protected readonly controlParameter = signal(1);
  protected readonly controlChannel = signal(0);

  // Common MIDI CC parameters for dropdown
  protected readonly commonControllers = [
    { value: 1, name: 'CC1 (Modulation)' },
    { value: 7, name: 'CC7 (Volume)' },
    { value: 10, name: 'CC10 (Pan)' },
    { value: 11, name: 'CC11 (Expression)' },
    { value: 64, name: 'CC64 (Sustain)' },
    { value: 71, name: 'CC71 (Resonance)' },
    { value: 72, name: 'CC72 (Release)' },
    { value: 73, name: 'CC73 (Attack)' },
    { value: 74, name: 'CC74 (Cutoff)' },
    { value: 75, name: 'CC75 (Decay)' },
    { value: 91, name: 'CC91 (Reverb)' },
    { value: 93, name: 'CC93 (Chorus)' },
  ];

  constructor() {
    this.initializeInstance();

    // Set up reactive loading of persisted state
    effect(() => {
      const isLoading = this.labStateService.isLoading();
      if (!isLoading) {
        // Service has finished loading, now load our persisted state
        this.loadPersistedState();
      }
    });
  }

  ngOnDestroy() {
    if (this.controlInstance) {
      this.controlInstance.delete();
    }
  }

  private initializeInstance() {
    // Set initial values from inputs
    this.controlParameter.set(this.initialController());
    this.controlValue.set(this.initialValue());
    this.controlChannel.set(this.initialChannel());

    // Create MidiControl instance
    this.controlInstance = this.patternService.createControl(
      this.controlParameter(),
      this.controlValue(),
      this.controlChannel(),
    );

    // Persisted state will be loaded reactively via effect in constructor
  }

  private loadPersistedState() {
    const id = this.instanceId();
    if (!id) return;

    const persistedConfig = this.labStateService.getControlConfig(id);
    if (persistedConfig) {
      // Only update if values have actually changed to avoid unnecessary updates
      if (this.controlEnabled() !== persistedConfig.enabled) {
        this.controlEnabled.set(persistedConfig.enabled);
      }
      if (this.controlParameter() !== persistedConfig.controller) {
        this.controlParameter.set(persistedConfig.controller);
      }
      if (this.controlValue() !== persistedConfig.value) {
        this.controlValue.set(persistedConfig.value);
      }
      if (this.controlChannel() !== persistedConfig.channel) {
        this.controlChannel.set(persistedConfig.channel);
      }

      // Update MIDI instance
      if (this.controlInstance) {
        this.controlInstance.setController(persistedConfig.controller);
        this.controlInstance.setValue(persistedConfig.value);
        this.controlInstance.setChannel(persistedConfig.channel);
      }
    }
  }

  private saveCurrentState() {
    const id = this.instanceId();
    if (!id) return;

    const updates = {
      enabled: this.controlEnabled(),
      controller: this.controlParameter(),
      value: this.controlValue(),
      channel: this.controlChannel(),
    };

    this.onConfigChange.emit({ id, updates });
  }

  protected setControlValue(value: number) {
    const clampedValue = Math.max(0, Math.min(127, value));
    this.controlValue.set(clampedValue);
    if (this.controlInstance) {
      this.controlInstance.setValue(clampedValue);
    }
    this.saveCurrentState();
  }

  protected setControlParameter(param: number) {
    const clampedParam = Math.max(0, Math.min(127, param));
    this.controlParameter.set(clampedParam);
    if (this.controlInstance) {
      this.controlInstance.setController(clampedParam);
    }
    this.saveCurrentState();
  }

  protected setControlChannel(channel: number) {
    const clampedChannel = Math.max(0, Math.min(15, channel));
    this.controlChannel.set(clampedChannel);
    if (this.controlInstance) {
      this.controlInstance.setChannel(clampedChannel);
    }
    this.saveCurrentState();
  }

  protected testControl() {
    if (this.controlInstance) {
      this.patternService.sendControl(this.controlInstance);
      this.onTest.emit(this.controlInstance);
    }
  }

  protected toggleControlEnabled() {
    const newState = !this.controlEnabled();
    this.controlEnabled.set(newState);
    this.onToggleEnabled.emit({
      id: this.instanceId(),
      enabled: newState,
    });
    this.saveCurrentState();
  }

  protected deleteInstance() {
    this.onDelete.emit(this.instanceId());
  }

  protected selectCommonController(controller: number) {
    this.setControlParameter(controller);
  }

  // Public methods for external control
  public getControlInstance(): MidiControl | null {
    return this.controlInstance;
  }

  public isEnabled(): boolean {
    return this.controlEnabled();
  }

  public sendControl(): void {
    if (this.controlInstance && this.controlEnabled()) {
      this.patternService.sendControl(this.controlInstance);
    }
  }
}
