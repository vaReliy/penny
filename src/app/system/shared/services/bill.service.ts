import { HttpClient } from '@angular/common/http';
import { Injectable } from '@angular/core';
import { map } from 'rxjs/operators';

@Injectable()
export class BillService {
  private URL = 'http://localhost:3201';

  constructor(
    private http: HttpClient
  ) { }

  getBill(): any {
    return this.http.get(`${this.URL}/bill`).pipe(
      map((response: Response) => response),
    );
  }

  getExchangeRates(): any {
    return this.http.get(`${this.URL}/rates`).pipe(
      map((response: Response) => response),
    );
  }
}
