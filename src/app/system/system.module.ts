import { CommonModule } from '@angular/common';
import { NgModule } from '@angular/core';
import { FormsModule } from '@angular/forms';

import { BillCardComponent } from './page-bill/bill-card/bill-card.component';
import { CurrencyCardComponent } from './page-bill/currency-card/currency-card.component';
import { PageBillComponent } from './page-bill/page-bill.component';
import { PageHistoryComponent } from './page-history/page-history.component';
import { PagePlannerComponent } from './page-planner/page-planner.component';
import { AddCategoryComponent } from './page-records/add-category/add-category.component';
import { AddEventComponent } from './page-records/add-event/add-event.component';
import { EditCategoryComponent } from './page-records/edit-category/edit-category.component';
import { PageRecordsComponent } from './page-records/page-records.component';
import { HeaderComponent } from './shared/components/header/header.component';
import { SidebarComponent } from './shared/components/sidebar/sidebar.component';
import { DropdownDirective } from './shared/directives/dropdown.directive';
import { AppEventService } from './shared/services/app-event.service';
import { BillService } from './shared/services/bill.service';
import { CategoriesService } from './shared/services/categories.service';
import { SystemRoutingModule } from './system-routing.module';
import { SystemComponent } from './system.component';

@NgModule({
  declarations: [
    SystemComponent,
    PageBillComponent,
    PageHistoryComponent,
    PagePlannerComponent,
    PageRecordsComponent,
    SidebarComponent,
    HeaderComponent,
    DropdownDirective,
    BillCardComponent,
    CurrencyCardComponent,
    AddEventComponent,
    AddCategoryComponent,
    EditCategoryComponent,
  ],
  imports: [
    SystemRoutingModule,
    CommonModule,
    FormsModule,
  ],
  providers: [
    BillService,
    CategoriesService,
    AppEventService,
  ],
})
export class SystemModule { }
