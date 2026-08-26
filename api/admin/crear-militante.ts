import type { VercelRequest, VercelResponse } from '@vercel/node';
import { verificarAdmin } from '../../server/verificarAdmin.ts';
import { crearMilitante } from '../../server/crearMilitante.ts';
import { supabaseAdmin } from '../../server/lib/supabaseAdmin.ts';

// Alta de militante con contraseña elegida por el admin — requiere service
// role key, que nunca puede vivir en el bundle del cliente. Equivalente de
// producción de /api/admin/crear-militante en devApiPlugin.ts.
export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') {
    res.status(405).json({ ok: false, error: 'Método no permitido' });
    return;
  }
  try {
    const authHeader = req.headers.authorization;
    const token = authHeader?.startsWith('Bearer ') ? authHeader.slice('Bearer '.length) : undefined;
    await verificarAdmin(token);

    const { nombre, email, password, rol } = (req.body ?? {}) as {
      nombre?: string;
      email?: string;
      password?: string;
      rol?: 'militante' | 'admin';
    };
    if (!nombre || !email || !password) {
      res.status(400).json({ ok: false, error: 'Faltan nombre, email o password' });
      return;
    }

    const resultado = await crearMilitante({ nombre, email, password });

    if (rol === 'admin') {
      const { error } = await supabaseAdmin.from('militantes').update({ rol: 'admin' }).eq('id', resultado.militanteId);
      if (error) throw new Error(error.message);
    }

    res.status(200).json({ ok: true, ...resultado });
  } catch (err) {
    res.status(400).json({ ok: false, error: err instanceof Error ? err.message : 'Error interno' });
  }
}
