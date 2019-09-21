import { Component, OnInit } from '@angular/core';
import { FormBuilder, Validators } from '@angular/forms';

@Component({
  selector: 'app-login',
  templateUrl: './login.component.html',
  styleUrls: ['./login.component.scss']
})
export class LoginComponent implements OnInit {
  form = this.fb.group({
    email: this.fb.control(null, [Validators.required, Validators.email]),
    password: this.fb.control(null, [Validators.required, Validators.minLength(6)])
  });

  constructor(
    private fb: FormBuilder
  ) { }

  ngOnInit() {
  }

  hasFormError() {
    return this.form.invalid && this.form.touched;
  }

  showErrorMessage(error: string, e?: {requiredLength?: number}) {
    switch (error) {
      case 'required': return 'Обовʼязвове поле.';
      case 'email': return 'Не коректний Email';
      case 'minlength': return `Довжина поля має бути не меншою за ${e.requiredLength} символів`;
      default: return '';
    }
  }

  onSubmit() {
    console.log(this.form);
  }

}