import { Component, signal, computed } from '@angular/core';

@Component({
  selector: 'app-midi-grid',
  standalone: true,
  templateUrl: './midi-grid.html',
  imports: [],
})
export class MidiGridComponent {
  // Grid configuration
  readonly GRID_COLS = 16;
  readonly GRID_ROWS = 8;
  readonly TOTAL_BLOCKS = 128;

  // Active blocks state
  readonly activeBlocks = signal<Set<number>>(new Set());

  // Computed properties
  readonly blocks = computed(() => {
    const blocks = [];
    for (let i = 0; i < this.TOTAL_BLOCKS; i++) {
      blocks.push({
        id: i,
        midiNote: i,
        row: Math.floor(i / this.GRID_COLS),
        col: i % this.GRID_COLS,
        isActive: this.activeBlocks().has(i),
      });
    }
    return blocks;
  });

  // Methods
  toggleBlock(blockId: number): void {
    const current = new Set(this.activeBlocks());
    if (current.has(blockId)) {
      current.delete(blockId);
    } else {
      current.add(blockId);
    }
    this.activeBlocks.set(current);
  }

  clearAll(): void {
    this.activeBlocks.set(new Set());
  }

  getBlockNote(blockId: number): string {
    const notes = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];
    const octave = Math.floor(blockId / 12) - 1;
    const noteIndex = blockId % 12;
    return `${notes[noteIndex]}${octave}`;
  }

  getBlockNoteName(blockId: number): string {
    const notes = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];
    const noteIndex = blockId % 12;
    return notes[noteIndex];
  }
}
