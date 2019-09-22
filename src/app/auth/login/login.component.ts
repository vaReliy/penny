import { Component, OnInit } from '@angular/core';
import { FormBuilder, Validators } from '@angular/forms';
import { ActivatedRoute, Params } from '@angular/router';

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
    private route: ActivatedRoute,
  ) {
    super();
    this.form = this.fb.group({
      email: this.fb.control(null, [Validators.required, Validators.email]),
      password: this.fb.control(null, [Validators.required, Validators.minLength(6)])
    });
  }

  ngOnInit() {
    this.route.queryParams.subscribe((params: Params) => {
      if (params.email) {
        this.showAlertMessage('Тепер ви можете увійти до системи!', 'success', 3000);
        this.form.patchValue({email: params.email}, {emitEvent: false});
      }
    });
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

  private showAlertMessage(text: string, type: string = 'danger', time: number = 5000) {
    this.alertMessage = {text, type};
    setTimeout(() => {
      this.alertMessage.text = '';
    }, time);
  }

}
