import { Component, OnInit } from '@angular/core';
import { FormBuilder, Validators } from '@angular/forms';
import { Observable } from 'rxjs';
import { map } from 'rxjs/operators';

import { UsersService } from '../../shared/services/users.service';
import { FormControllerAbstract } from '../shared/form-controller-abstract';

@Component({
  selector: 'app-registration',
  templateUrl: './registration.component.html',
  styleUrls: ['./registration.component.scss']
})
export class RegistrationComponent extends FormControllerAbstract implements OnInit {

  constructor(
    private fb: FormBuilder,
    private usersService: UsersService,
  ) {
    super();
    this.form = this.fb.group({
      email: this.fb.control(null,
        [Validators.required, Validators.email],
        [this.checkEmailExist.bind(this)]),
      password: this.fb.control(null, [Validators.required, Validators.minLength(6)]),
      name: this.fb.control(null, [Validators.required, Validators.minLength(4)]),
      agree: this.fb.control(null, [Validators.requiredTrue])
    });
  }

  ngOnInit() {
  }

  onSubmit() {
    console.log(this.form);
  }

  private checkEmailExist(): Observable<{isUserEmailExist?: boolean}> {
    return this.usersService
      .isUserEmailExist(this.form.get('email').value)
      .pipe(
        map(v => {
          return v ? {isUserEmailExist: v} : null;
        })
      );
  }

}
