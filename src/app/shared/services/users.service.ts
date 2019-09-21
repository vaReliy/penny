import { HttpClient } from '@angular/common/http';
import { Injectable } from '@angular/core';
import { Observable } from 'rxjs';
import { map } from 'rxjs/operators';

import { User } from '../models/user.model';

@Injectable()
export class UsersService {
  private URL = 'http://localhost:3201';

  constructor(
    private http: HttpClient
  ) { }


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
}
