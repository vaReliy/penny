import {
  ChangeDetectionStrategy,
  Component,
  EventEmitter,
  Input,
  Output,
} from '@angular/core';
import { NgForm } from '@angular/forms';

import { Message } from '../../../shared/models/message.model';
import { Category } from '../../common/models/category.model';

@Component({
  selector: 'app-edit-category',
  templateUrl: './edit-category.component.html',
  styleUrls: ['./edit-category.component.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class EditCategoryComponent {
  @Input() categories: Category[];
  @Output() editCategory = new EventEmitter<Category>();
  selectedCategoryId: number;
  currentCategory: Category;
  alertMessage: Message = { text: '', type: '' };

  onOptionSelect() {
    this.currentCategory = this.categories.find(
      el => el.id === Number(this.selectedCategoryId)
    );
  }

  onSubmit(form: NgForm) {
    const { categoryName, categoryValue: categoryCapacity } = form.value;
    this.currentCategory.name = categoryName;
    this.currentCategory.capacity = categoryCapacity;
    this.editCategory.emit(this.currentCategory);
    this.showAlertMessage('Категорію оновлено!');
    this.resetForm(form);
  }

  private resetForm(form: NgForm) {
    this.currentCategory = null;
    form.reset();
  }

  private showAlertMessage(text: string, type = 'success', time = 5000) {
    this.alertMessage = { text, type };
    setTimeout(() => {
      this.alertMessage.text = '';
    }, time);
  }
}
