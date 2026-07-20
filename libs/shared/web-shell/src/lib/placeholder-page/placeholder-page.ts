import { Component } from '@angular/core';
import { TranslocoPipe } from '@jsverse/transloco';

@Component({
  selector: 'lib-placeholder-page',
  imports: [TranslocoPipe],
  template: `<p class="p-6 text-center text-text-secondary">
    {{ 'shell.placeholder.comingSoon' | transloco }}
  </p>`,
})
export class PlaceholderPageComponent {}
