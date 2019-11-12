import { NgModule } from '@angular/core';
import { RouterModule } from '@angular/router';
import { NotFoundComponent } from './components/not-found/not-found.component';
import { AuthGuard } from './services/auth.guard';
import { AuthService } from './services/auth.service';
import { UsersService } from './services/users.service';

@NgModule({
  declarations: [
    NotFoundComponent,
  ],
  imports: [
    RouterModule,
  ],
  exports: [
    NotFoundComponent,
  ],
  providers: [
    UsersService,
    AuthService,
    AuthGuard,
  ],
})
export class SharedModule {}
