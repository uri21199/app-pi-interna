import type { DiaSemana } from '../types/db';
import { DIAS_SEMANA } from '../types/db';

const JS_DAY_TO_DIA: DiaSemana[] = [
  'Domingo',
  'Lunes',
  'Martes',
  'Miercoles',
  'Jueves',
  'Viernes',
  'Sabado',
];

export function diaDeHoy(): DiaSemana {
  return JS_DAY_TO_DIA[new Date().getDay()];
}

export function formatDia(dia: DiaSemana): string {
  return dia === 'Miercoles' ? 'Miércoles' : dia === 'Sabado' ? 'Sábado' : dia;
}

function minutosDesdeMedianoche(hora: string): number {
  const [h, m] = hora.split(':').map(Number);
  return h * 60 + m;
}

/**
 * Distancia (en minutos) desde el momento actual hasta que arranca un bloque
 * que se repite semanalmente. Si el bloque es hoy pero su hora_inicio ya pasó,
 * se la manda al final de la semana (no interesa un bloque de la mañana
 * cuando ya es de tarde): se trata como si fuera "la próxima semana".
 */
export function distanciaDesdeAhora(dia: DiaSemana, horaInicio: string, ahora: Date = new Date()): number {
  const hoy = diaDeHoy();
  const diffDias = (DIAS_SEMANA.indexOf(dia) - DIAS_SEMANA.indexOf(hoy) + 7) % 7;
  const inicioMin = minutosDesdeMedianoche(horaInicio);
  const ahoraMin = ahora.getHours() * 60 + ahora.getMinutes();
  const yaPaso = diffDias === 0 && inicioMin < ahoraMin;
  return (yaPaso ? 7 : diffDias) * 24 * 60 + inicioMin;
}

/**
 * Distancia en días (0 = hoy, 1 = mañana, ...) sin la lógica de "ya pasó
 * hoy, mandalo a la semana que viene" de distanciaDesdeAhora: para priorizar
 * resultados de búsqueda por texto, "hoy" tiene que seguir siendo "hoy" aunque
 * la clase ya haya empezado (ej: buscar qué se cursó hoy más temprano).
 */
export function distanciaDiaDesdeHoy(dia: DiaSemana, hoy: DiaSemana = diaDeHoy()): number {
  return (DIAS_SEMANA.indexOf(dia) - DIAS_SEMANA.indexOf(hoy) + 7) % 7;
}

export { DIAS_SEMANA };
