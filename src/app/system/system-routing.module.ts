import { NgModule } from '@angular/core';
import { RouterModule, Routes } from '@angular/router';

import { PageBillComponent } from './page-bill/page-bill.component';
import { PageHistoryComponent } from './page-history/page-history.component';
import { PagePlannerComponent } from './page-planner/page-planner.component';
import { PageRecordsComponent } from './page-records/page-records.component';
import { SystemComponent } from './system.component';

const routes: Routes = [
  { path: 'system', component: SystemComponent, children: [
      { path: 'bill', component: PageBillComponent },
      { path: 'history', component: PageHistoryComponent },
      { path: 'planner', component: PagePlannerComponent },
      { path: 'records', component: PageRecordsComponent },
    ] }
];

@NgModule({
  imports: [RouterModule.forRoot(routes)],
  exports: [RouterModule],
})
export class SystemRoutingModule { }
