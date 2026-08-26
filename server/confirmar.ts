import { supabaseAdmin } from './lib/supabaseAdmin.ts';
import { diaSemanaDe, lunesDeLaSemana } from './lib/dia.ts';

// Forma genérica de request/response (compatible con AWS Lambda / Netlify /
// la mayoría de plataformas serverless). Adaptar al wrapper real una vez
// definido el hosting.
interface FunctionEvent {
  httpMethod: string;
  queryStringParameters?: Record<string, string | undefined> | null;
  body?: string | null;
}

interface FunctionResponse {
  statusCode: number;
  headers?: Record<string, string>;
  body: string;
}

interface NotificacionRow {
  militante_id: string;
  fecha: string;
  respondido_en: string | null;
  disponible: boolean | null;
  hora_desde: string | null;
  hora_hasta: string | null;
}

interface ConfirmarPayload {
  nombre: string;
  fecha: string;
  eje: string | null;
  clases: { materia: string; hora_inicio: string; hora_fin: string }[];
  yaRespondido: boolean;
  disponible: boolean | null;
  hora_desde: string | null;
  hora_hasta: string | null;
}

const jsonHeaders = { 'Content-Type': 'application/json' };

function jsonResponse(statusCode: number, body: unknown): FunctionResponse {
  return { statusCode, headers: jsonHeaders, body: JSON.stringify(body) };
}

async function buildPayload(notificacion: NotificacionRow): Promise<ConfirmarPayload | null> {
  const { data: militante, error: militanteError } = await supabaseAdmin
    .from('militantes')
    .select('nombre')
    .eq('id', notificacion.militante_id)
    .single();

  if (militanteError || !militante) return null;

  const dia = diaSemanaDe(notificacion.fecha);

  const { data: clases } = await supabaseAdmin
    .from('cursada_militante')
    .select('materia, hora_inicio, hora_fin')
    .eq('militante_id', notificacion.militante_id)
    .eq('dia', dia)
    .order('hora_inicio');

  const { data: eje } = await supabaseAdmin
    .from('ejes_semanales')
    .select('texto')
    .eq('semana', lunesDeLaSemana(notificacion.fecha))
    .maybeSingle();

  return {
    nombre: militante.nombre,
    fecha: notificacion.fecha,
    eje: eje?.texto ?? null,
    clases: clases ?? [],
    yaRespondido: notificacion.respondido_en !== null,
    disponible: notificacion.disponible,
    hora_desde: notificacion.hora_desde,
    hora_hasta: notificacion.hora_hasta,
  };
}

export const handler = async (event: FunctionEvent): Promise<FunctionResponse> => {
  try {
    if (event.httpMethod === 'GET') {
      const token = event.queryStringParameters?.token;
      if (!token) return jsonResponse(400, { error: 'Falta token' });

      const { data: notificacion, error } = await supabaseAdmin
        .from('notificaciones_mesita')
        .select('militante_id, fecha, respondido_en, disponible, hora_desde, hora_hasta')
        .eq('token', token)
        .maybeSingle();

      if (error || !notificacion) return jsonResponse(404, { error: 'Token no encontrado' });

      const payload = await buildPayload(notificacion);
      if (!payload) return jsonResponse(404, { error: 'Token no encontrado' });

      return jsonResponse(200, payload);
    }

    if (event.httpMethod === 'POST') {
      const body = event.body ? JSON.parse(event.body) : {};
      const { token, disponible, hora_desde, hora_hasta } = body;

      if (!token || typeof disponible !== 'boolean') {
        return jsonResponse(400, { error: 'Datos incompletos' });
      }
      if (disponible && (!hora_desde || !hora_hasta)) {
        return jsonResponse(400, { error: 'Falta el horario' });
      }
      if (disponible && hora_desde >= hora_hasta) {
        return jsonResponse(400, { error: 'El horario "desde" debe ser anterior al "hasta"' });
      }

      const { data: updated, error: updateError } = await supabaseAdmin
        .from('notificaciones_mesita')
        .update({
          respondido_en: new Date().toISOString(),
          disponible,
          hora_desde: disponible ? hora_desde : null,
          hora_hasta: disponible ? hora_hasta : null,
          // Esta es una respuesta real de la persona (por mail): si la fila
          // venía autoconfirmada por un horario fijo, deja de estarlo — así
          // no se borra por error si después se elimina ese horario fijo.
          autoconfirmado: false,
        })
        .eq('token', token)
        .select('militante_id, fecha, respondido_en, disponible, hora_desde, hora_hasta')
        .maybeSingle();

      if (updateError || !updated) return jsonResponse(404, { error: 'Token no encontrado' });

      const payload = await buildPayload(updated);
      if (!payload) return jsonResponse(404, { error: 'Token no encontrado' });

      return jsonResponse(200, payload);
    }

    return jsonResponse(405, { error: 'Método no permitido' });
  } catch {
    return jsonResponse(500, { error: 'Error interno' });
  }
};
