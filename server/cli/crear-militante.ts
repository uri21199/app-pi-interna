import { crearMilitante } from '../crearMilitante.ts';
import { supabaseAdmin } from '../lib/supabaseAdmin.ts';

// Uso: npm run crear-militante -- email@dominio.com "contraseña" "Nombre Apellido" [--admin]
async function main() {
  const [, , email, password, nombre, flag] = process.argv;
  if (!email || !password || !nombre) {
    console.error('Uso: npm run crear-militante -- <email> <password> "<nombre>" [--admin]');
    process.exit(1);
  }

  const { militanteId, userId } = await crearMilitante({ nombre, email, password });

  if (flag === '--admin') {
    const { error } = await supabaseAdmin.from('militantes').update({ rol: 'admin' }).eq('id', militanteId);
    if (error) throw new Error(error.message);
  }

  console.log(`Militante creado: ${nombre} <${email}>`);
  console.log(`  militante_id: ${militanteId}`);
  console.log(`  user_id:      ${userId}`);
  console.log(`  rol:          ${flag === '--admin' ? 'admin' : 'militante'}`);
}

main().catch((err: unknown) => {
  console.error('Error:', err instanceof Error ? err.message : err);
  process.exitCode = 1;
});
