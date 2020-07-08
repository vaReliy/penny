import { Injectable } from "@angular/core";

@Injectable()
export class AuthService {
  private isAuthenticated  = false;

  constructor() {
    const user = JSON.parse(window.localStorage.getItem('user'));
    this.isAuthenticated = !!user && !!user.email && !!user.name && !!user.id;
  }

  login() {
    this.isAuthenticated = true;
  }

  logout() {
    this.isAuthenticated = false;
    window.localStorage.clear();
  }

  isLogin() {
    return this.isAuthenticated;
  }
}
