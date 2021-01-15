import { HttpClient } from '@angular/common/http';
import { Injectable } from '@angular/core';
import { BehaviorSubject, Observable } from 'rxjs';
import { debounceTime, map } from 'rxjs/operators';

import { BaseApi } from '../shared/core/base-api';
import { User } from '../shared/models/user.model';

@Injectable({
  providedIn: 'root'
})
export class UsersService extends BaseApi {
  private _currentUser$ = new BehaviorSubject<User>(null);

  constructor(
    protected http: HttpClient
  ) {
    super(http);
    this.initFromStorage();
  }

  createUser(email: string, password: string, name: string) {
    return this.POST('users', new User(name, email, password)).pipe(
      map((user: User) => user)
    );
  }

  getUserByEmail(email: string): Observable<User> {
    return this.getUsers(email).pipe(
      map((users: User[]) => users.length === 1 ? users[0] : null)
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

  setCurrentUser(user: User) {
    localStorage.setItem('user', JSON.stringify(user));
    this._currentUser$.next(user);
  }

  getCurrentUser(): Observable<User> {
    return this._currentUser$.asObservable();
  }

  private initFromStorage() {
    const currentUser = JSON.parse(localStorage.getItem('user'));
    if (currentUser) {
      this._currentUser$.next(currentUser);
    }
  }

  private getUsers(email: string): Observable<User[]> { // todo: split isExist and GetByEmail on API?
    return this.GET(`users?email=${email}`);
  }
}
