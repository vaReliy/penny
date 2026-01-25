import {
  ChangeDetectionStrategy,
  Component,
  EventEmitter,
  Output,
} from '@angular/core';
import { NgForm } from '@angular/forms';

import { Message } from '../../../shared/models/message.model';
import { Category } from '../../common/models/category.model';
import { flatDtoToInstance } from '../../common/services/dto-transformer';

@Component({
  selector: 'app-add-category',
  templateUrl: './add-category.component.html',
  styleUrls: ['./add-category.component.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class AddCategoryComponent {
  @Output() addCategory = new EventEmitter<Category>();
  alertMessage: Message = { text: '', type: '' };

  onSubmit(form: NgForm) {
    const { categoryName, categoryValue: categoryCapacity } = form.value;
    const category = flatDtoToInstance<Category>(
      {
        name: categoryName,
        capacity: categoryCapacity < 0 ? 0 : categoryCapacity,
      },
      Category
    );
    this.addCategory.emit(category);
    this.showAlertMessage('Категорію додано!');
    form.reset();
  }

  private showAlertMessage(text: string, type = 'success', time = 5000) {
    this.alertMessage = { text, type };
    setTimeout(() => {
      this.alertMessage.text = '';
    }, time);
  }
}
