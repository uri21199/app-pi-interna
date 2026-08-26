import { supabaseAdmin } from './lib/supabaseAdmin.ts';

// Editar el email de un militante debe reflejarse también en auth.users
// (si ya tiene cuenta) — si no, queda desincronizado y esa persona no puede
// volver a loguearse con el mail "nuevo" que ve en la UI.
export async function actualizarEmailMilitante(militanteId: string, nuevoEmail: string): Promise<void> {
  const { data: militante, error: fetchError } = await supabaseAdmin
    .from('militantes')
    .select('user_id')
    .eq('id', militanteId)
    .single();
  if (fetchError || !militante) throw new Error(fetchError?.message ?? 'Militante no encontrado');

  if (militante.user_id) {
    const { error: authError } = await supabaseAdmin.auth.admin.updateUserById(militante.user_id, { email: nuevoEmail });
    if (authError) throw new Error(authError.message);
  }

  const { error: updateError } = await supabaseAdmin.from('militantes').update({ email: nuevoEmail }).eq('id', militanteId);
  if (updateError) throw new Error(updateError.message);
}
