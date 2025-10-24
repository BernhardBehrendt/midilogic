import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideZonelessChangeDetection } from '@angular/core';
import { MidiGridComponent } from './midi-grid';

describe('MidiGridComponent', () => {
  let component: MidiGridComponent;
  let fixture: ComponentFixture<MidiGridComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [MidiGridComponent],
      providers: [provideZonelessChangeDetection()],
    }).compileComponents();

    fixture = TestBed.createComponent(MidiGridComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  it('should have correct grid configuration', () => {
    expect(component.GRID_COLS).toBe(16);
    expect(component.GRID_ROWS).toBe(8);
    expect(component.TOTAL_BLOCKS).toBe(128);
  });

  it('should generate 128 blocks with correct properties', () => {
    const blocks = component.blocks();

    expect(blocks.length).toBe(128);

    // Check first block
    expect(blocks[0]).toEqual({
      id: 0,
      midiNote: 0,
      row: 0,
      col: 0,
      isActive: false,
    });

    // Check last block
    expect(blocks[127]).toEqual({
      id: 127,
      midiNote: 127,
      row: 7,
      col: 15,
      isActive: false,
    });

    // Check a middle block
    expect(blocks[64]).toEqual({
      id: 64,
      midiNote: 64,
      row: 4,
      col: 0,
      isActive: false,
    });
  });

  it('should toggle block activation correctly', () => {
    const blockId = 64;

    // Initially inactive
    expect(component.activeBlocks().has(blockId)).toBe(false);
    expect(component.blocks()[blockId].isActive).toBe(false);

    // Toggle to active
    component.toggleBlock(blockId);
    expect(component.activeBlocks().has(blockId)).toBe(true);
    expect(component.blocks()[blockId].isActive).toBe(true);

    // Toggle back to inactive
    component.toggleBlock(blockId);
    expect(component.activeBlocks().has(blockId)).toBe(false);
    expect(component.blocks()[blockId].isActive).toBe(false);
  });

  it('should clear all active blocks', () => {
    // Activate multiple blocks
    component.toggleBlock(10);
    component.toggleBlock(20);
    component.toggleBlock(30);

    expect(component.activeBlocks().size).toBe(3);

    // Clear all
    component.clearAll();

    expect(component.activeBlocks().size).toBe(0);
    expect(component.blocks().every((block) => !block.isActive)).toBe(true);
  });

  it('should return correct MIDI note names', () => {
    // Test specific MIDI notes
    expect(component.getBlockNote(0)).toBe('C-1'); // MIDI note 0
    expect(component.getBlockNote(12)).toBe('C0'); // MIDI note 12
    expect(component.getBlockNote(60)).toBe('C4'); // Middle C
    expect(component.getBlockNote(69)).toBe('A4'); // A440
    expect(component.getBlockNote(127)).toBe('G9'); // Highest MIDI note

    // Test chromatic sequence
    expect(component.getBlockNote(0)).toBe('C-1');
    expect(component.getBlockNote(1)).toBe('C#-1');
    expect(component.getBlockNote(2)).toBe('D-1');
    expect(component.getBlockNote(3)).toBe('D#-1');
    expect(component.getBlockNote(4)).toBe('E-1');
    expect(component.getBlockNote(5)).toBe('F-1');
    expect(component.getBlockNote(6)).toBe('F#-1');
    expect(component.getBlockNote(7)).toBe('G-1');
    expect(component.getBlockNote(8)).toBe('G#-1');
    expect(component.getBlockNote(9)).toBe('A-1');
    expect(component.getBlockNote(10)).toBe('A#-1');
    expect(component.getBlockNote(11)).toBe('B-1');
  });

  it('should return correct note names without octave', () => {
    expect(component.getBlockNoteName(0)).toBe('C');
    expect(component.getBlockNoteName(1)).toBe('C#');
    expect(component.getBlockNoteName(2)).toBe('D');
    expect(component.getBlockNoteName(11)).toBe('B');
    expect(component.getBlockNoteName(12)).toBe('C'); // Next octave
    expect(component.getBlockNoteName(127)).toBe('G');
  });

  it('should calculate correct row and column positions', () => {
    const blocks = component.blocks();

    // Test first row (blocks 0-15)
    for (let i = 0; i < 16; i++) {
      expect(blocks[i].row).toBe(0);
      expect(blocks[i].col).toBe(i);
    }

    // Test second row (blocks 16-31)
    for (let i = 16; i < 32; i++) {
      expect(blocks[i].row).toBe(1);
      expect(blocks[i].col).toBe(i - 16);
    }

    // Test last row (blocks 112-127)
    for (let i = 112; i < 128; i++) {
      expect(blocks[i].row).toBe(7);
      expect(blocks[i].col).toBe(i - 112);
    }
  });

  it('should handle multiple active blocks independently', () => {
    const blockIds = [0, 15, 64, 127];

    // Activate multiple blocks
    blockIds.forEach((id) => component.toggleBlock(id));

    expect(component.activeBlocks().size).toBe(4);
    blockIds.forEach((id) => {
      expect(component.activeBlocks().has(id)).toBe(true);
      expect(component.blocks()[id].isActive).toBe(true);
    });

    // Deactivate one block
    component.toggleBlock(64);

    expect(component.activeBlocks().size).toBe(3);
    expect(component.activeBlocks().has(64)).toBe(false);
    expect(component.blocks()[64].isActive).toBe(false);

    // Other blocks should remain active
    [0, 15, 127].forEach((id) => {
      expect(component.activeBlocks().has(id)).toBe(true);
      expect(component.blocks()[id].isActive).toBe(true);
    });
  });
});
