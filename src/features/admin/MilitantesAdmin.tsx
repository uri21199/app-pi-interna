import { useEffect, useMemo, useState } from 'react';
import { useAuth, type Rol } from '../../shared/AuthProvider';
import { supabase } from '../../shared/supabase';
import type { Militante } from '../grilla/types/db';
import { coincide } from '../pasadas/lib/texto';
import { Cargando } from '../../shared/Spinner';

function Mensaje({ texto }: { texto: string | null }) {
  if (!texto) return null;
  const esError = texto.startsWith('Error');
  return (
    <p
      role="alert"
      aria-live={esError ? 'assertive' : 'polite'}
      className={`mt-2 rounded-lg p-2 text-sm ${esError ? 'bg-red-50 text-red-700' : 'bg-emerald-50 text-emerald-700'}`}
    >
      {texto}
    </p>
  );
}

export function MilitantesAdmin() {
  const { session } = useAuth();
  const [militantes, setMilitantes] = useState<Militante[]>([]);
  const [cargando, setCargando] = useState(true);
  const [seleccionado, setSeleccionado] = useState<Militante | null>(null);
  const [guardando, setGuardando] = useState(false);
  const [mensaje, setMensaje] = useState<string | null>(null);

  const [nuevoNombre, setNuevoNombre] = useState('');
  const [nuevoEmail, setNuevoEmail] = useState('');
  const [nuevaPassword, setNuevaPassword] = useState('');
  const [nuevoRol, setNuevoRol] = useState<Rol>('militante');
  const [creando, setCreando] = useState(false);
  const [busqueda, setBusqueda] = useState('');

  const militantesFiltrados = useMemo(() => {
    if (!busqueda.trim()) return militantes;
    return militantes.filter((m) => coincide(`${m.nombre} ${m.email}`, busqueda));
  }, [militantes, busqueda]);

  function cargarMilitantes() {
    setCargando(true);
    supabase
      .from('militantes')
      .select('id, nombre, email, activo, rol, user_id')
      .order('nombre')
      .then(({ data }) => {
        setMilitantes((data as Militante[]) ?? []);
        setCargando(false);
      });
  }

  useEffect(cargarMilitantes, []);

  const crearMilitanteNuevo = async () => {
    if (!nuevoNombre.trim() || !nuevoEmail.trim() || !nuevaPassword) return;
    if (nuevaPassword.length < 8) {
      setMensaje('Error: la contraseña debe tener al menos 8 caracteres.');
      return;
    }
    setCreando(true);
    setMensaje(null);
    try {
      const res = await fetch('/api/admin/crear-militante', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${session?.access_token}`,
        },
        body: JSON.stringify({
          nombre: nuevoNombre.trim(),
          email: nuevoEmail.trim(),
          password: nuevaPassword,
          rol: nuevoRol,
        }),
      });
      const data = await res.json();
      if (!res.ok || !data.ok) throw new Error(data.error ?? 'No se pudo crear el militante');
      setNuevoNombre('');
      setNuevoEmail('');
      setNuevaPassword('');
      setNuevoRol('militante');
      setMensaje('Militante creado. Compartile el mail y la contraseña.');
      cargarMilitantes();
    } catch (err) {
      setMensaje(`Error: ${err instanceof Error ? err.message : 'no se pudo crear'}`);
    } finally {
      setCreando(false);
    }
  };

  const guardarSeleccionado = async () => {
    if (!seleccionado) return;
    setGuardando(true);
    setMensaje(null);

    const original = militantes.find((m) => m.id === seleccionado.id);
    const emailCambio = !!original && original.email !== seleccionado.email;

    // Si tiene cuenta y le cambiamos el email, hay que sincronizar auth.users
    // (requiere service role) antes de tocar la tabla — si no, queda
    // desincronizado y la persona no puede volver a loguearse con el mail
    // que ve acá.
    if (emailCambio && seleccionado.user_id) {
      try {
        const res = await fetch('/api/admin/actualizar-email', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${session?.access_token}`,
          },
          body: JSON.stringify({ militanteId: seleccionado.id, email: seleccionado.email }),
        });
        const data = await res.json();
        if (!res.ok || !data.ok) throw new Error(data.error ?? 'No se pudo actualizar el email');
      } catch (err) {
        setGuardando(false);
        setMensaje(`Error: ${err instanceof Error ? err.message : 'no se pudo actualizar el email'}`);
        return;
      }
    }

    const { error } = await supabase
      .from('militantes')
      .update({
        nombre: seleccionado.nombre,
        // Si ya se sincronizó server-side arriba, no lo mandamos de nuevo acá.
        ...(emailCambio && seleccionado.user_id ? {} : { email: seleccionado.email }),
        rol: seleccionado.rol,
        activo: seleccionado.activo,
      })
      .eq('id', seleccionado.id);
    setGuardando(false);
    if (error) {
      console.error(error);
      setMensaje('Error: no se pudo guardar el militante. Probá de nuevo en un momento.');
      return;
    }
    setMensaje('Militante guardado.');
    cargarMilitantes();
  };

  return (
    <div className="mx-auto max-w-2xl p-4 pb-10">
      <h1 className="text-lg font-semibold text-slate-800">Militantes</h1>
      <Mensaje texto={mensaje} />

      {!seleccionado && (
        <>
          <div className="mt-3 rounded-xl border border-dashed border-slate-300 bg-white p-3">
            <p className="text-xs font-medium text-slate-500">Agregar militante</p>
            <div className="mt-1 flex flex-col gap-2">
              <input
                type="text"
                placeholder="Nombre"
                value={nuevoNombre}
                onChange={(e) => setNuevoNombre(e.target.value)}
                className="rounded-lg border border-slate-300 px-2 py-1 text-sm"
              />
              <input
                type="email"
                placeholder="Email"
                value={nuevoEmail}
                onChange={(e) => setNuevoEmail(e.target.value)}
                className="rounded-lg border border-slate-300 px-2 py-1 text-sm"
              />
              <input
                type="password"
                placeholder="Contraseña inicial"
                value={nuevaPassword}
                onChange={(e) => setNuevaPassword(e.target.value)}
                className="rounded-lg border border-slate-300 px-2 py-1 text-sm"
              />
              <select
                value={nuevoRol}
                onChange={(e) => setNuevoRol(e.target.value as Rol)}
                className="rounded-lg border border-slate-300 px-2 py-1 text-sm"
              >
                <option value="militante">Militante</option>
                <option value="admin">Admin</option>
              </select>
              <button
                onClick={crearMilitanteNuevo}
                disabled={creando}
                className="rounded-lg bg-blue-600 px-3 py-1 text-sm font-medium text-white disabled:opacity-50"
              >
                Agregar
              </button>
            </div>
            <p className="mt-2 text-xs text-slate-400">
              Si el mail ya pertenece a un militante sin cuenta, esto le vincula la cuenta en vez de duplicarlo.
            </p>
          </div>

          <input
            type="text"
            value={busqueda}
            onChange={(e) => setBusqueda(e.target.value)}
            placeholder="Buscar por nombre o email..."
            className="mt-3 w-full rounded-lg border border-slate-300 px-3 py-1.5 text-sm focus:border-blue-500"
          />

          <div className="mt-3 space-y-1">
            {cargando && <Cargando className="text-sm text-slate-400" />}
            {!cargando && militantesFiltrados.length === 0 && (
              <p className="text-sm text-slate-400">Sin resultados.</p>
            )}
            {!cargando &&
              militantesFiltrados.map((m) => (
                <button
                  key={m.id}
                  onClick={() => setSeleccionado(m)}
                  className="flex w-full items-center justify-between rounded-lg border border-slate-200 bg-white p-2 text-left text-sm active:bg-slate-50"
                >
                  <span>
                    <span className="font-medium text-slate-800">{m.nombre}</span>
                    <span className="text-slate-500"> · {m.email}</span>
                  </span>
                  <span className="flex shrink-0 items-center gap-2">
                    <span className="rounded-full bg-slate-100 px-2 py-0.5 text-xs capitalize text-slate-600">{m.rol}</span>
                    {!m.activo && <span className="rounded-full bg-red-100 px-2 py-0.5 text-xs text-red-600">Inactivo</span>}
                    {!m.user_id && <span className="rounded-full bg-amber-100 px-2 py-0.5 text-xs text-amber-700">Sin cuenta</span>}
                  </span>
                </button>
              ))}
          </div>
        </>
      )}

      {seleccionado && (
        <div className="mt-4">
          <button onClick={() => setSeleccionado(null)} className="text-sm font-medium text-blue-600">
            ← Volver a la lista
          </button>

          <div className="mt-3 rounded-xl border border-slate-200 bg-white p-3">
            <label htmlFor="militante-nombre" className="block text-xs font-medium text-slate-500">Nombre</label>
            <input
              id="militante-nombre"
              type="text"
              value={seleccionado.nombre}
              onChange={(e) => setSeleccionado({ ...seleccionado, nombre: e.target.value })}
              className="mt-1 w-full rounded-lg border border-slate-300 px-2 py-1 text-sm"
            />

            <label htmlFor="militante-email" className="mt-2 block text-xs font-medium text-slate-500">Email</label>
            <input
              id="militante-email"
              type="email"
              value={seleccionado.email}
              onChange={(e) => setSeleccionado({ ...seleccionado, email: e.target.value })}
              className="mt-1 w-full rounded-lg border border-slate-300 px-2 py-1 text-sm"
            />

            <label htmlFor="militante-rol" className="mt-2 block text-xs font-medium text-slate-500">Rol</label>
            <select
              id="militante-rol"
              value={seleccionado.rol}
              onChange={(e) => setSeleccionado({ ...seleccionado, rol: e.target.value as Rol })}
              className="mt-1 w-full rounded-lg border border-slate-300 px-2 py-1 text-sm"
            >
              <option value="militante">Militante</option>
              <option value="admin">Admin</option>
            </select>

            <label className="mt-2 flex items-center gap-2 text-sm text-slate-600">
              <input
                type="checkbox"
                checked={seleccionado.activo}
                onChange={(e) => setSeleccionado({ ...seleccionado, activo: e.target.checked })}
              />
              Activo
            </label>
            <p className="mt-1 text-xs text-slate-400">
              Si lo destildás, no va a poder entrar a la app ni recibir notificaciones de mesita.
            </p>

            {!seleccionado.user_id && (
              <p className="mt-2 text-xs text-amber-700">
                Todavía no tiene cuenta creada — usá "Agregar militante" con el mismo mail para vincularla.
              </p>
            )}

            <button
              onClick={guardarSeleccionado}
              disabled={guardando}
              className="mt-3 rounded-lg bg-blue-600 px-3 py-1 text-sm font-medium text-white disabled:opacity-50"
            >
              Guardar
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
