import { HttpClient } from '@angular/common/http';
import { Injectable } from '@angular/core';
import { Observable } from 'rxjs';
import { debounceTime, map } from 'rxjs/operators';

import { BaseApi } from '../core/base-api';
import { User } from '../models/user.model';

@Injectable()
export class UsersService extends BaseApi {

  constructor(
    protected http: HttpClient
  ) {
    super(http);
  }

  createUser(email: string, password: string, name: string) {
    return this.POST('users', new User(name, email, password)).pipe(
      map((user: User) => user)
    );
  }

  getUserByEmail(email: string, password: string): Observable<User> {
    return this.getUsers(email).pipe(
      map((users: User[]) => {
        if (users.length) {
          return users.filter(u => u.password === password)[0];
        }
        return null;
      })
    );
  }

  isUserEmailExist(email: string): Observable<boolean> {
    return this.getUsers(email).pipe(
      debounceTime(500),
      map((users: User[]) => {
        if (users.length) {
          return !!users.filter(u => u.email === email).length;
        }
        return false;
      })
    );
  }

  private getUsers(email: string): Observable<User[]> {
    return this.GET(`users?email=${email}`);
  }
}
