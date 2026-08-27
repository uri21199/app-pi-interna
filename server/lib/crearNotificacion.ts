import { supabaseAdmin } from './supabaseAdmin';

interface ResultadoNotificacion {
  ok: boolean;
  token?: string;
  motivo?: string;
}

// Crea (o reusa) la fila de notificaciones_mesita para preguntarle a alguien
// si puede cubrir un día sin horario fijo. No manda nada por sí sola — el
// pendiente queda a la vista en el aviso de Home (y en "Mis próximos turnos")
// hasta que la persona entra a la app y responde. El aviso en sí (mail, y a
// futuro push) es un canal aparte, no algo que esta función dispare.
export async function crearPendiente(militanteId: string, fecha: string): Promise<ResultadoNotificacion> {
  const { data: existente } = await supabaseAdmin
    .from('notificaciones_mesita')
    .select('token')
    .eq('militante_id', militanteId)
    .eq('fecha', fecha)
    .maybeSingle();

  if (existente) return { ok: true, token: existente.token };

  const { data: creada, error } = await supabaseAdmin
    .from('notificaciones_mesita')
    .insert({ militante_id: militanteId, fecha })
    .select('token')
    .single();
  if (error || !creada) return { ok: false, motivo: error?.message ?? 'No se pudo crear la notificación' };
  return { ok: true, token: creada.token };
}

// Crea la notificación de un día ya respondida (disponible, con el horario
// fijo del militante) — para militantes que ya avisaron que ese día de la
// semana siempre pueden. Si por lo que sea ya existe una fila para esa fecha
// (ej: el militante ya se auto-declaró "no puedo" desde "Mis próximos
// turnos"), no la pisa.
export async function autoconfirmarPorHorarioFijo(
  militanteId: string,
  fecha: string,
  horaDesde: string,
  horaHasta: string,
): Promise<ResultadoNotificacion> {
  const { data: existente } = await supabaseAdmin
    .from('notificaciones_mesita')
    .select('token')
    .eq('militante_id', militanteId)
    .eq('fecha', fecha)
    .maybeSingle();

  if (existente) return { ok: true, token: existente.token };

  const { data: creada, error } = await supabaseAdmin
    .from('notificaciones_mesita')
    .insert({
      militante_id: militanteId,
      fecha,
      disponible: true,
      hora_desde: horaDesde,
      hora_hasta: horaHasta,
      respondido_en: new Date().toISOString(),
      autoconfirmado: true,
    })
    .select('token')
    .single();

  if (error || !creada) return { ok: false, motivo: error?.message ?? 'No se pudo autoconfirmar' };
  return { ok: true, token: creada.token };
}
