import { CommonModule } from '@angular/common';
import { NgModule } from '@angular/core';
import { ReactiveFormsModule } from '@angular/forms';
import { AuthGuard } from '../shared/services/auth.guard';

import { AuthService } from '../shared/services/auth.service';
import { UsersService } from '../shared/services/users.service';
import { AuthRoutingModule } from './auth-routing.module';
import { AuthComponent } from './auth.component';
import { LoginComponent } from './login/login.component';
import { RegistrationComponent } from './registration/registration.component';

@NgModule({
  declarations: [
    LoginComponent,
    RegistrationComponent,
    AuthComponent
  ],
  imports: [
    AuthRoutingModule,
    ReactiveFormsModule,
    CommonModule
  ],
  providers: [
    UsersService,
    AuthService,
    AuthGuard,
  ]
})

export class AuthModule {}
