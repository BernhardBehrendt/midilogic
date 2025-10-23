import { Component, inject, signal, computed, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { OfflineStorageService, MidiPattern } from '../../core/storage/offline-storage';
import { DataSyncService } from '../../core/sync/data-sync';
import { NetworkStatusService } from '../../core/network/network-status';
import { OfflineSettingsComponent } from '../../shared/offline-settings/offline-settings';

@Component({
  selector: 'ml-offline-demo',
  standalone: true,
  imports: [CommonModule, FormsModule, OfflineSettingsComponent],
  templateUrl: './offline-demo.html',
})
export class OfflineDemoComponent implements OnInit {
  private offlineStorage = inject(OfflineStorageService);
  private dataSync = inject(DataSyncService);
  private networkStatus = inject(NetworkStatusService);

  // Demo state
  readonly patterns = signal<MidiPattern[]>([]);
  readonly isLoading = signal(false);
  readonly error = signal<string | null>(null);

  // Form state
  readonly newPatternName = signal('');
  readonly newPatternNotes = signal('60,64,67,72'); // C major chord
  readonly newPatternChannel = signal(1);
  readonly newPatternVelocity = signal(100);

  // Service signals
  readonly isOnline = this.networkStatus.isOnline;
  readonly syncStatus = this.dataSync.syncStatus;
  readonly storageInitialized = this.offlineStorage.isInitialized;

  // Computed values
  readonly canCreatePattern = computed(() => {
    return this.newPatternName().trim().length > 0 && this.storageInitialized();
  });

  readonly totalPatterns = computed(() => this.patterns().length);

  readonly syncedPatterns = computed(() => this.patterns().filter((p) => p.synced).length);

  readonly unsyncedPatterns = computed(() => this.patterns().filter((p) => !p.synced).length);

  ngOnInit(): void {
    this.loadPatterns();
  }

  async loadPatterns(): Promise<void> {
    if (!this.storageInitialized()) {
      // Wait for storage to be ready
      const checkStorage = () => {
        if (this.storageInitialized()) {
          this.loadPatterns();
        } else {
          setTimeout(checkStorage, 100);
        }
      };
      checkStorage();
      return;
    }

    this.isLoading.set(true);
    this.error.set(null);

    try {
      const patterns = await this.offlineStorage.getAllPatterns();
      this.patterns.set(patterns);
    } catch (error) {
      console.error('Failed to load patterns:', error);
      this.error.set('Failed to load patterns');
    } finally {
      this.isLoading.set(false);
    }
  }

  async createPattern(): Promise<void> {
    if (!this.canCreatePattern()) return;

    this.isLoading.set(true);
    this.error.set(null);

    try {
      const notes = this.newPatternNotes()
        .split(',')
        .map((n) => parseInt(n.trim()))
        .filter((n) => !isNaN(n) && n >= 0 && n <= 127);

      if (notes.length === 0) {
        throw new Error('Invalid MIDI notes');
      }

      const pattern = {
        name: this.newPatternName().trim(),
        notes,
        timing: notes.map(() => 0.25), // Quarter notes
        channel: this.newPatternChannel(),
        velocity: notes.map(() => this.newPatternVelocity()),
      };

      const id = await this.offlineStorage.savePattern(pattern);

      // Queue for sync
      await this.dataSync.syncPattern({ ...pattern, id } as MidiPattern, 'create');

      // Reset form
      this.newPatternName.set('');
      this.newPatternNotes.set('60,64,67,72');
      this.newPatternChannel.set(1);
      this.newPatternVelocity.set(100);

      // Reload patterns
      await this.loadPatterns();
    } catch (error) {
      console.error('Failed to create pattern:', error);
      this.error.set(error instanceof Error ? error.message : 'Failed to create pattern');
    } finally {
      this.isLoading.set(false);
    }
  }

  async updatePattern(pattern: MidiPattern): Promise<void> {
    try {
      const updatedPattern = {
        ...pattern,
        name: pattern.name + ' (Updated)',
        modified: Date.now(),
      };

      await this.offlineStorage.updatePattern(pattern.id, updatedPattern);
      await this.dataSync.syncPattern(updatedPattern, 'update');
      await this.loadPatterns();
    } catch (error) {
      console.error('Failed to update pattern:', error);
      this.error.set('Failed to update pattern');
    }
  }

  async deletePattern(pattern: MidiPattern): Promise<void> {
    try {
      await this.offlineStorage.deletePattern(pattern.id);
      await this.dataSync.syncPattern(pattern, 'delete');
      await this.loadPatterns();
    } catch (error) {
      console.error('Failed to delete pattern:', error);
      this.error.set('Failed to delete pattern');
    }
  }

  async generateSampleData(): Promise<void> {
    this.isLoading.set(true);
    try {
      const samplePatterns = [
        {
          name: 'C Major Scale',
          notes: [60, 62, 64, 65, 67, 69, 71, 72],
          timing: [0.25, 0.25, 0.25, 0.25, 0.25, 0.25, 0.25, 0.25],
          channel: 1,
          velocity: [100, 95, 90, 85, 80, 85, 90, 95],
        },
        {
          name: 'Am Chord Progression',
          notes: [57, 60, 64, 67],
          timing: [1, 1, 1, 1],
          channel: 1,
          velocity: [110, 105, 100, 95],
        },
        {
          name: 'Kick Drum Pattern',
          notes: [36, 36, 36, 36],
          timing: [0.5, 0.5, 0.5, 0.5],
          channel: 10,
          velocity: [127, 100, 120, 100],
        },
      ];

      for (const pattern of samplePatterns) {
        const id = await this.offlineStorage.savePattern(pattern);
        await this.dataSync.syncPattern({ ...pattern, id } as MidiPattern, 'create');
      }

      await this.loadPatterns();
    } catch (error) {
      console.error('Failed to generate sample data:', error);
      this.error.set('Failed to generate sample data');
    } finally {
      this.isLoading.set(false);
    }
  }

  async clearAllPatterns(): Promise<void> {
    if (!confirm('Are you sure you want to delete all patterns?')) return;

    this.isLoading.set(true);
    try {
      const patterns = await this.offlineStorage.getAllPatterns();
      for (const pattern of patterns) {
        await this.offlineStorage.deletePattern(pattern.id);
        await this.dataSync.syncPattern(pattern, 'delete');
      }
      await this.loadPatterns();
    } catch (error) {
      console.error('Failed to clear patterns:', error);
      this.error.set('Failed to clear patterns');
    } finally {
      this.isLoading.set(false);
    }
  }

  formatNotes(notes: number[]): string {
    const noteNames = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];
    return notes
      .map((note) => {
        const octave = Math.floor(note / 12) - 1;
        const noteName = noteNames[note % 12];
        return `${noteName}${octave}`;
      })
      .join(', ');
  }

  formatDate(timestamp: number): string {
    return new Date(timestamp).toLocaleString();
  }

  getSyncStatusBadge(synced: boolean): string {
    return synced ? 'badge-success' : 'badge-warning';
  }

  getSyncStatusText(synced: boolean): string {
    return synced ? 'Synced' : 'Pending';
  }

  getSyncStatusIcon(synced: boolean): string {
    return synced ? 'bi-check-circle' : 'bi-clock';
  }

  trackByPatternId(index: number, pattern: MidiPattern): string {
    return pattern.id;
  }
}
