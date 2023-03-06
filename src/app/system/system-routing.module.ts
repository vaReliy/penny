import { NgModule } from '@angular/core';
import { RouterModule, Routes } from '@angular/router';

import { AuthGuard } from '../shared/services/auth.guard';
import { PageBillComponent } from './page-bill/page-bill.component';
import { HistoryDetailsComponent } from './page-history/history-details/history-details.component';
import { PageHistoryComponent } from './page-history/page-history.component';
import { PagePlannerComponent } from './page-planner/page-planner.component';
import { PageRecordsComponent } from './page-records/page-records.component';
import { SystemComponent } from './system.component';

const routes: Routes = [
  {
    path: '',
    component: SystemComponent,
    canActivate: [AuthGuard],
    children: [
      { path: 'bill', component: PageBillComponent },
      { path: 'history', component: PageHistoryComponent },
      { path: 'planner', component: PagePlannerComponent },
      { path: 'records', component: PageRecordsComponent },
      { path: 'history/:id', component: HistoryDetailsComponent },
    ],
  },
];

@NgModule({
  imports: [RouterModule.forChild(routes)],
  exports: [RouterModule],
})
export class SystemRoutingModule {}
