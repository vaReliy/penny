import { Component, OnDestroy } from '@angular/core';
import { Subscription } from 'rxjs';

@Component({
  template: '',
  standalone: false,
})
export class UnsubscriberComponent implements OnDestroy {
  private subcriptionList: Subscription[] = [];

  set subs(s: Subscription) {
    this.subcriptionList.push(s);
  }

  ngOnDestroy(): void {
    for (const subscription of this.subcriptionList) {
      if (subscription) {
        subscription.unsubscribe();
      }
    }
  }
}
