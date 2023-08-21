import { NgModule } from '@angular/core';
import { RouterModule } from '@angular/router';

import { LoaderComponent } from './components/loader/loader.component';
import { NotFoundComponent } from './components/not-found/not-found.component';
import { AuthService } from './services/auth.service';
import { UsersService } from './services/users.service';

@NgModule({
  declarations: [NotFoundComponent, LoaderComponent],
  imports: [RouterModule],
  exports: [NotFoundComponent, LoaderComponent],
  providers: [UsersService, AuthService],
})
export class SharedModule {}
