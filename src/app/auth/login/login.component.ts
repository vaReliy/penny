import { Component, OnInit } from '@angular/core';
import { FormBuilder, Validators } from '@angular/forms';

import { FormControllerAbstract } from '../shared/form-controller-abstract';

@Component({
  selector: 'app-login',
  templateUrl: './login.component.html',
  styleUrls: ['./login.component.scss']
})
export class LoginComponent extends FormControllerAbstract implements OnInit {

  constructor(
    private fb: FormBuilder
  ) {
    super();
    this.form = this.fb.group({
      email: this.fb.control(null, [Validators.required, Validators.email]),
      password: this.fb.control(null, [Validators.required, Validators.minLength(6)])
    });
  }

  ngOnInit() {
  }

  onSubmit() {
    console.log(this.form);
  }

}
