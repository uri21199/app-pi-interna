import { DIAS_SEMANA, type DiaSemana } from '../types/db';

export function formatDateLocal(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

export function addDays(fechaIso: string, dias: number): string {
  const [y, m, d] = fechaIso.split('-').map(Number);
  const date = new Date(y, m - 1, d);
  date.setDate(date.getDate() + dias);
  return formatDateLocal(date);
}

export function lunesDeLaSemana(fechaIso: string): string {
  const [y, m, d] = fechaIso.split('-').map(Number);
  const date = new Date(y, m - 1, d);
  const isoDow = date.getDay() === 0 ? 7 : date.getDay();
  date.setDate(date.getDate() - (isoDow - 1));
  return formatDateLocal(date);
}

export function diaSemanaDe(fechaIso: string): DiaSemana {
  const [y, m, d] = fechaIso.split('-').map(Number);
  const isoDow = new Date(y, m - 1, d).getDay() || 7;
  return DIAS_SEMANA[isoDow - 1];
}

export function formatFechaLarga(fechaIso: string): string {
  const [y, m, d] = fechaIso.split('-').map(Number);
  return new Date(y, m - 1, d).toLocaleDateString('es-AR', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
  });
}
