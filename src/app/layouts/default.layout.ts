import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterOutlet, RouterLink } from '@angular/router';
import { PlaybackControlComponent } from '../components/playback-control/playback-control';

@Component({
  selector: 'ml-default-layout',
  standalone: true,
  imports: [CommonModule, RouterOutlet, RouterLink, PlaybackControlComponent],
  templateUrl: './default.layout.html',
  styleUrl: './default.layout.css',
})
export class DefaultLayoutComponent {
  protected readonly appName = 'MidiLogic';
  protected readonly version = '1.0.0';
}
