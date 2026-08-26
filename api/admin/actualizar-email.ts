import type { VercelRequest, VercelResponse } from '@vercel/node';
import { verificarAdmin } from '../../server/verificarAdmin.ts';
import { actualizarEmailMilitante } from '../../server/actualizarEmail.ts';

// Editar el email de un militante: sincroniza auth.users además de la tabla
// militantes — también requiere service role. Equivalente de producción de
// /api/admin/actualizar-email en devApiPlugin.ts.
export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') {
    res.status(405).json({ ok: false, error: 'Método no permitido' });
    return;
  }
  try {
    const authHeader = req.headers.authorization;
    const token = authHeader?.startsWith('Bearer ') ? authHeader.slice('Bearer '.length) : undefined;
    await verificarAdmin(token);

    const { militanteId, email } = (req.body ?? {}) as { militanteId?: string; email?: string };
    if (!militanteId || !email) {
      res.status(400).json({ ok: false, error: 'Faltan militanteId o email' });
      return;
    }

    await actualizarEmailMilitante(militanteId, email);
    res.status(200).json({ ok: true });
  } catch (err) {
    res.status(400).json({ ok: false, error: err instanceof Error ? err.message : 'Error interno' });
  }
}
