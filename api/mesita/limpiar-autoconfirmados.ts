import type { VercelRequest, VercelResponse } from '@vercel/node';
import { verificarSesion } from '../../server/verificarSesion.ts';
import { limpiarAutoconfirmados } from '../../server/mesita.ts';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') {
    res.status(405).json({ ok: false, error: 'Método no permitido' });
    return;
  }
  try {
    const authHeader = req.headers.authorization;
    const token = authHeader?.startsWith('Bearer ') ? authHeader.slice('Bearer '.length) : undefined;
    const { militanteId } = await verificarSesion(token);

    const { dia } = (req.body ?? {}) as { dia?: string };
    if (!dia) {
      res.status(400).json({ ok: false, error: 'Falta dia' });
      return;
    }

    const borradas = await limpiarAutoconfirmados(militanteId, dia);
    res.status(200).json({ ok: true, borradas });
  } catch (err) {
    res.status(400).json({ ok: false, error: err instanceof Error ? err.message : 'Error interno' });
  }
}
