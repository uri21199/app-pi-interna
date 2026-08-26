import { supabaseAdmin } from './lib/supabaseAdmin.ts';
import { diaSemanaDe } from './lib/dia.ts';

interface ResponderInput {
  militanteId: string;
  fecha: string;
  disponible: boolean;
  horaDesde?: string;
  horaHasta?: string;
  autoconfirmado?: boolean;
}

// notificaciones_mesita es de solo-lectura para `authenticated` (RLS) —
// cualquier escritura real tiene que pasar por acá, con la service role key.
// Usado tanto por las respuestas manuales ("Puedo"/"No puedo") como por la
// autoconfirmación de horarios fijos (ver src/features/perfil/MisTurnosMesita.tsx).
export async function responderMesita(input: ResponderInput) {
  const { data, error } = await supabaseAdmin
    .from('notificaciones_mesita')
    .upsert(
      {
        militante_id: input.militanteId,
        fecha: input.fecha,
        disponible: input.disponible,
        hora_desde: input.disponible ? input.horaDesde ?? null : null,
        hora_hasta: input.disponible ? input.horaHasta ?? null : null,
        respondido_en: new Date().toISOString(),
        autoconfirmado: input.autoconfirmado ?? false,
      },
      { onConflict: 'militante_id,fecha' },
    )
    .select('*')
    .single();
  if (error || !data) throw new Error(error?.message ?? 'No se pudo guardar la respuesta');
  return data;
}

// Cuando se borra un horario fijo, las filas futuras que se autoconfirmaron
// SOLO por ese horario dejan de tener sentido — esto las limpia. Nunca toca
// una fila con autoconfirmado=false (una respuesta real de la persona).
export async function limpiarAutoconfirmados(militanteId: string, dia: string): Promise<number> {
  const hoy = new Date().toISOString().slice(0, 10);
  const { data: futuras, error } = await supabaseAdmin
    .from('notificaciones_mesita')
    .select('id, fecha')
    .eq('militante_id', militanteId)
    .eq('autoconfirmado', true)
    .gte('fecha', hoy);
  if (error) throw new Error(error.message);

  const idsABorrar = (futuras ?? []).filter((f) => diaSemanaDe(f.fecha) === dia).map((f) => f.id);
  if (idsABorrar.length === 0) return 0;

  const { error: errorBorrado } = await supabaseAdmin.from('notificaciones_mesita').delete().in('id', idsABorrar);
  if (errorBorrado) throw new Error(errorBorrado.message);
  return idsABorrar.length;
}
