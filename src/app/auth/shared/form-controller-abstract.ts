import { FormGroup } from '@angular/forms';

export abstract class FormControllerAbstract {
  form: FormGroup;

  hasControlInvalid(controlName: string): boolean {
    const targetControl = this.form.get(controlName);
    return targetControl && targetControl.invalid && targetControl.touched;
  }

  hasControlValidationError(controlName: string, errorKey: string): boolean {
    const targetErrorControl = this.form.get(controlName);
    return targetErrorControl.errors && !!targetErrorControl.errors[errorKey];
  }

  showErrorMessage(error: string, e?: {requiredLength?: number}): string {
    switch (error) {
      case 'required': return 'Обовʼязвове поле.';
      case 'email': return 'Не коректний Email';
      case 'minlength': return `Довжина поля має бути не меншою за ${e.requiredLength} символів`;
      default: return '';
    }
  }
}
