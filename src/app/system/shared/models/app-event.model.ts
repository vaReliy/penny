export class AppEvent {
  constructor(
    public type: string,
    public amount: number,
    public category: number,
    public date: string,
    public description: string,
    public id?: number,
  ) {}

  static TYPES = ['income', 'outcome'];
  static getLabel(type: string): string {
    return type === 'income' ? 'Прибуток' : 'Витрата';
  }
}
