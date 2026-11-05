/**
 * Formatadores Intl em cache. Construir um `Intl.NumberFormat`/`DateTimeFormat`
 * é caro e as telas formatam dezenas de valores (uma linha de transação faz
 * dois); com o Worker de CPU curta isso pesava mais que o resto da renderização.
 */
const numbers = new Map<string, Intl.NumberFormat>();
const dates = new Map<string, Intl.DateTimeFormat>();

export function numberFormat(locale: string, options: Intl.NumberFormatOptions): Intl.NumberFormat {
  const key = locale + JSON.stringify(options);
  let formatter = numbers.get(key);
  if (!formatter) {
    formatter = new Intl.NumberFormat(locale, options);
    numbers.set(key, formatter);
  }
  return formatter;
}

export function dateFormat(locale: string, options: Intl.DateTimeFormatOptions): Intl.DateTimeFormat {
  const key = locale + JSON.stringify(options);
  let formatter = dates.get(key);
  if (!formatter) {
    formatter = new Intl.DateTimeFormat(locale, options);
    dates.set(key, formatter);
  }
  return formatter;
}
