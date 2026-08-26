import type { VercelRequest, VercelResponse } from '@vercel/node';
import { verificarSesion } from '../../server/verificarSesion.ts';
import { responderMesita } from '../../server/mesita.ts';

// Responder disponibilidad de mesita desde la app (manual o autoconfirmación
// por horario fijo) — notificaciones_mesita es de solo-lectura para
// `authenticated`, así que esto pasa por acá con service role. Cualquier
// militante logueado puede llamarlo (no requiere admin); el militanteId se
// resuelve del propio token, nunca del body.
export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') {
    res.status(405).json({ ok: false, error: 'Método no permitido' });
    return;
  }
  try {
    const authHeader = req.headers.authorization;
    const token = authHeader?.startsWith('Bearer ') ? authHeader.slice('Bearer '.length) : undefined;
    const { militanteId } = await verificarSesion(token);

    const { fecha, disponible, hora_desde, hora_hasta, autoconfirmado } = (req.body ?? {}) as {
      fecha?: string;
      disponible?: boolean;
      hora_desde?: string;
      hora_hasta?: string;
      autoconfirmado?: boolean;
    };
    if (!fecha || typeof disponible !== 'boolean') {
      res.status(400).json({ ok: false, error: 'Faltan fecha o disponible' });
      return;
    }

    const data = await responderMesita({
      militanteId,
      fecha,
      disponible,
      horaDesde: hora_desde,
      horaHasta: hora_hasta,
      autoconfirmado,
    });
    res.status(200).json({ ok: true, data });
  } catch (err) {
    res.status(400).json({ ok: false, error: err instanceof Error ? err.message : 'Error interno' });
  }
}
