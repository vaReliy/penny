import { HttpErrorResponse, HttpEvent, HttpHandler, HttpInterceptor, HttpRequest } from '@angular/common/http';
import { Injectable } from '@angular/core';
import { Router } from '@angular/router';
import { Observable, throwError } from 'rxjs';
import { catchError } from 'rxjs/operators';

import { AuthService } from './auth.service';

@Injectable()
export class TokenInterceptor implements HttpInterceptor {
  constructor(
    private authService: AuthService,
    private router: Router,
  ) {
  }

  intercept(req: HttpRequest<any>, next: HttpHandler): Observable<HttpEvent<any>> {
    const token = this.authService.getToken();
    if (token) {
      req = req.clone({
        setHeaders: {
          Authorization: token,
        }
      });
    }

    return next.handle(req).pipe(
      catchError(error => this.authErrorHandler(error))
    );
  }

  private authErrorHandler(error: HttpErrorResponse): Observable<never> {
    if (error.status === 401) {
      this.router.navigate(['/login'], {
        queryParams: {
          sessionExpired: true,
        },
      }).then();
    }
    return throwError(error);
  }
}
