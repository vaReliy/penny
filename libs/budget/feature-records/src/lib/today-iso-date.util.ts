/** Zero-pads a 1-2 digit month/day component to 2 digits. */
function pad2(value: number): string {
  return String(value).padStart(2, '0');
}

/**
 * Today's calendar date in the user's local timezone, as `'YYYY-MM-DD'` —
 * the value a native `<input type="date">` expects and produces. Deliberately
 * local (not UTC): the legacy add-event form defaulted the date to "now" in
 * the user's wall-clock day.
 */
export function todayIsoDate(): string {
  const now = new Date();
  return `${now.getFullYear()}-${pad2(now.getMonth() + 1)}-${pad2(now.getDate())}`;
}
