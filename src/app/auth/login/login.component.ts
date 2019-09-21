import { Component, OnInit } from '@angular/core';
import { FormBuilder, Validators } from '@angular/forms';

import { Message } from '../../shared/models/message.model';
import { User } from '../../shared/models/user.model';
import { AuthService } from '../../shared/services/auth.service';
import { UsersService } from '../../shared/services/users.service';
import { FormControllerAbstract } from '../shared/form-controller-abstract';

@Component({
  selector: 'app-login',
  templateUrl: './login.component.html',
  styleUrls: ['./login.component.scss']
})
export class LoginComponent extends FormControllerAbstract implements OnInit {
  alertMessage: Message = {text: '', type: ''};

  constructor(
    private fb: FormBuilder,
    private usersService: UsersService,
    private authService: AuthService,
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
    const formData: {email: string, password: string} = this.form.value;

    this.usersService
      .getUserByEmail(formData.email, formData.password)
      .subscribe((user: User) => {
        if (user) {
          this.authService.login();
          window.localStorage.setItem('user', JSON.stringify(user));
        } else {
          this.showAlertMessage('Невірний email або пароль');
        }
        this.form.reset();
      });
  }

  private showAlertMessage(text: string, type: string = 'danger') {
    this.alertMessage = {text, type};
    setTimeout(() => {
      this.alertMessage.text = '';
    }, 5000);
  }

}
