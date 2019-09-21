import { Component, OnInit } from '@angular/core';
import { FormBuilder, Validators } from '@angular/forms';

import { FormControllerAbstract } from '../shared/FormControllerAbstract';

@Component({
  selector: 'app-registration',
  templateUrl: './registration.component.html',
  styleUrls: ['./registration.component.scss']
})
export class RegistrationComponent extends FormControllerAbstract implements OnInit {

  constructor(
    private fb: FormBuilder
  ) {
    super();
    this.form = this.fb.group({
      email: this.fb.control(null, [Validators.required, Validators.email]),
      password: this.fb.control(null, [Validators.required, Validators.minLength(6)]),
      name: this.fb.control(null, [Validators.required, Validators.minLength(4)])
    });
  }

  ngOnInit() {
  }

  onSubmit() {
    console.log(this.form);
  }

}
