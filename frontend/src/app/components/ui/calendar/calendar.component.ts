import { Component, AfterViewInit, ElementRef, Input } from '@angular/core';
import flatpickr from 'flatpickr';

@Component({
  selector: 'app-calendar',
  standalone: true,
  templateUrl: './calendar.component.html',
  styleUrls: ['./calendar.component.scss']
})
export class CalendarComponent implements AfterViewInit {
  @Input() value: Date | null = null;
  @Input() onChange: ((date: Date) => void) | null = null;

  constructor(private el: ElementRef) {}

  ngAfterViewInit() {
    flatpickr(this.el.nativeElement.querySelector('.calendar'), {
      defaultDate: this.value || undefined,
      onChange: (dates: Date[]) => {
        if (dates[0] && this.onChange) this.onChange(dates[0]);
      }
    });
  }
}
