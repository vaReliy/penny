export function flatDtoToInstance<T>(
  value: Partial<T>,
  DtoClass: new () => T
): T {
  const r = new DtoClass();

  Object.keys(value).forEach(k => {
    r[k] = value[k];
  });

  return r;
}
