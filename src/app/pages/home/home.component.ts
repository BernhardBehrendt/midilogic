import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { LabComponent } from '../../components/lab/lab.component';

@Component({
  selector: 'ml-home',
  standalone: true,
  imports: [CommonModule, LabComponent],
  templateUrl: './home.component.html',
  styleUrl: './home.component.css',
})
export class HomeComponent {
  protected readonly appName = 'MidiLogic';
  protected readonly version = '1.0.0';
  protected readonly features = [
    {
      title: 'Mathematical Patterns',
      description: 'Create complex rhythms using mathematical algorithms and pattern generation',
      icon: 'bi-calculator',
    },
    {
      title: 'MIDI Integration',
      description:
        'Connect to external MIDI devices and DAWs like Ableton Live for seamless integration',
      icon: 'bi-music-note-beamed',
    },
    {
      title: 'Real-time Sequencing',
      description:
        'Step sequencer with real-time playback and visual feedback for immediate results',
      icon: 'bi-clock',
    },
    {
      title: 'Pattern Library',
      description:
        'Save and recall your favorite patterns, build a library of mathematical rhythms',
      icon: 'bi-collection',
    },
  ];
}
