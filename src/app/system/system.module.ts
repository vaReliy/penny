import { CommonModule } from '@angular/common';
import { NgModule } from '@angular/core';

import { BillCardComponent } from './page-bill/bill-card/bill-card.component';
import { CurrencyCardComponent } from './page-bill/currency-card/currency-card.component';
import { PageBillComponent } from './page-bill/page-bill.component';
import { PageHistoryComponent } from './page-history/page-history.component';
import { PagePlannerComponent } from './page-planner/page-planner.component';
import { PageRecordsComponent } from './page-records/page-records.component';
import { HeaderComponent } from './shared/components/header/header.component';
import { SidebarComponent } from './shared/components/sidebar/sidebar.component';
import { DropdownDirective } from './shared/directives/dropdown.directive';
import { BillService } from './shared/services/bill.service';
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
  ],
  imports: [
    SystemRoutingModule,
    CommonModule
  ],
  providers: [
    BillService
  ],
})
export class SystemModule { }
