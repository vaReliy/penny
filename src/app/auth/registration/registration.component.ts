import { Component } from '@angular/core';
import { UntypedFormBuilder, Validators } from '@angular/forms';
import { Title } from '@angular/platform-browser';
import { Router } from '@angular/router';
import { Observable } from 'rxjs';
import { map } from 'rxjs/operators';

import { User } from '../../shared/models/user.model';
import { UsersService } from '../../shared/services/users.service';
import { FormControllerAbstract } from '../shared/form-controller-abstract';

@Component({
  selector: 'app-registration',
  templateUrl: './registration.component.html',
  styleUrls: ['./registration.component.scss'],
})
export class RegistrationComponent extends FormControllerAbstract {
  constructor(
    private fb: UntypedFormBuilder,
    private usersService: UsersService,
    private router: Router,
    private title: Title
  ) {
    super();
    this.title.setTitle('Реєстрація');
    this.form = this.fb.group({
      email: this.fb.control(
        null,
        [Validators.required, Validators.email],
        [this.checkEmailExist.bind(this)]
      ),
      password: this.fb.control(null, [
        Validators.required,
        Validators.minLength(6),
      ]),
      name: this.fb.control(null, [
        Validators.required,
        Validators.minLength(4),
      ]),
      agree: this.fb.control(null, [Validators.requiredTrue]),
    });
  }

  onSubmit() {
    const { email, password, name } = this.form.value;
    this.usersService
      .createUser(email, password, name)
      .subscribe((user: User) => {
        this.router.navigate(['./login'], {
          queryParams: {
            email: user.email,
          },
        });
      });
  }

  private checkEmailExist(): Observable<{ isUserEmailExist?: boolean }> {
    return this.usersService
      .isUserEmailExist(this.form.get('email').value)
      .pipe(
        map(v => {
          return v ? { isUserEmailExist: v } : null;
        })
      );
  }
}
