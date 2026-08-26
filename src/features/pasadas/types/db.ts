export type DiaSemana =
  | 'Lunes'
  | 'Martes'
  | 'Miercoles'
  | 'Jueves'
  | 'Viernes'
  | 'Sabado'
  | 'Domingo';

export const DIAS_SEMANA: DiaSemana[] = [
  'Lunes',
  'Martes',
  'Miercoles',
  'Jueves',
  'Viernes',
  'Sabado',
  'Domingo',
];

export interface VistaBloqueEstado {
  bloque_id: string;
  comision_id: string;
  materia: string;
  nombre_comision: string;
  dia: DiaSemana;
  hora_inicio: string;
  hora_fin: string;
  tipo: string | null;
  aula: string | null;
  aula_cambia_durante_cuatri: boolean;
  aula_detalle: string | null;
  carreras: string[];
  pasada_esta_semana: boolean;
  ultima_pasada: string | null;
  total_pasadas: number;
}

export interface PasadaHistorial {
  fecha: string;
  nota: string | null;
}

export interface Carrera {
  id: string;
  nombre: string;
}

export interface Materia {
  id: string;
  nombre: string;
  codigo: string | null;
}

export interface Comision {
  id: string;
  materia_id: string;
  nombre_comision: string;
  observaciones: string | null;
}

export interface BloqueHorario {
  id: string;
  comision_id: string;
  dia: DiaSemana;
  hora_inicio: string;
  hora_fin: string;
  tipo: string | null;
  aula: string | null;
  aula_cambia_durante_cuatri: boolean;
  aula_detalle: string | null;
}
