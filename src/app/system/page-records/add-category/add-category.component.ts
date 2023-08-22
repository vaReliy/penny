import {
  ChangeDetectionStrategy,
  Component,
  EventEmitter,
  Output,
} from '@angular/core';
import { NgForm } from '@angular/forms';

import { Message } from '../../../shared/models/message.model';
import { Category } from '../../common/models/category.model';

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
    this.addCategory.emit(
      new Category(categoryName, categoryCapacity < 0 ? 0 : categoryCapacity)
    );
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
