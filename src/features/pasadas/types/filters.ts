import type { DiaSemana } from './db';

export type FiltroDia = DiaSemana | 'hoy' | 'semana';
export type FiltroEstado = 'todos' | 'pendiente' | 'hecho';

export interface Filtros {
  dia: FiltroDia;
  carreras: string[];
  horaDesde: string;
  horaHasta: string;
  texto: string;
  estado: FiltroEstado;
}

export const FILTROS_INICIALES: Filtros = {
  dia: 'hoy',
  carreras: [],
  horaDesde: '',
  horaHasta: '',
  texto: '',
  estado: 'todos',
};
