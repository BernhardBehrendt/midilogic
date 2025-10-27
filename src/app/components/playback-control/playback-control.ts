import { Component, inject, computed } from '@angular/core';
import { CommonModule } from '@angular/common';
import { PlaybackService } from '../../services/playback.service';

@Component({
  selector: 'ml-playback-control',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './playback-control.html',
})
export class PlaybackControlComponent {
  private playbackService = inject(PlaybackService);

  // Expose playback state to template
  protected readonly isEnabled = this.playbackService.isEnabled;
  protected readonly isPlaying = this.playbackService.isPlaying;
  protected readonly playbackStatus = this.playbackService.playbackStatus;
  protected readonly playbackStatusBadge = this.playbackService.playbackStatusBadge;
  protected readonly enabledNoteCount = this.playbackService.enabledNoteCount;
  protected readonly enabledControlCount = this.playbackService.enabledControlCount;
  protected readonly canPlay = computed(() => this.playbackService.canPlay());

  // Control methods
  protected toggleEnabled() {
    if (this.isEnabled()) {
      this.playbackService.disablePlayback();
    } else {
      this.playbackService.enablePlayback();
    }
  }

  protected togglePlayback() {
    this.playbackService.togglePlayback();
  }

  protected manualTrigger() {
    this.playbackService.manualTrigger();
  }
}
