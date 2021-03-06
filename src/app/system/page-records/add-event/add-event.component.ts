import { Component, EventEmitter, Input, OnInit, Output } from '@angular/core';
import { NgForm } from '@angular/forms';
import * as moment from 'moment';

import { Message } from '../../../shared/models/message.model';
import { AppEvent } from '../../shared/models/app-event.model';
import { Bill } from '../../shared/models/bill.model';
import { Category } from '../../shared/models/category.model';

@Component({
  selector: 'app-add-event',
  templateUrl: './add-event.component.html',
  styleUrls: ['./add-event.component.scss']
})
export class AddEventComponent implements OnInit {
  @Input() categories: Category[];
  @Input() currentBill: Bill;
  @Output() addAppEvent = new EventEmitter<AppEvent>();
  eventTypes = [];
  alertMessage: Message = {text: '', type: 'danger'};

  constructor() { }

  ngOnInit() {
    this.generateEventTypes();
  }

  onSubmit(form: NgForm) {
    const {type, amount, category, description} = form.value;
    if (amount > this.currentBill.value) {
      // tslint:disable-next-line:max-line-length
      this.showAlertMessage(`Недостатньо коштів для операції. Поточний рахунок: ${this.currentBill.value}${this.currentBill.currency}`, 'danger');
      return;
    }
    const date = moment().format('DD.MM.YYYY HH:mm:ss');
    this.addAppEvent.emit(new AppEvent(type, amount, +category, date, description));
    this.showAlertMessage(`Подію успішно додано!`);
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

  private showAlertMessage(text: string, type: string = 'success', time: number = 5000) {
    this.alertMessage = {text, type};
    setTimeout(() => {
      this.alertMessage.text = '';
    }, time);
  }

  private generateEventTypes() {
    AppEvent.TYPES.forEach(type => {
      this.eventTypes.push({type, label: AppEvent.getLabel(type)});
    });
  }
}
