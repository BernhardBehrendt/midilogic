import { Injectable, signal } from '@angular/core';

export interface MidiDevice {
  id: string;
  name: string;
  manufacturer: string;
  output: MIDIOutput;
}

export interface MidiInputDevice {
  id: string;
  name: string;
  manufacturer: string;
  input: MIDIInput;
}

export interface MidiNote {
  note: number;
  velocity: number;
  channel: number;
  duration?: number;
}

@Injectable({
  providedIn: 'root',
})
export class MidiService {
  private midiAccess: MIDIAccess | null = null;
  private noteOffTimeouts = new Map<string, number>();

  // Signals for reactive state
  public readonly isInitialized = signal(false);
  public readonly availableOutputs = signal<MidiDevice[]>([]);
  public readonly selectedOutput = signal<MidiDevice | null>(null);
  public readonly availableInputs = signal<MidiInputDevice[]>([]);
  public readonly selectedInput = signal<MidiInputDevice | null>(null);
  public readonly connectionStatus = signal<string>('Disconnected');
  public readonly isReceivingClock = signal(false);
  public readonly detectedBPM = signal(0);

  // Default MIDI notes for different tracks
  private readonly trackNotes = {
    kick: 36, // C1 - Standard kick drum
    snare: 38, // D1 - Standard snare drum
    hihat: 42, // F#1 - Closed hi-hat
    bass: 48, // C2 - Bass note
  };

  // Clock tracking
  private clockCount = 0;
  private lastClockTime = 0;
  private clockTimes: number[] = [];
  private clockTimeout: number | null = null;

  constructor() {
    this.initializeMIDI();
  }

  private async initializeMIDI(): Promise<void> {
    try {
      // Check if Web MIDI API is supported
      if (!navigator.requestMIDIAccess) {
        this.connectionStatus.set('Web MIDI API not supported');
        console.error('Web MIDI API is not supported in this browser');
        return;
      }

      this.connectionStatus.set('Connecting...');

      // Request MIDI access with sysex disabled for basic functionality
      this.midiAccess = await navigator.requestMIDIAccess({ sysex: false });

      // Set up event listeners for device connections/disconnections
      this.midiAccess.onstatechange = (event: MIDIConnectionEvent) => {
        console.log('MIDI device state changed:', event);
        this.updateAvailableOutputs();
        this.updateAvailableInputs();
      };

      // Initialize available outputs and inputs
      this.updateAvailableOutputs();
      this.updateAvailableInputs();
      this.isInitialized.set(true);
      this.connectionStatus.set('Connected');

      console.log('MIDI initialized successfully', this.midiAccess);
    } catch (error) {
      console.error('Failed to initialize MIDI:', error);
      this.connectionStatus.set('Failed to connect');
      this.isInitialized.set(false);
    }
  }

  private updateAvailableOutputs(): void {
    if (!this.midiAccess) return;

    const outputs: MidiDevice[] = [];

    for (const output of this.midiAccess.outputs.values()) {
      outputs.push({
        id: output.id || '',
        name: output.name || 'Unknown Device',
        manufacturer: output.manufacturer || 'Unknown',
        output: output,
      });
    }

    this.availableOutputs.set(outputs);

    // Auto-select first available output if none selected
    if (outputs.length > 0 && !this.selectedOutput()) {
      this.selectOutput(outputs[0]);
    }

    console.log('Available MIDI outputs:', outputs);
  }

  public selectOutput(device: MidiDevice): void {
    this.selectedOutput.set(device);
    console.log('Selected MIDI output:', device);
  }

  private updateAvailableInputs(): void {
    if (!this.midiAccess) return;

    const inputs: MidiInputDevice[] = [];

    for (const input of this.midiAccess.inputs.values()) {
      inputs.push({
        id: input.id || '',
        name: input.name || 'Unknown Device',
        manufacturer: input.manufacturer || 'Unknown',
        input: input,
      });
    }

    this.availableInputs.set(inputs);

    // Auto-select first available input if none selected
    if (inputs.length > 0 && !this.selectedInput()) {
      this.selectInput(inputs[0]);
    }

    console.log('Available MIDI inputs:', inputs);
  }

  public selectInput(device: MidiInputDevice): void {
    // Close previous input if any
    if (this.selectedInput()) {
      this.selectedInput()!.input.onmidimessage = null;
    }

    this.selectedInput.set(device);

    // Set up MIDI message listener
    device.input.onmidimessage = (event: MIDIMessageEvent) => {
      this.handleMidiMessage(event);
    };

    console.log('Selected MIDI input:', device);
  }

  private handleMidiMessage(event: MIDIMessageEvent): void {
    if (!event.data) return;
    const data = Array.from(event.data);
    const [status, data1, data2] = data;

    // MIDI Clock message (0xF8)
    if (status === 0xf8) {
      this.handleMidiClock();
    }
    // MIDI Start (0xFA)
    else if (status === 0xfa) {
      console.log('MIDI Start received');
      this.clockCount = 0;
    }
    // MIDI Stop (0xFC)
    else if (status === 0xfc) {
      console.log('MIDI Stop received');
      this.isReceivingClock.set(false);
      this.detectedBPM.set(0);
      if (this.clockTimeout) {
        clearTimeout(this.clockTimeout);
        this.clockTimeout = null;
      }
    }
    // MIDI Continue (0xFB)
    else if (status === 0xfb) {
      console.log('MIDI Continue received');
    }
  }

  private handleMidiClock(): void {
    const now = performance.now();

    // Calculate BPM from clock timing
    if (this.lastClockTime > 0) {
      this.clockTimes.push(now - this.lastClockTime);

      // Keep only last 24 intervals for BPM calculation (1 beat worth)
      if (this.clockTimes.length > 24) {
        this.clockTimes.shift();
      }

      // Calculate average interval and BPM
      if (this.clockTimes.length >= 24) {
        const avgInterval = this.clockTimes.reduce((a, b) => a + b, 0) / this.clockTimes.length;
        const bpm = Math.round(60000 / (avgInterval * 24)); // 24 clocks per quarter note
        this.detectedBPM.set(bpm);
      }
    }

    this.lastClockTime = now;
    this.clockCount++;
    this.isReceivingClock.set(true);

    // Trigger quarter note event (every 24 clocks)
    if (this.clockCount % 24 === 0) {
      this.onQuarterNote();
    }

    // Reset receiving status if no clock for 2 seconds
    if (this.clockTimeout) {
      clearTimeout(this.clockTimeout);
    }
    this.clockTimeout = window.setTimeout(() => {
      this.isReceivingClock.set(false);
      this.detectedBPM.set(0);
    }, 2000);
  }

  private onQuarterNote(): void {
    // Dispatch custom event for quarter note trigger
    const event = new CustomEvent('midiQuarterNote', {
      detail: { bpm: this.detectedBPM(), clockCount: this.clockCount },
    });
    window.dispatchEvent(event);
  }

  public sendNoteOn(note: number, velocity: number = 100, channel: number = 0): void {
    const output = this.selectedOutput()?.output;
    if (!output) {
      console.warn('No MIDI output selected');
      return;
    }

    try {
      // MIDI Note On message: [0x90 + channel, note, velocity]
      const noteOnMessage = [0x90 + channel, note, velocity];
      output.send(noteOnMessage);

      console.log(`MIDI Note On: Channel ${channel}, Note ${note}, Velocity ${velocity}`);
    } catch (error) {
      console.error('Failed to send MIDI note on:', error);
    }
  }

  public sendNoteOff(note: number, channel: number = 0): void {
    const output = this.selectedOutput()?.output;
    if (!output) {
      console.warn('No MIDI output selected');
      return;
    }

    try {
      // MIDI Note Off message: [0x80 + channel, note, 0]
      const noteOffMessage = [0x80 + channel, note, 0];
      output.send(noteOffMessage);

      console.log(`MIDI Note Off: Channel ${channel}, Note ${note}`);
    } catch (error) {
      console.error('Failed to send MIDI note off:', error);
    }
  }

  public playNote(
    note: number,
    velocity: number = 100,
    channel: number = 0,
    duration: number = 100,
  ): void {
    // Send note on immediately
    this.sendNoteOn(note, velocity, channel);

    // Create unique key for this note
    const noteKey = `${channel}-${note}`;

    // Clear any existing timeout for this note
    const existingTimeout = this.noteOffTimeouts.get(noteKey);
    if (existingTimeout) {
      clearTimeout(existingTimeout);
    }

    // Schedule note off
    const timeoutId = window.setTimeout(() => {
      this.sendNoteOff(note, channel);
      this.noteOffTimeouts.delete(noteKey);
    }, duration);

    this.noteOffTimeouts.set(noteKey, timeoutId);
  }

  // Convenience methods for different track types
  public playKick(velocity: number = 100, channel: number = 9): void {
    this.playNote(this.trackNotes.kick, velocity, channel, 100);
  }

  public playSnare(velocity: number = 100, channel: number = 9): void {
    this.playNote(this.trackNotes.snare, velocity, channel, 100);
  }

  public playHihat(velocity: number = 80, channel: number = 9): void {
    this.playNote(this.trackNotes.hihat, velocity, channel, 50);
  }

  public playBass(note: number = 48, velocity: number = 100, channel: number = 0): void {
    this.playNote(note, velocity, channel, 200);
  }

  // Send MIDI Clock signals for sync (if needed)
  public sendClock(): void {
    const output = this.selectedOutput()?.output;
    if (!output) return;

    try {
      // MIDI Clock message: 0xF8
      output.send([0xf8]);
    } catch (error) {
      console.error('Failed to send MIDI clock:', error);
    }
  }

  public sendStart(): void {
    const output = this.selectedOutput()?.output;
    if (!output) return;

    try {
      // MIDI Start message: 0xFA
      output.send([0xfa]);
      console.log('MIDI Start sent');
    } catch (error) {
      console.error('Failed to send MIDI start:', error);
    }
  }

  public sendStop(): void {
    const output = this.selectedOutput()?.output;
    if (!output) return;

    try {
      // MIDI Stop message: 0xFC
      output.send([0xfc]);
      console.log('MIDI Stop sent');
    } catch (error) {
      console.error('Failed to send MIDI stop:', error);
    }
  }

  public sendControlChange(controller: number, value: number, channel: number = 0): void {
    const output = this.selectedOutput()?.output;
    if (!output) {
      console.warn('No MIDI output selected');
      return;
    }

    try {
      // MIDI Control Change message: [0xB0 + channel, controller, value]
      const controlChangeMessage = [0xb0 + channel, controller, value];
      output.send(controlChangeMessage);

      console.log(
        `MIDI Control Change: Channel ${channel}, Controller ${controller}, Value ${value}`,
      );
    } catch (error) {
      console.error('Failed to send MIDI control change:', error);
    }
  }

  // Clean up all pending note offs
  public stopAllNotes(): void {
    // Clear all pending note off timeouts
    this.noteOffTimeouts.forEach((timeoutId) => {
      clearTimeout(timeoutId);
    });
    this.noteOffTimeouts.clear();

    // Send all notes off message on all channels
    const output = this.selectedOutput()?.output;
    if (!output) return;

    for (let channel = 0; channel < 16; channel++) {
      try {
        // All Notes Off: [0xB0 + channel, 0x7B, 0]
        output.send([0xb0 + channel, 0x7b, 0]);
      } catch (error) {
        console.error(`Failed to send all notes off for channel ${channel}:`, error);
      }
    }
  }

  // Get track note numbers for UI
  public getTrackNotes() {
    return this.trackNotes;
  }
}
