import { CommonModule } from '@angular/common';
import { NgModule } from '@angular/core';

import { PageBillComponent } from './page-bill/page-bill.component';
import { PageHistoryComponent } from './page-history/page-history.component';
import { PagePlannerComponent } from './page-planner/page-planner.component';
import { PageRecordsComponent } from './page-records/page-records.component';
import { SystemRoutingModule } from './system-routing.module';
import { SystemComponent } from './system.component';

@NgModule({
  declarations: [
    SystemComponent,
    PageBillComponent,
    PageHistoryComponent,
    PagePlannerComponent,
    PageRecordsComponent,
  ],
  imports: [
    SystemRoutingModule,
    CommonModule
  ]
})
export class SystemModule { }
