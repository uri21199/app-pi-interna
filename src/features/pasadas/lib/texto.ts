const DIACRITICOS = /[̀-ͯ]/g;

export function normalizar(texto: string): string {
  return texto.toLowerCase().normalize('NFD').replace(DIACRITICOS, '');
}

export function coincide(haystack: string, query: string): boolean {
  return normalizar(haystack).includes(normalizar(query));
}
