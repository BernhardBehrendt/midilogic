import {
  getAllOctaves,
  getAllNotes,
  getNotesForOctave,
  getOctaveInfo,
  getNoteByMidiNumber,
  getNoteByName,
  getCommonNotes,
  getDrumKitNotes,
  MIDDLE_C,
  A440,
  OCTAVE_RANGES,
  NoteInfo,
  OctaveInfo
} from './note-mapping';

describe('NoteMapping', () => {
  describe('getNoteByMidiNumber', () => {
    it('should return correct note info for Middle C', () => {
      const noteInfo = getNoteByMidiNumber(MIDDLE_C);
      expect(noteInfo).toBeTruthy();
      expect(noteInfo!.name).toBe('C4');
      expect(noteInfo!.noteName).toBe('C');
      expect(noteInfo!.octave).toBe(4);
      expect(noteInfo!.value).toBe(60);
      expect(noteInfo!.isSharp).toBe(false);
    });

    it('should return correct note info for A440', () => {
      const noteInfo = getNoteByMidiNumber(A440);
      expect(noteInfo).toBeTruthy();
      expect(noteInfo!.name).toBe('A4');
      expect(noteInfo!.noteName).toBe('A');
      expect(noteInfo!.octave).toBe(4);
      expect(noteInfo!.value).toBe(69);
      expect(noteInfo!.frequency).toBeCloseTo(440, 1);
    });

    it('should return correct note info for sharp notes', () => {
      const noteInfo = getNoteByMidiNumber(61); // C#4
      expect(noteInfo).toBeTruthy();
      expect(noteInfo!.name).toBe('C#4');
      expect(noteInfo!.noteName).toBe('C#');
      expect(noteInfo!.isSharp).toBe(true);
    });

    it('should return flat names when requested', () => {
      const noteInfo = getNoteByMidiNumber(61, true); // Db4
      expect(noteInfo).toBeTruthy();
      expect(noteInfo!.name).toBe('Db4');
      expect(noteInfo!.noteName).toBe('Db');
      expect(noteInfo!.isSharp).toBe(true);
    });

    it('should return null for invalid MIDI numbers', () => {
      expect(getNoteByMidiNumber(-1)).toBeNull();
      expect(getNoteByMidiNumber(128)).toBeNull();
    });

    it('should handle boundary cases', () => {
      const lowest = getNoteByMidiNumber(0);
      expect(lowest).toBeTruthy();
      expect(lowest!.name).toBe('C-1');

      const highest = getNoteByMidiNumber(127);
      expect(highest).toBeTruthy();
      expect(highest!.name).toBe('G9');
    });
  });

  describe('getNoteByName', () => {
    it('should find notes by name correctly', () => {
      const middleC = getNoteByName('C4');
      expect(middleC).toBeTruthy();
      expect(middleC!.value).toBe(60);
      expect(middleC!.octave).toBe(4);
    });

    it('should find sharp notes by name', () => {
      const fSharp = getNoteByName('F#2');
      expect(fSharp).toBeTruthy();
      expect(fSharp!.noteName).toBe('F#');
      expect(fSharp!.octave).toBe(2);
    });

    it('should find flat notes by name', () => {
      const gFlat = getNoteByName('Gb3');
      expect(gFlat).toBeTruthy();
      expect(gFlat!.noteName).toBe('F#'); // Should return sharp equivalent
      expect(gFlat!.octave).toBe(3);
    });

    it('should handle negative octaves', () => {
      const subContra = getNoteByName('C-1');
      expect(subContra).toBeTruthy();
      expect(subContra!.value).toBe(0);
      expect(subContra!.octave).toBe(-1);
    });

    it('should return null for invalid note names', () => {
      expect(getNoteByName('H4')).toBeNull(); // Invalid note name
      expect(getNoteByName('C')).toBeNull();  // Missing octave
      expect(getNoteByName('C10')).toBeNull(); // Out of range
    });
  });

  describe('getNotesForOctave', () => {
    it('should return 12 notes for middle octave', () => {
      const notes = getNotesForOctave(4);
      expect(notes).toHaveLength(12);
      expect(notes[0].name).toBe('C4');
      expect(notes[11].name).toBe('B4');
    });

    it('should return notes with correct octave numbers', () => {
      const notes = getNotesForOctave(2);
      notes.forEach(note => {
        expect(note.octave).toBe(2);
      });
    });

    it('should handle flat notation', () => {
      const notes = getNotesForOctave(3, true);
      const secondNote = notes[1];
      expect(secondNote.noteName).toBe('Db');
    });

    it('should handle edge case octaves', () => {
      const subContra = getNotesForOctave(-1);
      expect(subContra[0].name).toBe('C-1');

      const high = getNotesForOctave(8);
      expect(high[0].name).toBe('C8');
    });
  });

  describe('getOctaveInfo', () => {
    it('should return correct octave information', () => {
      const octaveInfo = getOctaveInfo(4);
      expect(octaveInfo.octave).toBe(4);
      expect(octaveInfo.name).toBe('Two-line Octave (Middle)');
      expect(octaveInfo.range).toBe('C4 - B4');
      expect(octaveInfo.startNote).toBe(60);
      expect(octaveInfo.notes).toHaveLength(12);
    });

    it('should handle special octave descriptions', () => {
      const great = getOctaveInfo(1);
      expect(great.name).toBe('Great Octave');

      const small = getOctaveInfo(2);
      expect(small.name).toBe('Small Octave');
    });
  });

  describe('getAllOctaves', () => {
    it('should return all valid octaves', () => {
      const octaves = getAllOctaves();
      expect(octaves).toHaveLength(11); // -1 to 9
      expect(octaves[0].octave).toBe(-1);
      expect(octaves[10].octave).toBe(9);
    });

    it('should return octaves with flat notation when requested', () => {
      const octaves = getAllOctaves(true);
      expect(octaves[5].range).toBe('C4 - B4'); // Should still show C and B
    });
  });

  describe('getAllNotes', () => {
    it('should return all 128 MIDI notes', () => {
      const notes = getAllNotes();
      expect(notes).toHaveLength(128);
      expect(notes[0].value).toBe(0);
      expect(notes[127].value).toBe(127);
    });

    it('should return sequential MIDI values', () => {
      const notes = getAllNotes();
      for (let i = 0; i < notes.length; i++) {
        expect(notes[i].value).toBe(i);
      }
    });
  });

  describe('getCommonNotes', () => {
    it('should return a reasonable set of common notes', () => {
      const notes = getCommonNotes();
      expect(notes.length).toBeGreaterThan(10);
      expect(notes.length).toBeLessThan(30);

      // Should include Middle C
      const middleC = notes.find(note => note.value === 60);
      expect(middleC).toBeTruthy();
    });

    it('should include typical drum notes', () => {
      const notes = getCommonNotes();
      const kickDrum = notes.find(note => note.value === 36);
      const snare = notes.find(note => note.value === 38);
      expect(kickDrum).toBeTruthy();
      expect(snare).toBeTruthy();
    });
  });

  describe('getDrumKitNotes', () => {
    it('should return standard GM drum kit notes', () => {
      const drumNotes = getDrumKitNotes();
      expect(drumNotes.length).toBeGreaterThan(20);

      // Check for essential drum sounds
      const kick = drumNotes.find(note => note.value === 36);
      const snare = drumNotes.find(note => note.value === 38);
      const hihat = drumNotes.find(note => note.value === 42);

      expect(kick).toBeTruthy();
      expect(snare).toBeTruthy();
      expect(hihat).toBeTruthy();
    });

    it('should include drum names in note descriptions', () => {
      const drumNotes = getDrumKitNotes();
      const kick = drumNotes.find(note => note.value === 36);
      expect(kick!.name).toContain('Bass Drum');
    });
  });

  describe('frequency calculations', () => {
    it('should calculate correct frequencies', () => {
      const a440 = getNoteByMidiNumber(69);
      expect(a440!.frequency).toBeCloseTo(440, 1);

      const a880 = getNoteByMidiNumber(81); // A5, one octave higher
      expect(a880!.frequency).toBeCloseTo(880, 1);

      const a220 = getNoteByMidiNumber(57); // A3, one octave lower
      expect(a220!.frequency).toBeCloseTo(220, 1);
    });

    it('should follow equal temperament tuning', () => {
      const c4 = getNoteByMidiNumber(60);
      const c5 = getNoteByMidiNumber(72);

      // C5 should be exactly double the frequency of C4
      expect(c5!.frequency).toBeCloseTo(c4!.frequency * 2, 1);
    });
  });

  describe('constants', () => {
    it('should have correct constant values', () => {
      expect(MIDDLE_C).toBe(60);
      expect(A440).toBe(69);
    });

    it('should have correct octave range constants', () => {
      expect(OCTAVE_RANGES.TWO_LINE).toBe(4); // Middle octave
      expect(OCTAVE_RANGES.SUB_CONTRA).toBe(-1);
      expect(OCTAVE_RANGES.SEVEN_LINE).toBe(9);
    });
  });

  describe('edge cases and error handling', () => {
    it('should handle chromatic sequence correctly', () => {
      // Test a full chromatic sequence
      for (let i = 60; i < 72; i++) {
        const note = getNoteByMidiNumber(i);
        expect(note).toBeTruthy();
        expect(note!.value).toBe(i);
        expect(note!.octave).toBe(4);
      }
    });

    it('should maintain consistency between sharp and flat representations', () => {
      const sharpNote = getNoteByMidiNumber(61, false); // C#4
      const flatNote = getNoteByMidiNumber(61, true);   // Db4

      expect(sharpNote!.value).toBe(flatNote!.value);
      expect(sharpNote!.octave).toBe(flatNote!.octave);
      expect(sharpNote!.frequency).toBe(flatNote!.frequency);
      expect(sharpNote!.isSharp).toBe(flatNote!.isSharp);
    });
  });
});
