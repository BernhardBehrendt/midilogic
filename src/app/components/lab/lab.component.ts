import {
  Component,
  signal,
  OnDestroy,
  inject,
  ViewChildren,
  QueryList,
  AfterViewInit,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { MidiService, MidiDevice, MidiInputDevice } from '../../services/midi/midi.service';
import { MidiPatternService } from '../../services/midi/midi-pattern.service';
import { NoteConfigComponent } from '../note-config/note-config.component';
import { ControlConfigComponent } from '../control-config/control-config.component';

interface NoteConfigInstance {
  id: string;
  enabled: boolean;
}

interface ControlConfigInstance {
  id: string;
  enabled: boolean;
}

@Component({
  selector: 'ml-lab',
  standalone: true,
  imports: [CommonModule, NoteConfigComponent, ControlConfigComponent],
  templateUrl: './lab.component.html',
})
export class LabComponent implements OnDestroy, AfterViewInit {
  private midiService = inject(MidiService);
  private patternService = inject(MidiPatternService);

  @ViewChildren(NoteConfigComponent) noteComponents!: QueryList<NoteConfigComponent>;
  @ViewChildren(ControlConfigComponent) controlComponents!: QueryList<ControlConfigComponent>;

  // MIDI state from service
  protected readonly midiConnected = this.midiService.isInitialized;
  protected readonly connectionStatus = this.midiService.connectionStatus;
  protected readonly availableOutputs = this.midiService.availableOutputs;
  protected readonly selectedOutput = this.midiService.selectedOutput;
  protected readonly availableInputs = this.midiService.availableInputs;
  protected readonly selectedInput = this.midiService.selectedInput;

  // Clock sync state from service
  protected readonly isReceivingClock = this.midiService.isReceivingClock;
  protected readonly clockBPM = this.midiService.detectedBPM;
  protected readonly quarterNoteTrigger = signal(false);

  // Instance management
  protected readonly noteInstances = signal<NoteConfigInstance[]>([]);
  protected readonly controlInstances = signal<ControlConfigInstance[]>([]);

  private idCounter = 0;

  constructor() {
    // Listen for quarter note events from MIDI service
    this.setupQuarterNoteListener();

    // Initialize with one note and one control instance
    this.addNoteInstance();
    this.addControlInstance();
  }

  ngAfterViewInit() {
    // ViewChildren are now available
  }

  ngOnDestroy() {
    // Cleanup quarter note listener
    window.removeEventListener('midiQuarterNote', this.onQuarterNote as EventListener);
  }

  private setupQuarterNoteListener() {
    window.addEventListener('midiQuarterNote', this.onQuarterNote as EventListener);
  }

  private onQuarterNote = (event: Event) => {
    this.triggerQuarterNote();
  };

  private triggerQuarterNote() {
    this.quarterNoteTrigger.set(true);

    // Trigger all enabled note instances
    if (this.noteComponents) {
      this.noteComponents.forEach((component) => {
        if (component.isEnabled()) {
          component.playNote(100);
        }
      });
    }

    // Send all enabled control instances
    if (this.controlComponents) {
      this.controlComponents.forEach((component) => {
        if (component.isEnabled()) {
          component.sendControl();
        }
      });
    }

    // Reset trigger visual after short delay
    setTimeout(() => {
      this.quarterNoteTrigger.set(false);
    }, 100);
  }

  private generateId(): string {
    return `instance_${++this.idCounter}_${Date.now()}`;
  }

  // MIDI Device Management
  protected selectMidiOutput(device: MidiDevice) {
    this.midiService.selectOutput(device);
  }

  protected selectMidiInput(device: MidiInputDevice) {
    this.midiService.selectInput(device);
  }

  // Test quarter note trigger manually
  protected testQuarterNote() {
    this.triggerQuarterNote();
  }

  // Note Instance Management
  protected addNoteInstance() {
    const newInstance: NoteConfigInstance = {
      id: this.generateId(),
      enabled: false,
    };

    this.noteInstances.update((instances) => [...instances, newInstance]);
  }

  protected onNoteDelete(instanceId: string) {
    // Remove from instances array
    this.noteInstances.update((instances) =>
      instances.filter((instance) => instance.id !== instanceId),
    );

    // Component reference will be automatically updated by ViewChildren
  }

  protected onNoteToggleEnabled(event: { id: string; enabled: boolean }) {
    this.noteInstances.update((instances) =>
      instances.map((instance) =>
        instance.id === event.id ? { ...instance, enabled: event.enabled } : instance,
      ),
    );
  }

  // Component references are handled by ViewChildren

  // Control Instance Management
  protected addControlInstance() {
    const newInstance: ControlConfigInstance = {
      id: this.generateId(),
      enabled: false,
    };

    this.controlInstances.update((instances) => [...instances, newInstance]);
  }

  protected onControlDelete(instanceId: string) {
    // Remove from instances array
    this.controlInstances.update((instances) =>
      instances.filter((instance) => instance.id !== instanceId),
    );

    // Component reference will be automatically updated by ViewChildren
  }

  protected onControlToggleEnabled(event: { id: string; enabled: boolean }) {
    this.controlInstances.update((instances) =>
      instances.map((instance) =>
        instance.id === event.id ? { ...instance, enabled: event.enabled } : instance,
      ),
    );
  }

  // Component references are handled by ViewChildren

  // Utility methods for template
  protected getEnabledNoteCount(): number {
    if (!this.noteComponents) return 0;
    return this.noteComponents.filter((component) => component.isEnabled()).length;
  }

  protected getEnabledControlCount(): number {
    if (!this.controlComponents) return 0;
    return this.controlComponents.filter((component) => component.isEnabled()).length;
  }

  protected getTotalInstanceCount(): number {
    return this.noteInstances().length + this.controlInstances().length;
  }
}
