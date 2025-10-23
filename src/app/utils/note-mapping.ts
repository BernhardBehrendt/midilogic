/**
 * Comprehensive MIDI note mapping utility
 * Provides note names, octave information, and MIDI number mappings
 */

export interface NoteInfo {
  value: number;        // MIDI note number (0-127)
  name: string;         // Full note name with octave (e.g., "C4", "F#2")
  noteName: string;     // Just the note name (e.g., "C", "F#")
  octave: number;       // Octave number (-1 to 9)
  frequency: number;    // Frequency in Hz
  isSharp: boolean;     // Whether it's a sharp/flat note
}

export interface OctaveInfo {
  octave: number;
  name: string;         // e.g., "Octave 4 (Middle)"
  range: string;        // e.g., "C4 - B4"
  startNote: number;    // MIDI number of C in this octave
  notes: NoteInfo[];    // All 12 notes in this octave
}

// Chromatic note names (12 semitones)
const CHROMATIC_NOTES = [
  'C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'
];

// Alternative flat names for sharp notes
const FLAT_NAMES = [
  'C', 'Db', 'D', 'Eb', 'E', 'F', 'Gb', 'G', 'Ab', 'A', 'Bb', 'B'
];

// Special octave descriptions
const OCTAVE_DESCRIPTIONS: Record<number, string> = {
  '-1': 'Sub-Contra Octave',
  '0': 'Contra Octave',
  '1': 'Great Octave',
  '2': 'Small Octave',
  '3': 'One-line Octave',
  '4': 'Two-line Octave (Middle)',
  '5': 'Three-line Octave',
  '6': 'Four-line Octave',
  '7': 'Five-line Octave',
  '8': 'Six-line Octave',
  '9': 'Seven-line Octave'
};

/**
 * Calculate frequency for a MIDI note number using A4 = 440Hz
 */
function calculateFrequency(midiNumber: number): number {
  return 440 * Math.pow(2, (midiNumber - 69) / 12);
}

/**
 * Get octave number from MIDI note number
 */
function getOctaveFromMidiNumber(midiNumber: number): number {
  return Math.floor(midiNumber / 12) - 1;
}

/**
 * Get note index within octave (0-11) from MIDI note number
 */
function getNoteIndexFromMidiNumber(midiNumber: number): number {
  return midiNumber % 12;
}

/**
 * Create a NoteInfo object for a given MIDI number
 */
function createNoteInfo(midiNumber: number, useFlats: boolean = false): NoteInfo {
  const noteIndex = getNoteIndexFromMidiNumber(midiNumber);
  const octave = getOctaveFromMidiNumber(midiNumber);
  const noteName = useFlats ? FLAT_NAMES[noteIndex] : CHROMATIC_NOTES[noteIndex];
  const fullName = `${noteName}${octave}`;
  const frequency = calculateFrequency(midiNumber);
  const isSharp = noteName.includes('#') || noteName.includes('b');

  return {
    value: midiNumber,
    name: fullName,
    noteName,
    octave,
    frequency,
    isSharp
  };
}

/**
 * Generate all notes for a specific octave
 */
function generateOctaveNotes(octave: number, useFlats: boolean = false): NoteInfo[] {
  const startMidi = (octave + 1) * 12;
  const notes: NoteInfo[] = [];

  for (let i = 0; i < 12; i++) {
    const midiNumber = startMidi + i;
    if (midiNumber >= 0 && midiNumber <= 127) {
      notes.push(createNoteInfo(midiNumber, useFlats));
    }
  }

  return notes;
}

/**
 * Generate octave information
 */
function generateOctaveInfo(octave: number, useFlats: boolean = false): OctaveInfo {
  const notes = generateOctaveNotes(octave, useFlats);
  const startNote = (octave + 1) * 12;
  const description = OCTAVE_DESCRIPTIONS[octave] || `Octave ${octave}`;
  const range = `${useFlats ? FLAT_NAMES[0] : CHROMATIC_NOTES[0]}${octave} - ${useFlats ? FLAT_NAMES[11] : CHROMATIC_NOTES[11]}${octave}`;

  return {
    octave,
    name: description,
    range,
    startNote,
    notes
  };
}

/**
 * Get all available octaves (MIDI range 0-127 supports octaves -1 to 9)
 */
export function getAllOctaves(useFlats: boolean = false): OctaveInfo[] {
  const octaves: OctaveInfo[] = [];

  for (let octave = -1; octave <= 9; octave++) {
    octaves.push(generateOctaveInfo(octave, useFlats));
  }

  return octaves;
}

/**
 * Get all available notes across all octaves
 */
export function getAllNotes(useFlats: boolean = false): NoteInfo[] {
  const allNotes: NoteInfo[] = [];

  for (let midiNumber = 0; midiNumber <= 127; midiNumber++) {
    allNotes.push(createNoteInfo(midiNumber, useFlats));
  }

  return allNotes;
}

/**
 * Get notes for a specific octave
 */
export function getNotesForOctave(octave: number, useFlats: boolean = false): NoteInfo[] {
  return generateOctaveNotes(octave, useFlats);
}

/**
 * Get octave information for a specific octave
 */
export function getOctaveInfo(octave: number, useFlats: boolean = false): OctaveInfo {
  return generateOctaveInfo(octave, useFlats);
}

/**
 * Find note information by MIDI number
 */
export function getNoteByMidiNumber(midiNumber: number, useFlats: boolean = false): NoteInfo | null {
  if (midiNumber < 0 || midiNumber > 127) {
    return null;
  }
  return createNoteInfo(midiNumber, useFlats);
}

/**
 * Find note information by name (e.g., "C4", "F#2")
 */
export function getNoteByName(noteName: string): NoteInfo | null {
  // Parse note name (e.g., "C#4" -> note="C#", octave=4)
  const match = noteName.match(/^([A-G][#b]?)(-?\d+)$/);
  if (!match) {
    return null;
  }

  const [, note, octaveStr] = match;
  const octave = parseInt(octaveStr);

  // Find the note index
  let noteIndex = CHROMATIC_NOTES.indexOf(note);
  if (noteIndex === -1) {
    noteIndex = FLAT_NAMES.indexOf(note);
  }
  if (noteIndex === -1) {
    return null;
  }

  const midiNumber = (octave + 1) * 12 + noteIndex;

  if (midiNumber < 0 || midiNumber > 127) {
    return null;
  }

  return createNoteInfo(midiNumber);
}

/**
 * Get commonly used notes for quick selection
 */
export function getCommonNotes(): NoteInfo[] {
  const commonMidiNumbers = [
    36,  // C2 (Kick)
    38,  // D2 (Snare)
    42,  // F#2 (Closed Hi-hat)
    46,  // A#2 (Open Hi-hat)
    48,  // C3 (Low Tom)
    50,  // D3
    52,  // E3
    55,  // G3
    57,  // A3
    60,  // C4 (Middle C)
    64,  // E4
    67,  // G4
    72,  // C5
    76,  // E5
    79,  // G5
    84,  // C6
  ];

  return commonMidiNumbers.map(midi => createNoteInfo(midi));
}

/**
 * Get drum kit mapping (General MIDI standard)
 */
export function getDrumKitNotes(): NoteInfo[] {
  const drumNotes = [
    { midi: 35, name: 'Acoustic Bass Drum' },
    { midi: 36, name: 'Bass Drum 1' },
    { midi: 37, name: 'Side Stick' },
    { midi: 38, name: 'Acoustic Snare' },
    { midi: 39, name: 'Hand Clap' },
    { midi: 40, name: 'Electric Snare' },
    { midi: 41, name: 'Low Floor Tom' },
    { midi: 42, name: 'Closed Hi Hat' },
    { midi: 43, name: 'High Floor Tom' },
    { midi: 44, name: 'Pedal Hi-Hat' },
    { midi: 45, name: 'Low Tom' },
    { midi: 46, name: 'Open Hi-Hat' },
    { midi: 47, name: 'Low-Mid Tom' },
    { midi: 48, name: 'Hi Mid Tom' },
    { midi: 49, name: 'Crash Cymbal 1' },
    { midi: 50, name: 'High Tom' },
    { midi: 51, name: 'Ride Cymbal 1' },
    { midi: 52, name: 'Chinese Cymbal' },
    { midi: 53, name: 'Ride Bell' },
    { midi: 54, name: 'Tambourine' },
    { midi: 55, name: 'Splash Cymbal' },
    { midi: 56, name: 'Cowbell' },
    { midi: 57, name: 'Crash Cymbal 2' },
    { midi: 58, name: 'Vibraslap' },
    { midi: 59, name: 'Ride Cymbal 2' },
  ];

  return drumNotes.map(drum => {
    const noteInfo = createNoteInfo(drum.midi);
    return {
      ...noteInfo,
      name: `${noteInfo.name} (${drum.name})`
    };
  });
}

// Export commonly used octaves
export const OCTAVE_RANGES = {
  SUB_CONTRA: -1,
  CONTRA: 0,
  GREAT: 1,
  SMALL: 2,
  ONE_LINE: 3,
  TWO_LINE: 4,  // Middle octave
  THREE_LINE: 5,
  FOUR_LINE: 6,
  FIVE_LINE: 7,
  SIX_LINE: 8,
  SEVEN_LINE: 9
} as const;

// Export note constants
export const MIDDLE_C = 60;
export const A440 = 69;
