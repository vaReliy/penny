import { HttpClient } from '@angular/common/http';
import { Injectable } from '@angular/core';
import { Observable } from 'rxjs';
import { debounceTime, map } from 'rxjs/operators';

import { User } from '../models/user.model';

@Injectable()
export class UsersService {
  private URL = 'http://localhost:3201';

  constructor(
    private http: HttpClient
  ) { }

  createUser(email: string, password: string, name: string) {
    return this.http
      .post(`${this.URL}/users`, new User(name, email, password))
      .pipe(
        map((user: User) => user)
      );
  }

  getUserByEmail(email: string, password: string): Observable<User> {
    return this.http
      .get(`${this.URL}/users?email=${email}`)
      .pipe(
        map((users: User[]) => {
          if (users.length) {
            return users.filter(u => u.password === password)[0];
          }
          return null;
        })
      );
  }

  isUserEmailExist(email: string): Observable<boolean> {
    return this.http
      .get(`${this.URL}/users?email=${email}`)
      .pipe(
        debounceTime(500),
        map((users: User[]) => {
          if (users.length) {
            return !!users.filter(u => u.email === email).length;
          }
          return false;
        })
      );
  }
}
