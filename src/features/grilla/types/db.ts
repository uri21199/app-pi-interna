import type { Rol } from '../../../shared/AuthProvider';

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

export interface Militante {
  id: string;
  nombre: string;
  email: string;
  activo: boolean;
  rol: Rol;
  user_id: string | null;
}

export interface CursadaMilitante {
  id: string;
  militante_id: string;
  materia: string;
  dia: DiaSemana;
  hora_inicio: string;
  hora_fin: string;
}

// Informativo: no dispara notificaciones, el trigger de la mesita es la cursada.
export interface TrabajoMilitante {
  id: string;
  militante_id: string;
  dia: DiaSemana;
  hora_inicio: string;
  hora_fin: string;
}


export interface HorarioFijoMilitante {
  id: string;
  militante_id: string;
  dia: DiaSemana;
  hora_desde: string;
  hora_hasta: string;
}

export interface NotificacionMesita {
  id: string;
  militante_id: string;
  fecha: string;
  token: string;
  enviado_en: string;
  respondido_en: string | null;
  disponible: boolean | null;
  hora_desde: string | null;
  hora_hasta: string | null;
  autoconfirmado: boolean;
}

export interface VistaCoberturaDia {
  notificacion_id: string;
  fecha: string;
  militante_id: string;
  nombre: string;
  email: string;
  materia: string | null;
  hora_clase_inicio: string | null;
  hora_clase_fin: string | null;
  enviado_en: string;
  respondido_en: string | null;
  disponible: boolean | null;
  hora_desde: string | null;
  hora_hasta: string | null;
}
