import { Component, OnInit } from '@angular/core';

import { AuthService } from './core/auth.service';

@Component({
  selector: 'app-root',
  templateUrl: './app.component.html',
  styleUrls: ['./app.component.scss']
})
export class AppComponent implements OnInit {
  constructor(
    private authService: AuthService
  ) {
  }

  ngOnInit() {
    const availableToken = localStorage.getItem(AuthService.STORAGE_TOKEN_KEY);
    if (availableToken) {
      this.authService.setToken(availableToken);
    }
  }
}
