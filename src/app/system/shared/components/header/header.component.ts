import { Component, OnInit } from '@angular/core';
import { Router } from '@angular/router';
import { Observable } from 'rxjs';

import { AuthService } from '../../../../core/auth.service';
import { UsersService } from '../../../../core/users.service';
import { User } from '../../../../shared/models/user.model';

@Component({
  selector: 'app-header',
  templateUrl: './header.component.html',
  styleUrls: ['./header.component.scss']
})
export class HeaderComponent implements OnInit {
  date: Date = new Date();
  currentUser$: Observable<User> = null;

  constructor(
    private authService: AuthService,
    private usersService: UsersService,
    private router: Router,
  ) { }

  ngOnInit() {
    this.currentUser$ = this.usersService.getCurrentUser();
  }

  onLogout() {
    this.authService.logout();
    this.router.navigate(['/login']).then();
  }

}
