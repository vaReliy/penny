import { ChangeDetectionStrategy, Component, OnInit } from '@angular/core';
import { Router } from '@angular/router';

import { AuthService } from '../../../../shared/services/auth.service';
import { avatarMock, linksMock } from './header.mock';

@Component({
    selector: 'app-header',
    templateUrl: './header.component.html',
    styleUrls: ['./header.component.scss'],
    changeDetection: ChangeDetectionStrategy.OnPush,
    standalone: false
})
export class HeaderComponent implements OnInit {
  date: Date = new Date();
  userName = '';
  userAvatar = '';
  links = linksMock;

  constructor(private authService: AuthService, private router: Router) {}

  ngOnInit() {
    const user = JSON.parse(window.localStorage.getItem('user'));
    this.userName = user?.name || '';
    this.userAvatar = user?.userAvatar || avatarMock;
  }

  onLogout() {
    this.authService.logout();
    this.router.navigate(['/login']);
  }
}
