import { FormGroup } from '@angular/forms';

export abstract class FormControllerAbstract {
  form: FormGroup;

  hasFormError() {
    return this.form.invalid && this.form.touched;
  }

  showErrorMessage(error: string, e?: {requiredLength?: number}) {
    switch (error) {
      case 'required': return 'Обовʼязвове поле.';
      case 'email': return 'Не коректний Email';
      case 'minlength': return `Довжина поля має бути не меншою за ${e.requiredLength} символів`;
      default: return '';
    }
  }
}
