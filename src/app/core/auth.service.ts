import { HttpClient } from '@angular/common/http';
import { Injectable } from '@angular/core';
import { Observable } from 'rxjs';
import { map, switchMap } from 'rxjs/operators';

import { BaseApi } from '../shared/core/base-api';
import { UsersService } from './users.service';

@Injectable({
  providedIn: 'root'
})
export class AuthService extends BaseApi {
  static STORAGE_TOKEN_KEY = 'auth-token';
  private _token: string;

  constructor(
    protected http: HttpClient,
    private usersService: UsersService
  ) {
    super(http);
  }

  login(body: { email: string; password: string }): Observable<boolean> {
    return this.POST('auth/login', body).pipe(
      switchMap(({ access_token }) => {
        this.setToken(access_token);
        return this.usersService.getUserByEmail(body.email);
      }),
      map(user => {
        this.usersService.setCurrentUser(user);
        return !!user?.id;
      })
    );
  }

  logout() {
    this.setToken(null);
    this.usersService.setCurrentUser(null);
  }

  setToken(value: string) {
    this._token = value;
    localStorage.setItem(AuthService.STORAGE_TOKEN_KEY, value);
  }

  getToken(): string {
    return this._token
  }

  isLogin(): boolean {
    return !!this._token;
  }
}
