import { useMemo, useState } from 'react';
import { useBloques } from '../hooks/useBloques';
import { supabase } from '../../../shared/supabase';
import type { BloqueHorario, Comision, DiaSemana } from '../types/db';
import { DIAS_SEMANA, formatDia } from '../lib/dia';
import { coincide } from '../lib/texto';
import { Cargando } from '../../../shared/Spinner';

export function AulasAdmin() {
  const { bloques, loading: cargandoLista } = useBloques();
  const [texto, setTexto] = useState('');
  const [comisionId, setComisionId] = useState<string | null>(null);
  const [comision, setComision] = useState<Comision | null>(null);
  const [bloquesEdit, setBloquesEdit] = useState<BloqueHorario[]>([]);
  const [cargandoDetalle, setCargandoDetalle] = useState(false);
  const [guardando, setGuardando] = useState(false);
  const [mensaje, setMensaje] = useState<string | null>(null);

  const opciones = useMemo(() => {
    const vistos = new Map<string, { comision_id: string; materia: string; nombre_comision: string }>();
    bloques.forEach((b) => {
      if (!vistos.has(b.comision_id)) {
        vistos.set(b.comision_id, {
          comision_id: b.comision_id,
          materia: b.materia,
          nombre_comision: b.nombre_comision,
        });
      }
    });
    const lista = Array.from(vistos.values());
    return lista
      .filter((o) => !texto || coincide(`${o.materia} ${o.nombre_comision}`, texto))
      .slice(0, 30);
  }, [bloques, texto]);

  async function seleccionar(id: string) {
    setComisionId(id);
    setMensaje(null);
    setCargandoDetalle(true);
    const [{ data: c }, { data: b }] = await Promise.all([
      supabase.from('comisiones').select('*').eq('id', id).single(),
      supabase.from('bloques_horario').select('*').eq('comision_id', id).order('dia').order('hora_inicio'),
    ]);
    setComision((c as Comision) ?? null);
    setBloquesEdit((b as BloqueHorario[]) ?? []);
    setCargandoDetalle(false);
  }

  function volver() {
    setComisionId(null);
    setComision(null);
    setBloquesEdit([]);
    setMensaje(null);
  }

  function actualizarBloque<K extends keyof BloqueHorario>(id: string, campo: K, valor: BloqueHorario[K]) {
    setBloquesEdit((prev) => prev.map((b) => (b.id === id ? { ...b, [campo]: valor } : b)));
  }

  async function guardarComision() {
    if (!comision) return;
    setGuardando(true);
    setMensaje(null);
    const { error } = await supabase
      .from('comisiones')
      .update({ nombre_comision: comision.nombre_comision, observaciones: comision.observaciones })
      .eq('id', comision.id);
    setGuardando(false);
    setMensaje(error ? `Error: ${error.message}` : 'Comisión guardada.');
  }

  async function guardarBloque(bloque: BloqueHorario) {
    setGuardando(true);
    setMensaje(null);
    const { error } = await supabase
      .from('bloques_horario')
      .update({
        dia: bloque.dia,
        hora_inicio: bloque.hora_inicio,
        hora_fin: bloque.hora_fin,
        tipo: bloque.tipo,
        aula: bloque.aula,
        aula_cambia_durante_cuatri: bloque.aula_cambia_durante_cuatri,
        aula_detalle: bloque.aula_detalle,
      })
      .eq('id', bloque.id);
    setGuardando(false);
    setMensaje(error ? `Error: ${error.message}` : 'Bloque guardado.');
  }

  return (
    <div className="mx-auto min-h-screen max-w-2xl bg-slate-50 p-4 pb-10">
      <h1 className="text-lg font-bold text-slate-900">Aulas</h1>
      <p className="mt-1 text-sm text-slate-500">
        Editar una comisión existente: nombre, observaciones, horarios y aula.
      </p>

      {!comisionId && (
        <>
          <input
            type="text"
            value={texto}
            onChange={(e) => setTexto(e.target.value)}
            placeholder="Buscar materia o comisión..."
            aria-label="Buscar materia o comisión"
            className="mt-3 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-blue-500"
          />

          <div className="mt-3 space-y-1">
            {cargandoLista && <Cargando className="text-sm text-slate-400" />}
            {!cargandoLista && opciones.length === 0 && (
              <p className="text-sm text-slate-400">Sin resultados.</p>
            )}
            {opciones.map((o) => (
              <button
                key={o.comision_id}
                onClick={() => seleccionar(o.comision_id)}
                className="block w-full rounded-lg border border-slate-200 bg-white p-2 text-left text-sm active:bg-slate-50"
              >
                <span className="font-medium text-slate-800">{o.materia}</span>
                <span className="text-slate-500"> · {o.nombre_comision}</span>
              </button>
            ))}
          </div>
        </>
      )}

      {comisionId && (
        <div className="mt-4">
          <button onClick={volver} className="text-sm font-medium text-blue-600">
            ← Volver a la búsqueda
          </button>

          {cargandoDetalle && <Cargando className="mt-3 text-sm text-slate-400" />}

          {mensaje && (
            <p
              className={`mt-3 rounded-lg p-2 text-sm ${
                mensaje.startsWith('Error') ? 'bg-red-50 text-red-700' : 'bg-emerald-50 text-emerald-700'
              }`}
            >
              {mensaje}
            </p>
          )}

          {comision && (
            <div className="mt-3 rounded-xl border border-slate-200 bg-white p-3">
              <label htmlFor="comision-nombre" className="block text-xs font-medium text-slate-500">Nombre de la comisión</label>
              <input
                id="comision-nombre"
                type="text"
                value={comision.nombre_comision}
                onChange={(e) => setComision({ ...comision, nombre_comision: e.target.value })}
                className="mt-1 w-full rounded-lg border border-slate-300 px-2 py-1 text-sm"
              />
              <label htmlFor="comision-observaciones" className="mt-2 block text-xs font-medium text-slate-500">Observaciones</label>
              <textarea
                id="comision-observaciones"
                value={comision.observaciones ?? ''}
                onChange={(e) => setComision({ ...comision, observaciones: e.target.value })}
                rows={2}
                className="mt-1 w-full rounded-lg border border-slate-300 px-2 py-1 text-sm"
              />
              <button
                onClick={guardarComision}
                disabled={guardando}
                className="mt-2 rounded-lg bg-blue-600 px-3 py-1 text-sm font-medium text-white disabled:opacity-50"
              >
                Guardar comisión
              </button>
            </div>
          )}

          {bloquesEdit.map((b) => (
            <div key={b.id} className="mt-3 rounded-xl border border-slate-200 bg-white p-3">
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label htmlFor={`bloque-${b.id}-dia`} className="block text-xs font-medium text-slate-500">Día</label>
                  <select
                    id={`bloque-${b.id}-dia`}
                    value={b.dia}
                    onChange={(e) => actualizarBloque(b.id, 'dia', e.target.value as DiaSemana)}
                    className="mt-1 w-full rounded-lg border border-slate-300 px-2 py-1 text-sm"
                  >
                    {DIAS_SEMANA.map((d) => (
                      <option key={d} value={d}>
                        {formatDia(d)}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label htmlFor={`bloque-${b.id}-tipo`} className="block text-xs font-medium text-slate-500">Tipo</label>
                  <input
                    id={`bloque-${b.id}-tipo`}
                    type="text"
                    value={b.tipo ?? ''}
                    onChange={(e) => actualizarBloque(b.id, 'tipo', e.target.value)}
                    className="mt-1 w-full rounded-lg border border-slate-300 px-2 py-1 text-sm"
                  />
                </div>
                <div>
                  <label htmlFor={`bloque-${b.id}-hora-inicio`} className="block text-xs font-medium text-slate-500">Hora inicio</label>
                  <input
                    id={`bloque-${b.id}-hora-inicio`}
                    type="time"
                    value={b.hora_inicio.slice(0, 5)}
                    onChange={(e) => actualizarBloque(b.id, 'hora_inicio', e.target.value)}
                    className="mt-1 w-full rounded-lg border border-slate-300 px-2 py-1 text-sm"
                  />
                </div>
                <div>
                  <label htmlFor={`bloque-${b.id}-hora-fin`} className="block text-xs font-medium text-slate-500">Hora fin</label>
                  <input
                    id={`bloque-${b.id}-hora-fin`}
                    type="time"
                    value={b.hora_fin.slice(0, 5)}
                    onChange={(e) => actualizarBloque(b.id, 'hora_fin', e.target.value)}
                    className="mt-1 w-full rounded-lg border border-slate-300 px-2 py-1 text-sm"
                  />
                </div>
                <div className="col-span-2">
                  <label htmlFor={`bloque-${b.id}-aula`} className="block text-xs font-medium text-slate-500">Aula</label>
                  <input
                    id={`bloque-${b.id}-aula`}
                    type="text"
                    value={b.aula ?? ''}
                    onChange={(e) => actualizarBloque(b.id, 'aula', e.target.value)}
                    className="mt-1 w-full rounded-lg border border-slate-300 px-2 py-1 text-sm"
                  />
                </div>
                <label className="col-span-2 flex items-center gap-2 text-sm text-slate-600">
                  <input
                    type="checkbox"
                    checked={b.aula_cambia_durante_cuatri}
                    onChange={(e) => actualizarBloque(b.id, 'aula_cambia_durante_cuatri', e.target.checked)}
                  />
                  El aula cambia durante el cuatrimestre
                </label>
                {b.aula_cambia_durante_cuatri && (
                  <div className="col-span-2">
                    <label htmlFor={`bloque-${b.id}-detalle`} className="block text-xs font-medium text-slate-500">Detalle de aula</label>
                    <textarea
                      id={`bloque-${b.id}-detalle`}
                      value={b.aula_detalle ?? ''}
                      onChange={(e) => actualizarBloque(b.id, 'aula_detalle', e.target.value)}
                      rows={2}
                      className="mt-1 w-full rounded-lg border border-slate-300 px-2 py-1 text-sm"
                    />
                  </div>
                )}
              </div>
              <button
                onClick={() => guardarBloque(b)}
                disabled={guardando}
                className="mt-3 rounded-lg bg-blue-600 px-3 py-1 text-sm font-medium text-white disabled:opacity-50"
              >
                Guardar bloque
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
