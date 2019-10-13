import { Component, EventEmitter, Input, OnInit, Output } from '@angular/core';
import { NgForm } from '@angular/forms';

import { Message } from '../../../shared/models/message.model';
import { Category } from '../../shared/models/category.model';
import { AppEvent } from '../../shared/models/app-event.model';

@Component({
  selector: 'app-add-event',
  templateUrl: './add-event.component.html',
  styleUrls: ['./add-event.component.scss']
})
export class AddEventComponent implements OnInit {
  @Input() categories: Category[];
  @Input() currentBillValue: number;
  @Output() addAppEvent = new EventEmitter<AppEvent>();
  eventTypes = [
    {type: 'income', label: 'Прибуток'},
    {type: 'outcome', label: 'Витрата'},
  ];
  alertMessage: Message = {text: '', type: 'danger'};

  constructor() { }

  ngOnInit() {
  }

  onSubmit(form: NgForm) {
    const {type, amount, category, description} = form.value;
    if (amount > this.currentBillValue) {
      this.showAlertMessage(`Недостатньо коштів для операції. Поточний рахунок: ${this.currentBillValue}грн`);
      return;
    }
    this.addAppEvent.emit(new AppEvent(type, amount, category, null, description));
    this.setDefaults(form);
  }

  private setDefaults(form: NgForm) {
    form.setValue({
      type: 'outcome',
      amount: '',
      category: '',
      description: '',
    });
  }

  private showAlertMessage(text: string, time: number = 5000) {
    this.alertMessage.text = text;
    setTimeout(() => {
      this.alertMessage.text = '';
    }, time);
  }

}
