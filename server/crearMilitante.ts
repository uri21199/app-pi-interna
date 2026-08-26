import { supabaseAdmin } from './lib/supabaseAdmin.ts';

export interface CrearMilitanteInput {
  nombre: string;
  email: string;
  password: string;
}

export interface CrearMilitanteResultado {
  militanteId: string;
  userId: string;
}

// Alta de un militante nuevo (o vinculación/reseteo de contraseña de uno
// existente): el admin le pide el mail a la persona y define él mismo la
// contraseña inicial, que después le comparte. Nunca hay auto-registro.
// Idempotente: si el militante ya tiene cuenta vinculada, reutiliza el
// usuario y le actualiza la contraseña (sirve como "resetear contraseña").
export async function crearMilitante({ nombre, email, password }: CrearMilitanteInput): Promise<CrearMilitanteResultado> {
  if (password.length < 8) {
    throw new Error('La contraseña debe tener al menos 8 caracteres.');
  }

  const { data: existente } = await supabaseAdmin
    .from('militantes')
    .select('id, user_id')
    .eq('email', email)
    .maybeSingle();

  if (existente?.user_id) {
    const { error: passError } = await supabaseAdmin.auth.admin.updateUserById(existente.user_id, { password });
    if (passError) throw new Error(passError.message);

    const { error: updateError } = await supabaseAdmin.from('militantes').update({ nombre }).eq('id', existente.id);
    if (updateError) throw new Error(updateError.message);

    return { militanteId: existente.id, userId: existente.user_id };
  }

  const { data: authData, error: authError } = await supabaseAdmin.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
  });
  if (authError || !authData.user) {
    throw new Error(authError?.message ?? 'No se pudo crear el usuario de autenticación');
  }
  const userId = authData.user.id;

  if (existente) {
    const { error: updateError } = await supabaseAdmin
      .from('militantes')
      .update({ nombre, user_id: userId })
      .eq('id', existente.id);
    if (updateError) throw new Error(updateError.message);
    return { militanteId: existente.id, userId };
  }

  const { data: creado, error: insertError } = await supabaseAdmin
    .from('militantes')
    .insert({ nombre, email, user_id: userId })
    .select('id')
    .single();
  if (insertError || !creado) throw new Error(insertError?.message ?? 'No se pudo crear el militante');

  return { militanteId: creado.id, userId };
}
