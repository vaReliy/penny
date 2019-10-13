import { Component, OnInit } from '@angular/core';

import { Category } from '../shared/models/category.model';
import { CategoriesService } from '../shared/services/categories.service';

@Component({
  selector: 'app-page-records',
  templateUrl: './page-records.component.html',
  styleUrls: ['./page-records.component.scss']
})
export class PageRecordsComponent implements OnInit {

  constructor(
    private categoryService: CategoriesService,
  ) { }

  ngOnInit() {
  }

  onAddCategory(category: Category) {
    this.categoryService.addCategory(category)
      .subscribe((addedCategory: Category) => {
        console.log('addedCategory:', addedCategory);
      });
  }
}
