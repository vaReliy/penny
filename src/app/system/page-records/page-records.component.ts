import { Component, OnInit } from '@angular/core';

import { Category } from '../shared/models/category.model';
import { CategoriesService } from '../shared/services/categories.service';

@Component({
  selector: 'app-page-records',
  templateUrl: './page-records.component.html',
  styleUrls: ['./page-records.component.scss']
})
export class PageRecordsComponent implements OnInit {
  isLoaded = false;
  categories: Category[];

  constructor(
    private categoryService: CategoriesService,
  ) { }

  ngOnInit() {
    this.categoryService.getCategories()
      .subscribe((categories) => {
        this.categories = categories;
        this.isLoaded = true;
      });
  }

  onAddCategory(category: Category) {
    this.categoryService.addCategory(category)
      .subscribe((addedCategory: Category) => {
        this.categories.push(addedCategory);
      });
  }

  onEditCategory(category: Category) {
    this.categoryService.updateCategory(category)
      .subscribe((updatedCategory: Category) => {
        console.log('updatedCategory', updatedCategory);
      });
  }
}
