export type DiaSemana =
  | 'Lunes'
  | 'Martes'
  | 'Miercoles'
  | 'Jueves'
  | 'Viernes'
  | 'Sabado'
  | 'Domingo';

const DIAS_SEMANA: DiaSemana[] = [
  'Lunes',
  'Martes',
  'Miercoles',
  'Jueves',
  'Viernes',
  'Sabado',
  'Domingo',
];

function parseFechaUtc(fechaIso: string): Date {
  const [y, m, d] = fechaIso.split('-').map(Number);
  return new Date(Date.UTC(y, m - 1, d));
}

// Replica dia_semana_de(fecha) de schema_mesita.sql: isodow (1=Lunes..7=Domingo).
export function diaSemanaDe(fechaIso: string): DiaSemana {
  const date = parseFechaUtc(fechaIso);
  const isoDow = date.getUTCDay() === 0 ? 7 : date.getUTCDay();
  return DIAS_SEMANA[isoDow - 1];
}

// Lunes de la semana que contiene fechaIso, para matchear ejes_semanales.semana.
export function lunesDeLaSemana(fechaIso: string): string {
  const date = parseFechaUtc(fechaIso);
  const isoDow = date.getUTCDay() === 0 ? 7 : date.getUTCDay();
  date.setUTCDate(date.getUTCDate() - (isoDow - 1));
  return date.toISOString().slice(0, 10);
}
