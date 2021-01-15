import { NgModule } from '@angular/core';
import { RouterModule } from '@angular/router';

import { LoaderComponent } from './components/loader/loader.component';
import { NotFoundComponent } from './components/not-found/not-found.component';

@NgModule({
  declarations: [
    NotFoundComponent,
    LoaderComponent,
  ],
  imports: [
    RouterModule,
  ],
  exports: [
    NotFoundComponent,
    LoaderComponent,
  ],
})
export class SharedModule {}
