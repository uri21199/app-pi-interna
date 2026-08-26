import { useEffect, useMemo, useState } from 'react';
import { useAuth } from '../../../shared/AuthProvider';
import { supabase } from '../../../shared/supabase';
import { Cargando } from '../../../shared/Spinner';
import type { Material } from '../types/db';

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

function errorAmigable(accion: string, error: unknown): string {
  console.error(error);
  return `Error: no se pudo ${accion}. Probá de nuevo en un momento.`;
}

export function Materiales() {
  const { perfil } = useAuth();
  const esAdmin = perfil?.rol === 'admin';
  const [materiales, setMateriales] = useState<Material[]>([]);
  const [cargando, setCargando] = useState(true);
  const [mensaje, setMensaje] = useState<string | null>(null);
  const [ocupadoId, setOcupadoId] = useState<string | null>(null);
  const [nuevoNombre, setNuevoNombre] = useState('');
  const [agregando, setAgregando] = useState(false);
  const [editandoId, setEditandoId] = useState<string | null>(null);
  const [nombreEditado, setNombreEditado] = useState('');

  function cargarMateriales() {
    setCargando(true);
    supabase
      .from('vista_materiales')
      .select('*')
      .then(({ data, error }) => {
        if (error) setMensaje(errorAmigable('cargar los materiales', error));
        else setMateriales((data as Material[]) ?? []);
        setCargando(false);
      });
  }

  useEffect(cargarMateriales, []);

  const materialesOrdenados = useMemo(() => {
    return [...materiales].sort((a, b) => {
      if (a.en_stock !== b.en_stock) return a.en_stock ? 1 : -1;
      return a.nombre.localeCompare(b.nombre);
    });
  }, [materiales]);

  async function agregarMaterial() {
    if (!nuevoNombre.trim()) return;
    setAgregando(true);
    setMensaje(null);
    const { data, error } = await supabase.from('materiales').insert({ nombre: nuevoNombre.trim() }).select('*').single();
    setAgregando(false);
    if (error || !data) {
      setMensaje(errorAmigable('agregar el material', error));
      return;
    }
    setMateriales((prev) => [...prev, { ...data, comprando_nombre: null }]);
    setNuevoNombre('');
    setMensaje('Material agregado.');
  }

  async function eliminarMaterial(m: Material) {
    if (!window.confirm(`¿Eliminar "${m.nombre}" de la lista?`)) return;
    setOcupadoId(m.id);
    setMensaje(null);
    const { error } = await supabase.from('materiales').delete().eq('id', m.id);
    setOcupadoId(null);
    if (error) {
      setMensaje(errorAmigable('eliminar el material', error));
      return;
    }
    setMateriales((prev) => prev.filter((x) => x.id !== m.id));
    setMensaje('Material eliminado.');
  }

  function abrirEdicion(m: Material) {
    setEditandoId(m.id);
    setNombreEditado(m.nombre);
    setMensaje(null);
  }

  async function guardarEdicion(m: Material) {
    if (!nombreEditado.trim()) return;
    setOcupadoId(m.id);
    setMensaje(null);
    const { error } = await supabase.from('materiales').update({ nombre: nombreEditado.trim() }).eq('id', m.id);
    setOcupadoId(null);
    if (error) {
      setMensaje(errorAmigable('guardar el material', error));
      return;
    }
    setMateriales((prev) => prev.map((x) => (x.id === m.id ? { ...x, nombre: nombreEditado.trim() } : x)));
    setEditandoId(null);
    setMensaje('Material guardado.');
  }

  async function marcarComprando(m: Material) {
    if (!perfil) return;
    setOcupadoId(m.id);
    setMensaje(null);
    const ahora = new Date().toISOString();
    const { error } = await supabase
      .from('materiales')
      .update({ comprando_militante_id: perfil.id, comprando_desde: ahora })
      .eq('id', m.id);
    setOcupadoId(null);
    if (error) {
      setMensaje(errorAmigable('anotarte para comprarlo', error));
      return;
    }
    setMateriales((prev) =>
      prev.map((x) =>
        x.id === m.id ? { ...x, comprando_militante_id: perfil.id, comprando_nombre: perfil.nombre, comprando_desde: ahora } : x
      )
    );
  }

  async function cancelarComprando(m: Material) {
    setOcupadoId(m.id);
    setMensaje(null);
    const { error } = await supabase
      .from('materiales')
      .update({ comprando_militante_id: null, comprando_desde: null })
      .eq('id', m.id);
    setOcupadoId(null);
    if (error) {
      setMensaje(errorAmigable('cancelar', error));
      return;
    }
    setMateriales((prev) =>
      prev.map((x) => (x.id === m.id ? { ...x, comprando_militante_id: null, comprando_nombre: null, comprando_desde: null } : x))
    );
  }

  async function marcarStock(m: Material, enStock: boolean) {
    setOcupadoId(m.id);
    setMensaje(null);
    const { error } = await supabase
      .from('materiales')
      .update({ en_stock: enStock, comprando_militante_id: null, comprando_desde: null })
      .eq('id', m.id);
    setOcupadoId(null);
    if (error) {
      setMensaje(errorAmigable('actualizar el stock', error));
      return;
    }
    setMateriales((prev) =>
      prev.map((x) =>
        x.id === m.id ? { ...x, en_stock: enStock, comprando_militante_id: null, comprando_nombre: null, comprando_desde: null } : x
      )
    );
    setMensaje(enStock ? 'Marcado como comprado.' : 'Marcado sin stock.');
  }

  return (
    <div className="mx-auto min-h-screen max-w-2xl bg-slate-50 p-4 pb-16">
      <h1 className="text-lg font-semibold text-slate-800">Materiales</h1>
      <p className="mt-1 text-sm text-slate-500">Volantes, afiches, cintas, banderines y demás.</p>

      <Mensaje texto={mensaje} />

      {esAdmin && (
        <div className="mt-3 rounded-xl border border-dashed border-slate-300 bg-white p-3">
          <p className="text-xs font-medium text-slate-500">Agregar material</p>
          <div className="mt-1 flex gap-2">
            <input
              type="text"
              placeholder="Nombre"
              aria-label="Nombre del material"
              value={nuevoNombre}
              onChange={(e) => setNuevoNombre(e.target.value)}
              className="flex-1 rounded-lg border border-slate-300 px-2 py-1 text-sm focus:border-blue-500"
            />
            <button
              onClick={agregarMaterial}
              disabled={agregando}
              className="rounded-lg bg-blue-600 px-3 py-1 text-sm font-medium text-white disabled:opacity-50"
            >
              Agregar
            </button>
          </div>
        </div>
      )}

      {cargando && <Cargando className="mt-4 text-sm text-slate-400" />}

      {!cargando && materialesOrdenados.length === 0 && (
        <p className="mt-4 text-sm text-slate-400">Todavía no hay materiales cargados.</p>
      )}

      <div className="mt-3 space-y-2">
        {materialesOrdenados.map((m) => {
          const ocupado = ocupadoId === m.id;
          const loEstoyComprandoYo = m.comprando_militante_id === perfil?.id;
          return (
            <div key={m.id} className="rounded-xl border border-slate-200 bg-white p-3">
              {editandoId === m.id ? (
                <div className="flex gap-2">
                  <input
                    type="text"
                    value={nombreEditado}
                    onChange={(e) => setNombreEditado(e.target.value)}
                    className="flex-1 rounded-lg border border-slate-300 px-2 py-1 text-sm focus:border-blue-500"
                  />
                  <button
                    onClick={() => guardarEdicion(m)}
                    disabled={ocupado}
                    className="rounded-lg bg-blue-600 px-3 py-1 text-sm font-medium text-white disabled:opacity-50"
                  >
                    Guardar
                  </button>
                  <button
                    onClick={() => setEditandoId(null)}
                    className="rounded-lg border border-slate-300 px-3 py-1 text-sm font-medium text-slate-600"
                  >
                    Cancelar
                  </button>
                </div>
              ) : (
                <div className="flex items-start justify-between gap-2">
                  <p className="font-medium text-slate-800">{m.nombre}</p>
                  <span
                    className={`shrink-0 rounded-full px-2 py-0.5 text-xs font-medium ${
                      m.en_stock ? 'bg-emerald-100 text-emerald-700' : 'bg-red-100 text-red-700'
                    }`}
                  >
                    {m.en_stock ? 'Hay stock' : 'Sin stock'}
                  </span>
                </div>
              )}

              {!m.en_stock && editandoId !== m.id && (
                <div className="mt-2 text-sm">
                  {!m.comprando_militante_id && (
                    <button
                      onClick={() => marcarComprando(m)}
                      disabled={ocupado || !perfil}
                      className="rounded-lg bg-blue-600 px-3 py-1 text-sm font-medium text-white disabled:opacity-50"
                    >
                      Lo compro yo
                    </button>
                  )}
                  {m.comprando_militante_id && loEstoyComprandoYo && (
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="text-slate-500">Lo estás comprando vos.</span>
                      <button
                        onClick={() => marcarStock(m, true)}
                        disabled={ocupado}
                        className="rounded-lg bg-emerald-600 px-3 py-1 text-xs font-medium text-white disabled:opacity-50"
                      >
                        Ya lo compré
                      </button>
                      <button
                        onClick={() => cancelarComprando(m)}
                        disabled={ocupado}
                        className="rounded-lg border border-slate-300 px-3 py-1 text-xs font-medium text-slate-600 disabled:opacity-50"
                      >
                        Cancelar
                      </button>
                    </div>
                  )}
                  {m.comprando_militante_id && !loEstoyComprandoYo && (
                    <span className="text-slate-500">Lo está comprando {m.comprando_nombre ?? 'otro militante'}.</span>
                  )}
                </div>
              )}

              {esAdmin && editandoId !== m.id && (
                <div className="mt-3 flex flex-wrap gap-2 border-t border-slate-100 pt-2">
                  {m.en_stock ? (
                    <button
                      onClick={() => marcarStock(m, false)}
                      disabled={ocupado}
                      className="rounded-lg border border-red-300 px-3 py-1 text-xs font-medium text-red-600 disabled:opacity-50"
                    >
                      Marcar sin stock
                    </button>
                  ) : (
                    <button
                      onClick={() => marcarStock(m, true)}
                      disabled={ocupado}
                      className="rounded-lg border border-emerald-300 px-3 py-1 text-xs font-medium text-emerald-700 disabled:opacity-50"
                    >
                      Marcar en stock
                    </button>
                  )}
                  {m.comprando_militante_id && !loEstoyComprandoYo && (
                    <button
                      onClick={() => cancelarComprando(m)}
                      disabled={ocupado}
                      className="rounded-lg border border-slate-300 px-3 py-1 text-xs font-medium text-slate-600 disabled:opacity-50"
                    >
                      Liberar
                    </button>
                  )}
                  <button
                    onClick={() => abrirEdicion(m)}
                    disabled={ocupado}
                    className="rounded-lg border border-slate-300 px-3 py-1 text-xs font-medium text-slate-600 disabled:opacity-50"
                  >
                    Editar
                  </button>
                  <button
                    onClick={() => eliminarMaterial(m)}
                    disabled={ocupado}
                    className="ml-auto rounded-lg border border-red-300 px-3 py-1 text-xs font-medium text-red-600 disabled:opacity-50"
                  >
                    Eliminar
                  </button>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
