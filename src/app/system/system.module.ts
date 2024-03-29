import { CommonModule } from '@angular/common';
import { NgModule } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { PieChartModule } from '@swimlane/ngx-charts';

import { NgbModule } from '@ng-bootstrap/ng-bootstrap';
import { SharedModule } from '../shared/shared.module';
import { BillCardComponent } from './page-bill/bill-card/bill-card.component';
import { CurrencyCardComponent } from './page-bill/currency-card/currency-card.component';
import { PageBillComponent } from './page-bill/page-bill.component';
import { HistoryChartComponent } from './page-history/history-chart/history-chart.component';
import { HistoryDetailsComponent } from './page-history/history-details/history-details.component';
import { HistoryEventsComponent } from './page-history/history-events/history-events.component';
import { HistoryFilterComponent } from './page-history/history-filter/history-filter.component';
import { PageHistoryComponent } from './page-history/page-history.component';
import { PagePlannerComponent } from './page-planner/page-planner.component';
import { AddCategoryComponent } from './page-records/add-category/add-category.component';
import { AddEventComponent } from './page-records/add-event/add-event.component';
import { EditCategoryComponent } from './page-records/edit-category/edit-category.component';
import { PageRecordsComponent } from './page-records/page-records.component';
import { HeaderComponent } from './common/components/header/header.component';
import { DropdownDirective } from './common/directives/dropdown.directive';
import { EventsFilterPipe } from './common/pipes/events-filter.pipe';
import { AppEventService } from './common/services/app-event.service';
import { BillService } from './common/services/bill.service';
import { CategoriesService } from './common/services/categories.service';
import { SystemRoutingModule } from './system-routing.module';
import { SystemComponent } from './system.component';

@NgModule({
  declarations: [
    SystemComponent,
    PageBillComponent,
    PageHistoryComponent,
    PagePlannerComponent,
    PageRecordsComponent,
    HeaderComponent,
    DropdownDirective,
    BillCardComponent,
    CurrencyCardComponent,
    AddEventComponent,
    AddCategoryComponent,
    EditCategoryComponent,
    HistoryChartComponent,
    HistoryEventsComponent,
    HistoryDetailsComponent,
    HistoryFilterComponent,
    EventsFilterPipe,
  ],
  imports: [
    SystemRoutingModule,
    CommonModule,
    FormsModule,
    PieChartModule,
    SharedModule,
    NgbModule,
  ],
  providers: [BillService, CategoriesService, AppEventService],
})
export class SystemModule {}
