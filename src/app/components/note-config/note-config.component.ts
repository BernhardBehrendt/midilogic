import {
  Component,
  signal,
  OnDestroy,
  inject,
  input,
  output,
  computed,
  effect,
} from '@angular/core';
import { CommonModule, TitleCasePipe } from '@angular/common';
import { MidiPatternService, MidiNote } from '../../services/midi/midi-pattern.service';
import { LabStateService } from '../../services/lab-state.service';
import {
  getAllOctaves,
  getAllNotes,
  getCommonNotes,
  getDrumKitNotes,
  getNoteByMidiNumber,
  NoteInfo,
  OctaveInfo,
} from '../../utils/note-mapping';

@Component({
  selector: 'ml-note-config',
  standalone: true,
  imports: [CommonModule, TitleCasePipe],
  templateUrl: './note-config.component.html',
})
export class NoteConfigComponent implements OnDestroy {
  private patternService = inject(MidiPatternService);
  private labStateService = inject(LabStateService);

  // Input signals
  public instanceId = input<string>('');
  public initialNote = input<number>(36);
  public initialVelocity = input<number>(100);
  public initialChannel = input<number>(0);
  public showDelete = input<boolean>(true);

  // Output events
  public onDelete = output<string>();
  public onTest = output<MidiNote>();
  public onToggleEnabled = output<{ id: string; enabled: boolean }>();
  public onConfigChange = output<{ id: string; updates: any }>();

  // Internal state
  private noteInstance: MidiNote | null = null;

  // UI binding signals that sync with the persistent state
  protected readonly noteEnabled = signal(false);
  protected readonly selectedNote = signal(36);
  protected readonly noteVelocity = signal(100);
  protected readonly selectedChannel = signal(0);
  protected readonly selectedOctave = signal(4); // Default to middle octave
  protected readonly noteDisplayMode = signal<'common' | 'all' | 'drums' | 'octave'>('common');
  protected readonly useFlats = signal(false);

  // Available octaves
  protected readonly availableOctaves: OctaveInfo[] = getAllOctaves();

  // Computed note lists based on current mode
  protected readonly availableNotes = computed(() => {
    const mode = this.noteDisplayMode();
    switch (mode) {
      case 'common':
        return getCommonNotes();
      case 'all':
        return getAllNotes(this.useFlats());
      case 'drums':
        return getDrumKitNotes();
      case 'octave':
        const octave = this.selectedOctave();
        const octaveInfo = this.availableOctaves.find((o) => o.octave === octave);
        return octaveInfo ? octaveInfo.notes : [];
      default:
        return getCommonNotes();
    }
  });

  // Computed current note info
  protected readonly currentNoteInfo = computed(() => {
    return getNoteByMidiNumber(this.selectedNote(), this.useFlats());
  });

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
    if (this.noteInstance) {
      this.noteInstance.delete();
    }
  }

  private initializeInstance() {
    // Set initial values from inputs
    this.selectedNote.set(this.initialNote());
    this.noteVelocity.set(this.initialVelocity());
    this.selectedChannel.set(this.initialChannel());

    // Create MidiNote instance
    this.noteInstance = this.patternService.createNote(
      this.selectedNote(),
      this.noteVelocity(),
      this.selectedChannel(),
    );

    // Persisted state will be loaded reactively via effect in constructor
  }

  private loadPersistedState() {
    const id = this.instanceId();
    if (!id) return;

    const persistedConfig = this.labStateService.getNoteConfig(id);
    if (persistedConfig) {
      // Only update if values have actually changed to avoid unnecessary updates
      if (this.noteEnabled() !== persistedConfig.enabled) {
        this.noteEnabled.set(persistedConfig.enabled);
      }
      if (this.selectedNote() !== persistedConfig.note) {
        this.selectedNote.set(persistedConfig.note);
      }
      if (this.noteVelocity() !== persistedConfig.velocity) {
        this.noteVelocity.set(persistedConfig.velocity);
      }
      if (this.selectedChannel() !== persistedConfig.channel) {
        this.selectedChannel.set(persistedConfig.channel);
      }
      if (this.selectedOctave() !== persistedConfig.octave) {
        this.selectedOctave.set(persistedConfig.octave);
      }
      if (this.noteDisplayMode() !== persistedConfig.displayMode) {
        this.noteDisplayMode.set(persistedConfig.displayMode);
      }
      if (this.useFlats() !== persistedConfig.useFlats) {
        this.useFlats.set(persistedConfig.useFlats);
      }

      // Update MIDI instance
      if (this.noteInstance) {
        this.noteInstance.setNote(persistedConfig.note);
        this.noteInstance.setVelocity(persistedConfig.velocity);
        this.noteInstance.setChannel(persistedConfig.channel);
      }
    }
  }

  private saveCurrentState() {
    const id = this.instanceId();
    if (!id) return;

    const updates = {
      enabled: this.noteEnabled(),
      note: this.selectedNote(),
      velocity: this.noteVelocity(),
      channel: this.selectedChannel(),
      octave: this.selectedOctave(),
      displayMode: this.noteDisplayMode(),
      useFlats: this.useFlats(),
    };

    this.onConfigChange.emit({ id, updates });
  }

  protected setNote(note: number) {
    this.selectedNote.set(note);
    if (this.noteInstance) {
      this.noteInstance.setNote(note);
    }

    // Update octave based on the selected note
    const noteInfo = getNoteByMidiNumber(note);
    if (noteInfo) {
      this.selectedOctave.set(noteInfo.octave);
    }

    this.saveCurrentState();
  }

  protected setVelocity(velocity: number) {
    const clampedVelocity = Math.max(1, Math.min(127, velocity));
    this.noteVelocity.set(clampedVelocity);
    if (this.noteInstance) {
      this.noteInstance.setVelocity(clampedVelocity);
    }
    this.saveCurrentState();
  }

  protected setChannel(channel: number) {
    const clampedChannel = Math.max(0, Math.min(15, channel));
    this.selectedChannel.set(clampedChannel);
    if (this.noteInstance) {
      this.noteInstance.setChannel(clampedChannel);
    }
    this.saveCurrentState();
  }

  protected testNote() {
    if (this.noteInstance) {
      this.patternService.playNote(this.noteInstance, 200);
      this.onTest.emit(this.noteInstance);
    }
  }

  protected toggleNoteEnabled() {
    const newState = !this.noteEnabled();
    this.noteEnabled.set(newState);
    this.onToggleEnabled.emit({
      id: this.instanceId(),
      enabled: newState,
    });
    this.saveCurrentState();
  }

  protected setNoteDisplayMode(mode: 'common' | 'all' | 'drums' | 'octave') {
    this.noteDisplayMode.set(mode);
    this.saveCurrentState();
  }

  protected setOctave(octave: number) {
    this.selectedOctave.set(octave);

    // If we're in octave mode and have a current note, try to find equivalent in new octave
    if (this.noteDisplayMode() === 'octave') {
      const currentNote = this.selectedNote();
      const currentNoteInOctave = currentNote % 12;
      const newNote = (octave + 1) * 12 + currentNoteInOctave;

      if (newNote >= 0 && newNote <= 127) {
        this.setNote(newNote);
      }
    }
    this.saveCurrentState();
  }

  protected toggleFlats() {
    this.useFlats.set(!this.useFlats());
    this.saveCurrentState();
  }

  protected deleteInstance() {
    this.onDelete.emit(this.instanceId());
  }

  // Public methods for external control
  public getNoteInstance(): MidiNote | null {
    return this.noteInstance;
  }

  public isEnabled(): boolean {
    return this.noteEnabled();
  }

  public playNote(duration: number = 100): void {
    if (this.noteInstance && this.noteEnabled()) {
      this.patternService.playNote(this.noteInstance, duration);
    }
  }
}
