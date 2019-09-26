import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';

export class BaseApi {
  private URL = 'http://localhost:3201';

  constructor(protected http: HttpClient) {
  }

  private appendUrl(urlSuffix: string): string {
    return `${this.URL}/${urlSuffix}`;
  }

  public GET(urlSuffix: string): Observable<any> {
    return this.http.get(this.appendUrl(urlSuffix));
  }

  public POST(urlSuffix: string, body: any = {}): Observable<any> {
    return this.http.post(this.appendUrl(urlSuffix), body);
  }

  public PUT(urlSuffix: string, body: any = {}): Observable<any> {
    return this.http.put(this.appendUrl(urlSuffix), body);
  }
}
