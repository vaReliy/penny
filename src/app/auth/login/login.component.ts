import { Component, OnInit } from '@angular/core';
import { FormBuilder, Validators } from '@angular/forms';
import { Title } from '@angular/platform-browser';
import { ActivatedRoute, Params, Router } from '@angular/router';
import { AuthService } from '../../core/auth.service';
import { UsersService } from '../../core/users.service';

import { Message } from '../../shared/models/message.model';
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
    private router: Router,
    private title: Title,
  ) {
    super();
    this.title.setTitle('Вхід до системи');
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
      if (params.accessDenied) {
        this.showAlertMessage('Вам необхідно увійти до системи!!', 'warning', 3000);
      }
    });
  }

  onSubmit() {
    this.form.disable();
    const formData: {email: string, password: string} = this.form.value;

    this.authService.login(formData)
      .subscribe(
        () => this.router.navigate(['/system']).then(),
        (error) => {
          this.showAlertMessage('Невірний email або пароль');
          this.form.enable();
        }
      );
  }

  private showAlertMessage(text: string, type: string = 'danger', time: number = 5000) {
    this.alertMessage = {text, type};
    setTimeout(() => {
      this.alertMessage.text = '';
    }, time);
  }

}
