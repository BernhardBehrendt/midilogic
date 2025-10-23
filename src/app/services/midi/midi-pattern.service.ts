import { Injectable, signal, computed } from '@angular/core';
import { MidiService } from './midi.service';

export interface MidiNoteConfig {
  id: string;
  note: number;
  velocity: number;
  channel: number;
}

export interface MidiControlConfig {
  id: string;
  controller: number;
  value: number;
  channel: number;
}

export class MidiNote {
  private _note = signal<number>(60);
  private _velocity = signal<number>(100);
  private _channel = signal<number>(0);

  public readonly note = this._note.asReadonly();
  public readonly velocity = this._velocity.asReadonly();
  public readonly channel = this._channel.asReadonly();

  constructor(
    public readonly id: string,
    note: number = 60,
    velocity: number = 100,
    channel: number = 0,
    private onDelete?: (id: string) => void
  ) {
    this._note.set(note);
    this._velocity.set(velocity);
    this._channel.set(channel);
  }

  setNote(note: number): void {
    this._note.set(Math.max(0, Math.min(127, note)));
  }

  getNote(): number {
    return this._note();
  }

  setVelocity(velocity: number): void {
    this._velocity.set(Math.max(1, Math.min(127, velocity)));
  }

  getVelocity(): number {
    return this._velocity();
  }

  setChannel(channel: number): void {
    this._channel.set(Math.max(0, Math.min(15, channel)));
  }

  getChannel(): number {
    return this._channel();
  }

  setAll(note: number, velocity: number, channel: number): void {
    this.setNote(note);
    this.setVelocity(velocity);
    this.setChannel(channel);
  }

  getAll(): MidiNoteConfig {
    return {
      id: this.id,
      note: this._note(),
      velocity: this._velocity(),
      channel: this._channel()
    };
  }

  delete(): void {
    if (this.onDelete) {
      this.onDelete(this.id);
    }
  }
}

export class MidiControl {
  private _controller = signal<number>(1);
  private _value = signal<number>(64);
  private _channel = signal<number>(0);

  public readonly controller = this._controller.asReadonly();
  public readonly value = this._value.asReadonly();
  public readonly channel = this._channel.asReadonly();

  constructor(
    public readonly id: string,
    controller: number = 1,
    value: number = 64,
    channel: number = 0,
    private onDelete?: (id: string) => void
  ) {
    this._controller.set(controller);
    this._value.set(value);
    this._channel.set(channel);
  }

  setController(controller: number): void {
    this._controller.set(Math.max(0, Math.min(127, controller)));
  }

  getController(): number {
    return this._controller();
  }

  setValue(value: number): void {
    this._value.set(Math.max(0, Math.min(127, value)));
  }

  getValue(): number {
    return this._value();
  }

  setChannel(channel: number): void {
    this._channel.set(Math.max(0, Math.min(15, channel)));
  }

  getChannel(): number {
    return this._channel();
  }

  setAll(controller: number, value: number, channel: number): void {
    this.setController(controller);
    this.setValue(value);
    this.setChannel(channel);
  }

  getAll(): MidiControlConfig {
    return {
      id: this.id,
      controller: this._controller(),
      value: this._value(),
      channel: this._channel()
    };
  }

  delete(): void {
    if (this.onDelete) {
      this.onDelete(this.id);
    }
  }
}

@Injectable({
  providedIn: 'root',
})
export class MidiPatternService {
  private _notes = signal<MidiNote[]>([]);
  private _controls = signal<MidiControl[]>([]);

  // Read-only computed signals for external access
  public readonly notes = this._notes.asReadonly();
  public readonly controls = this._controls.asReadonly();

  // Computed properties for convenience
  public readonly noteCount = computed(() => this._notes().length);
  public readonly controlCount = computed(() => this._controls().length);

  private idCounter = 0;

  constructor(private midiService: MidiService) {}

  private generateId(): string {
    return `midi_${++this.idCounter}_${Date.now()}`;
  }

  createNote(note: number = 60, velocity: number = 100, channel: number = 0): MidiNote {
    const id = this.generateId();
    const midiNote = new MidiNote(
      id,
      note,
      velocity,
      channel,
      (id: string) => this.deleteNoteById(id)
    );

    this._notes.update(notes => [...notes, midiNote]);
    return midiNote;
  }

  createControl(controller: number = 1, value: number = 64, channel: number = 0): MidiControl {
    const id = this.generateId();
    const midiControl = new MidiControl(
      id,
      controller,
      value,
      channel,
      (id: string) => this.deleteControlById(id)
    );

    this._controls.update(controls => [...controls, midiControl]);
    return midiControl;
  }

  private deleteNoteById(id: string): void {
    this._notes.update(notes => notes.filter(note => note.id !== id));
  }

  private deleteControlById(id: string): void {
    this._controls.update(controls => controls.filter(control => control.id !== id));
  }

  // Get specific note or control by ID
  getNoteById(id: string): MidiNote | undefined {
    return this._notes().find(note => note.id === id);
  }

  getControlById(id: string): MidiControl | undefined {
    return this._controls().find(control => control.id === id);
  }

  // Play/send methods for individual items
  playNote(noteInstance: MidiNote, duration: number = 100): void {
    this.midiService.playNote(
      noteInstance.getNote(),
      noteInstance.getVelocity(),
      noteInstance.getChannel(),
      duration
    );
  }

  sendControl(controlInstance: MidiControl): void {
    this.midiService.sendControlChange(
      controlInstance.getController(),
      controlInstance.getValue(),
      controlInstance.getChannel()
    );
  }

  // Play/send all notes or controls
  playAllNotes(duration: number = 100): void {
    this._notes().forEach(note => this.playNote(note, duration));
  }

  sendAllControls(): void {
    this._controls().forEach(control => this.sendControl(control));
  }

  // Clear all instances
  clearAllNotes(): void {
    this._notes.set([]);
  }

  clearAllControls(): void {
    this._controls.set([]);
  }

  clearAll(): void {
    this.clearAllNotes();
    this.clearAllControls();
  }

  // Get all configurations as plain objects (useful for serialization/debugging)
  getAllNoteConfigs(): MidiNoteConfig[] {
    return this._notes().map(note => note.getAll());
  }

  getAllControlConfigs(): MidiControlConfig[] {
    return this._controls().map(control => control.getAll());
  }

  // Bulk operations
  createMultipleNotes(configs: Omit<MidiNoteConfig, 'id'>[]): MidiNote[] {
    return configs.map(config =>
      this.createNote(config.note, config.velocity, config.channel)
    );
  }

  createMultipleControls(configs: Omit<MidiControlConfig, 'id'>[]): MidiControl[] {
    return configs.map(config =>
      this.createControl(config.controller, config.value, config.channel)
    );
  }
}
