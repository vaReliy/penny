import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { delay } from 'rxjs/operators';

export class BaseApi {
  private URL = 'http://localhost:3201';

  constructor(protected http: HttpClient) {
  }

  private appendUrl(urlSuffix: string): string {
    return `${this.URL}/${urlSuffix}`;
  }

  public GET(urlSuffix: string): Observable<any> {
    return this.http.get(this.appendUrl(urlSuffix)).pipe(delay(1500));
  }

  public POST(urlSuffix: string, body: any = {}): Observable<any> {
    return this.http.post(this.appendUrl(urlSuffix), body).pipe(delay(1500));
  }

  public PUT(urlSuffix: string, body: any = {}): Observable<any> {
    return this.http.put(this.appendUrl(urlSuffix), body).pipe(delay(1500));
  }
}
