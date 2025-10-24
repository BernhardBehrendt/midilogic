import { Component } from '@angular/core';
import { MidiGridComponent } from '../../components/midi-grid/midi-grid';

@Component({
  selector: 'ml-matrix',
  standalone: true,
  imports: [MidiGridComponent],
  templateUrl: './matrix.html',
})
export class Matrix {}
