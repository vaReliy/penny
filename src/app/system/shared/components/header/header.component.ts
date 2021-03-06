import { Component, OnInit } from '@angular/core';
import { Router } from '@angular/router';

import { AuthService } from '../../../../shared/services/auth.service';

@Component({
  selector: 'app-header',
  templateUrl: './header.component.html',
  styleUrls: ['./header.component.scss']
})
export class HeaderComponent implements OnInit {
  date: Date = new Date();
  name = '';

  constructor(
    private authService: AuthService,
    private router: Router,
  ) { }

  ngOnInit() {
    const user = JSON.parse(window.localStorage.getItem('user'));
    if (user && user.name) {
      this.name = user.name;
    }
  }

  onLogout() {
    this.authService.logout();
    this.router.navigate(['/login']);
  }

}
