import { NgModule } from '@angular/core';
import { RouterModule } from '@angular/router';

import { LoaderComponent } from './components/loader/loader.component';
import { NotFoundComponent } from './components/not-found/not-found.component';
import { AuthGuard } from './services/auth.guard';
import { AuthService } from './services/auth.service';
import { UsersService } from './services/users.service';

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
  providers: [
    UsersService,
    AuthService,
    AuthGuard,
  ],
})
export class SharedModule {}
