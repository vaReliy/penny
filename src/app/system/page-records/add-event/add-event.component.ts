import {
  ChangeDetectionStrategy,
  Component,
  EventEmitter,
  Input,
  OnInit,
  Output,
} from '@angular/core';
import { NgForm } from '@angular/forms';
import * as dayjs from 'dayjs';

import { Message } from '../../../shared/models/message.model';
import { DATE_FORMAT } from '../../common/constats';
import { AppEvent } from '../../common/models/app-event.model';
import { Bill } from '../../common/models/bill.model';
import { Category } from '../../common/models/category.model';
import { flatDtoToInstance } from '../../common/services/dto-transformer';

@Component({
  selector: 'app-add-event',
  templateUrl: './add-event.component.html',
  styleUrls: ['./add-event.component.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush,
  standalone: false,
})
export class AddEventComponent implements OnInit {
  @Input() categories: Category[];
  @Input() currentBill: Bill;
  @Output() addAppEvent = new EventEmitter<AppEvent>();
  eventTypes = [];
  alertMessage: Message = { text: '', type: 'danger' };

  ngOnInit() {
    this.generateEventTypes();
  }

  onSubmit(form: NgForm) {
    const { type, amount, category, description } = form.value;
    if (amount > this.currentBill.value) {
      this.showAlertMessage(
        `Недостатньо коштів для операції. Поточний рахунок: ${this.currentBill.value}${this.currentBill.currency}`,
        'danger'
      );
      return;
    }
    const date = dayjs().format(DATE_FORMAT);
    const eDto = {
      type,
      amount,
      date,
      description,
      category: +category,
    };
    const event = flatDtoToInstance<AppEvent>(eDto, AppEvent);
    this.addAppEvent.emit(event);
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

  private showAlertMessage(text: string, type = 'success', time = 5000) {
    this.alertMessage = { text, type };
    setTimeout(() => {
      this.alertMessage.text = '';
    }, time);
  }

  private generateEventTypes() {
    AppEvent.TYPES.forEach(type => {
      this.eventTypes.push({ type, label: AppEvent.getLabel(type) });
    });
  }
}
