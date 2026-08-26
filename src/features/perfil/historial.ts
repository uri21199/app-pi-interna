import { supabase } from '../../shared/supabase';

export type TablaHistorial = 'cursada_militante' | 'trabajo_militante';
export type AccionHistorial = 'crear' | 'editar' | 'eliminar';

export interface RegistrarCambioInput {
  militanteId: string;
  modificadoPor: string;
  tabla: TablaHistorial;
  registroId: string | null;
  campoModificado: string;
  valorAnterior: string | null;
  valorNuevo: string | null;
  accion: AccionHistorial;
}

// Nunca se pisa un registro: cada cambio en cursada_militante/trabajo_militante
// inserta una fila nueva acá, igual criterio que las pasadas de pasadas-fiuba.
export async function registrarCambio(input: RegistrarCambioInput): Promise<void> {
  const { error } = await supabase.from('historial_disponibilidad').insert({
    militante_id: input.militanteId,
    modificado_por: input.modificadoPor,
    tabla: input.tabla,
    registro_id: input.registroId,
    campo_modificado: input.campoModificado,
    valor_anterior: input.valorAnterior,
    valor_nuevo: input.valorNuevo,
    accion: input.accion,
  });
  if (error) throw new Error(error.message);
}
