import { CommonModule } from '@angular/common';
import { NgModule } from '@angular/core';
import { ReactiveFormsModule } from '@angular/forms';

import { AuthRoutingModule } from './auth-routing.module';
import { AuthComponent } from './auth.component';
import { LoginComponent } from './login/login.component';
import { RegistrationComponent } from './registration/registration.component';

@NgModule({
  declarations: [LoginComponent, RegistrationComponent, AuthComponent],
  imports: [AuthRoutingModule, ReactiveFormsModule, CommonModule],
  providers: [],
})
export class AuthModule {}
