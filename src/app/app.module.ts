import { HTTP_INTERCEPTORS, HttpClientModule } from '@angular/common/http';
import { NgModule } from '@angular/core';
import { BrowserModule } from '@angular/platform-browser';
import { BrowserAnimationsModule } from '@angular/platform-browser/animations';

import { AppRoutingModule } from './app-routing.module';
import { AppComponent } from './app.component';
import { TokenInterceptor } from './core/token.interceptor';

const TOKEN_INTERCEPTOR = {
  provide: HTTP_INTERCEPTORS,
  useClass: TokenInterceptor,
  multi: true
};

@NgModule({
  declarations: [
    AppComponent,
  ],
  imports: [
    BrowserModule,
    BrowserAnimationsModule,
    AppRoutingModule,
    HttpClientModule,
  ],
  providers: [TOKEN_INTERCEPTOR],
  bootstrap: [AppComponent]
})
export class AppModule { }
