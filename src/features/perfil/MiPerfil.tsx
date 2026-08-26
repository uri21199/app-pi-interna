import { useEffect, useMemo, useState } from 'react';
import { useAuth } from '../../shared/AuthProvider';
import { supabase } from '../../shared/supabase';
import { registrarCambio } from './historial';
import { DIAS_SEMANA, type CursadaMilitante, type DiaSemana, type TrabajoMilitante } from '../grilla/types/db';
import { Cargando } from '../../shared/Spinner';
import { HorarioFijoMesita } from './HorarioFijoMesita';
import { MisTurnosMesita } from './MisTurnosMesita';

type NuevaCursada = { materia: string; dia: DiaSemana; hora_inicio: string; hora_fin: string };
type NuevoTrabajo = { dia: DiaSemana; hora_inicio: string; hora_fin: string };

const CURSADA_VACIA: NuevaCursada = { materia: '', dia: 'Lunes', hora_inicio: '', hora_fin: '' };
const TRABAJO_VACIO: NuevoTrabajo = { dia: 'Lunes', hora_inicio: '', hora_fin: '' };

const CAMPOS_CURSADA = ['materia', 'dia', 'hora_inicio', 'hora_fin'] as const;
const CAMPOS_TRABAJO = ['dia', 'hora_inicio', 'hora_fin'] as const;

// hora_inicio/hora_fin llegan como "HH:MM:SS" desde la DB pero como "HH:MM"
// desde un <input type="time"> — se normalizan acá para que el historial no
// registre un "cambio" de formato como si fuera un cambio de valor real.
function normalizarValor(campo: string, valor: string): string {
  return campo === 'hora_inicio' || campo === 'hora_fin' ? valor.slice(0, 5) : valor;
}

function filaTieneCambios<T>(original: T | undefined, actual: T | undefined, campos: readonly (keyof T)[]): boolean {
  if (!original || !actual) return false;
  return campos.some((campo) => {
    const nombre = String(campo);
    return normalizarValor(nombre, String(original[campo])) !== normalizarValor(nombre, String(actual[campo]));
  });
}

function describirCursada(c: { materia: string; dia: string; hora_inicio: string; hora_fin: string }): string {
  return `${c.materia} · ${c.dia} ${c.hora_inicio.slice(0, 5)}-${c.hora_fin.slice(0, 5)}`;
}

function describirTrabajo(t: { dia: string; hora_inicio: string; hora_fin: string }): string {
  return `${t.dia} ${t.hora_inicio.slice(0, 5)}-${t.hora_fin.slice(0, 5)}`;
}

function porDia<T extends { dia: DiaSemana; hora_inicio: string }>(items: T[]): [DiaSemana, T[]][] {
  return DIAS_SEMANA.map((dia) => [dia, items.filter((i) => i.dia === dia).sort((a, b) => a.hora_inicio.localeCompare(b.hora_inicio))]).filter(
    ([, lista]) => lista.length > 0
  ) as [DiaSemana, T[]][];
}

function Mensaje({ texto }: { texto: string | null }) {
  if (!texto) return null;
  return (
    <p className={`mt-2 rounded-lg p-2 text-sm ${texto.startsWith('Error') ? 'bg-red-50 text-red-700' : 'bg-emerald-50 text-emerald-700'}`}>
      {texto}
    </p>
  );
}

function BotonIcono({ label, tono, onClick }: { label: string; tono: 'neutral' | 'peligro'; onClick: () => void }) {
  return (
    <button
      type="button"
      aria-label={label}
      title={label}
      onClick={onClick}
      className={`rounded-full p-1.5 text-slate-400 hover:bg-slate-100 ${tono === 'peligro' ? 'hover:text-red-600' : 'hover:text-slate-700'}`}
    >
      {label === 'Editar' ? '✎' : '🗑'}
    </button>
  );
}

export function MiPerfil() {
  const { perfil } = useAuth();
  const [cursada, setCursada] = useState<CursadaMilitante[]>([]);
  const [cursadaOriginal, setCursadaOriginal] = useState<Record<string, CursadaMilitante>>({});
  const [trabajo, setTrabajo] = useState<TrabajoMilitante[]>([]);
  const [trabajoOriginal, setTrabajoOriginal] = useState<Record<string, TrabajoMilitante>>({});
  const [cargando, setCargando] = useState(true);
  const [guardando, setGuardando] = useState(false);
  const [mensaje, setMensaje] = useState<string | null>(null);
  const [nuevaCursada, setNuevaCursada] = useState<NuevaCursada>(CURSADA_VACIA);
  const [nuevoTrabajo, setNuevoTrabajo] = useState<NuevoTrabajo>(TRABAJO_VACIO);
  const [cursadaEditandoId, setCursadaEditandoId] = useState<string | null>(null);
  const [trabajoEditandoId, setTrabajoEditandoId] = useState<string | null>(null);
  const [mostrarAgregarCursada, setMostrarAgregarCursada] = useState(false);
  const [mostrarAgregarTrabajo, setMostrarAgregarTrabajo] = useState(false);
  // HorarioFijoMesita y MisTurnosMesita son hermanos con estado propio; este
  // contador es cómo uno le avisa al otro que agregó/borró algo.
  const [horarioFijoVersion, setHorarioFijoVersion] = useState(0);

  useEffect(() => {
    if (!perfil) return;
    let activo = true;
    setCargando(true);
    Promise.all([
      supabase.from('cursada_militante').select('*').eq('militante_id', perfil.id).order('dia').order('hora_inicio'),
      supabase.from('trabajo_militante').select('*').eq('militante_id', perfil.id).order('dia').order('hora_inicio'),
    ]).then(([{ data: c }, { data: t }]) => {
      if (!activo) return;
      setCursada(c ?? []);
      setCursadaOriginal(Object.fromEntries((c ?? []).map((row) => [row.id, row])));
      setTrabajo(t ?? []);
      setTrabajoOriginal(Object.fromEntries((t ?? []).map((row) => [row.id, row])));
      setCargando(false);
    });
    return () => {
      activo = false;
    };
  }, [perfil]);

  const hayCambiosSinGuardar = useMemo(() => {
    if (cursadaEditandoId) {
      const actual = cursada.find((c) => c.id === cursadaEditandoId);
      if (filaTieneCambios(cursadaOriginal[cursadaEditandoId], actual, CAMPOS_CURSADA)) return true;
    }
    if (trabajoEditandoId) {
      const actual = trabajo.find((t) => t.id === trabajoEditandoId);
      if (filaTieneCambios(trabajoOriginal[trabajoEditandoId], actual, CAMPOS_TRABAJO)) return true;
    }
    if (mostrarAgregarCursada && (nuevaCursada.materia.trim() || nuevaCursada.hora_inicio || nuevaCursada.hora_fin)) return true;
    if (mostrarAgregarTrabajo && (nuevoTrabajo.hora_inicio || nuevoTrabajo.hora_fin)) return true;
    return false;
  }, [
    cursadaEditandoId,
    cursada,
    cursadaOriginal,
    trabajoEditandoId,
    trabajo,
    trabajoOriginal,
    mostrarAgregarCursada,
    nuevaCursada,
    mostrarAgregarTrabajo,
    nuevoTrabajo,
  ]);

  useEffect(() => {
    if (!hayCambiosSinGuardar) return;
    function avisar(e: BeforeUnloadEvent) {
      e.preventDefault();
      e.returnValue = '';
    }
    window.addEventListener('beforeunload', avisar);
    return () => window.removeEventListener('beforeunload', avisar);
  }, [hayCambiosSinGuardar]);

  if (!perfil) {
    return <div className="p-4 text-sm text-slate-500">Tu cuenta todavía no está vinculada a ningún militante.</div>;
  }

  function actualizarCursadaLocal<K extends keyof CursadaMilitante>(id: string, campo: K, valor: CursadaMilitante[K]) {
    setCursada((prev) => prev.map((c) => (c.id === id ? { ...c, [campo]: valor } : c)));
  }

  function revertirCursadaLocal(id: string) {
    const original = cursadaOriginal[id];
    if (original) setCursada((prev) => prev.map((c) => (c.id === id ? original : c)));
  }

  function abrirEdicionCursada(id: string) {
    if (cursadaEditandoId && cursadaEditandoId !== id) {
      const actual = cursada.find((c) => c.id === cursadaEditandoId);
      if (
        filaTieneCambios(cursadaOriginal[cursadaEditandoId], actual, CAMPOS_CURSADA) &&
        !window.confirm('Tenés cambios sin guardar en esa cursada. ¿Descartarlos?')
      ) {
        return;
      }
      revertirCursadaLocal(cursadaEditandoId);
    }
    setMensaje(null);
    setCursadaEditandoId(id);
  }

  function cerrarEdicionCursada(id: string) {
    revertirCursadaLocal(id);
    setCursadaEditandoId(null);
  }

  const guardarCursada = async (c: CursadaMilitante): Promise<boolean> => {
    setGuardando(true);
    setMensaje(null);
    const { error } = await supabase
      .from('cursada_militante')
      .update({ materia: c.materia, dia: c.dia, hora_inicio: c.hora_inicio, hora_fin: c.hora_fin })
      .eq('id', c.id);
    if (error) {
      setGuardando(false);
      setMensaje(`Error: ${error.message}`);
      return false;
    }

    const original = cursadaOriginal[c.id];
    for (const campo of CAMPOS_CURSADA) {
      if (original && original[campo] !== c[campo]) {
        await registrarCambio({
          militanteId: perfil.id,
          modificadoPor: perfil.id,
          tabla: 'cursada_militante',
          registroId: c.id,
          campoModificado: campo,
          valorAnterior: normalizarValor(campo, original[campo]),
          valorNuevo: normalizarValor(campo, c[campo]),
          accion: 'editar',
        });
      }
    }
    setCursadaOriginal((prev) => ({ ...prev, [c.id]: c }));
    setGuardando(false);
    setMensaje('Cursada guardada.');
    return true;
  };

  const eliminarCursada = async (c: CursadaMilitante) => {
    if (!window.confirm(`¿Eliminar "${describirCursada(c)}"?`)) return;
    setGuardando(true);
    setMensaje(null);
    const { error } = await supabase.from('cursada_militante').delete().eq('id', c.id);
    if (error) {
      setGuardando(false);
      setMensaje(`Error: ${error.message}`);
      return;
    }
    await registrarCambio({
      militanteId: perfil.id,
      modificadoPor: perfil.id,
      tabla: 'cursada_militante',
      registroId: c.id,
      campoModificado: 'fila completa',
      valorAnterior: describirCursada(c),
      valorNuevo: null,
      accion: 'eliminar',
    });
    setCursada((prev) => prev.filter((x) => x.id !== c.id));
    setGuardando(false);
    setMensaje('Cursada eliminada.');
  };

  const agregarCursada = async () => {
    if (!nuevaCursada.materia.trim() || !nuevaCursada.hora_inicio || !nuevaCursada.hora_fin) return;
    setGuardando(true);
    setMensaje(null);
    const { data, error } = await supabase
      .from('cursada_militante')
      .insert({ militante_id: perfil.id, ...nuevaCursada, materia: nuevaCursada.materia.trim() })
      .select('*')
      .single();
    if (error || !data) {
      setGuardando(false);
      setMensaje(`Error: ${error?.message ?? 'no se pudo crear'}`);
      return;
    }
    await registrarCambio({
      militanteId: perfil.id,
      modificadoPor: perfil.id,
      tabla: 'cursada_militante',
      registroId: data.id,
      campoModificado: 'fila completa',
      valorAnterior: null,
      valorNuevo: describirCursada(data),
      accion: 'crear',
    });
    setCursada((prev) => [...prev, data]);
    setCursadaOriginal((prev) => ({ ...prev, [data.id]: data }));
    setNuevaCursada(CURSADA_VACIA);
    setGuardando(false);
    setMensaje('Cursada agregada.');
    setMostrarAgregarCursada(false);
  };

  function actualizarTrabajoLocal<K extends keyof TrabajoMilitante>(id: string, campo: K, valor: TrabajoMilitante[K]) {
    setTrabajo((prev) => prev.map((t) => (t.id === id ? { ...t, [campo]: valor } : t)));
  }

  function revertirTrabajoLocal(id: string) {
    const original = trabajoOriginal[id];
    if (original) setTrabajo((prev) => prev.map((t) => (t.id === id ? original : t)));
  }

  function abrirEdicionTrabajo(id: string) {
    if (trabajoEditandoId && trabajoEditandoId !== id) {
      const actual = trabajo.find((t) => t.id === trabajoEditandoId);
      if (
        filaTieneCambios(trabajoOriginal[trabajoEditandoId], actual, CAMPOS_TRABAJO) &&
        !window.confirm('Tenés cambios sin guardar en ese horario. ¿Descartarlos?')
      ) {
        return;
      }
      revertirTrabajoLocal(trabajoEditandoId);
    }
    setMensaje(null);
    setTrabajoEditandoId(id);
  }

  function cerrarEdicionTrabajo(id: string) {
    revertirTrabajoLocal(id);
    setTrabajoEditandoId(null);
  }

  const guardarTrabajo = async (t: TrabajoMilitante): Promise<boolean> => {
    setGuardando(true);
    setMensaje(null);
    const { error } = await supabase
      .from('trabajo_militante')
      .update({ dia: t.dia, hora_inicio: t.hora_inicio, hora_fin: t.hora_fin })
      .eq('id', t.id);
    if (error) {
      setGuardando(false);
      setMensaje(`Error: ${error.message}`);
      return false;
    }

    const original = trabajoOriginal[t.id];
    for (const campo of CAMPOS_TRABAJO) {
      if (original && original[campo] !== t[campo]) {
        await registrarCambio({
          militanteId: perfil.id,
          modificadoPor: perfil.id,
          tabla: 'trabajo_militante',
          registroId: t.id,
          campoModificado: campo,
          valorAnterior: normalizarValor(campo, original[campo]),
          valorNuevo: normalizarValor(campo, t[campo]),
          accion: 'editar',
        });
      }
    }
    setTrabajoOriginal((prev) => ({ ...prev, [t.id]: t }));
    setGuardando(false);
    setMensaje('Trabajo guardado.');
    return true;
  };

  const eliminarTrabajo = async (t: TrabajoMilitante) => {
    if (!window.confirm(`¿Eliminar "${describirTrabajo(t)}"?`)) return;
    setGuardando(true);
    setMensaje(null);
    const { error } = await supabase.from('trabajo_militante').delete().eq('id', t.id);
    if (error) {
      setGuardando(false);
      setMensaje(`Error: ${error.message}`);
      return;
    }
    await registrarCambio({
      militanteId: perfil.id,
      modificadoPor: perfil.id,
      tabla: 'trabajo_militante',
      registroId: t.id,
      campoModificado: 'fila completa',
      valorAnterior: describirTrabajo(t),
      valorNuevo: null,
      accion: 'eliminar',
    });
    setTrabajo((prev) => prev.filter((x) => x.id !== t.id));
    setGuardando(false);
    setMensaje('Trabajo eliminado.');
  };

  const agregarTrabajo = async () => {
    if (!nuevoTrabajo.hora_inicio || !nuevoTrabajo.hora_fin) return;
    setGuardando(true);
    setMensaje(null);
    const { data, error } = await supabase
      .from('trabajo_militante')
      .insert({ militante_id: perfil.id, ...nuevoTrabajo })
      .select('*')
      .single();
    if (error || !data) {
      setGuardando(false);
      setMensaje(`Error: ${error?.message ?? 'no se pudo crear'}`);
      return;
    }
    await registrarCambio({
      militanteId: perfil.id,
      modificadoPor: perfil.id,
      tabla: 'trabajo_militante',
      registroId: data.id,
      campoModificado: 'fila completa',
      valorAnterior: null,
      valorNuevo: describirTrabajo(data),
      accion: 'crear',
    });
    setTrabajo((prev) => [...prev, data]);
    setTrabajoOriginal((prev) => ({ ...prev, [data.id]: data }));
    setNuevoTrabajo(TRABAJO_VACIO);
    setGuardando(false);
    setMensaje('Trabajo agregado.');
    setMostrarAgregarTrabajo(false);
  };

  return (
    <div className="mx-auto max-w-2xl p-4 pb-10">
      <h1 className="text-lg font-semibold text-slate-800">Mi perfil</h1>
      <p className="mt-1 text-sm text-slate-500">
        {perfil.nombre} · {perfil.email}
      </p>

      {cargando && <Cargando className="mt-4 text-sm text-slate-400" />}
      <Mensaje texto={mensaje} />

      {!cargando && (
        <>
          <div className="mt-5 flex items-center justify-between">
            <h2 className="text-sm font-semibold text-slate-700">Cursada</h2>
            <button
              onClick={() => setMostrarAgregarCursada((v) => !v)}
              className="text-sm font-medium text-blue-600"
            >
              {mostrarAgregarCursada ? 'Cancelar' : '+ Agregar'}
            </button>
          </div>

          {cursada.length === 0 && !mostrarAgregarCursada && (
            <p className="mt-2 text-sm text-slate-400">Todavía no agregaste ninguna cursada.</p>
          )}

          {porDia(cursada).map(([dia, delDia]) => (
            <div key={dia} className="mt-3">
              <h3 className="text-xs font-semibold uppercase tracking-wide text-slate-400">{dia}</h3>
              <div className="mt-1.5 space-y-1.5">
                {delDia.map((c) =>
                  cursadaEditandoId === c.id ? (
                    <div key={c.id} className="rounded-xl border border-blue-200 bg-blue-50/40 p-3">
                      <div className="grid grid-cols-2 gap-2">
                        <div className="col-span-2">
                          <label htmlFor={`cursada-${c.id}-materia`} className="block text-xs font-medium text-slate-500">Materia</label>
                          <input
                            id={`cursada-${c.id}-materia`}
                            type="text"
                            value={c.materia}
                            onChange={(e) => actualizarCursadaLocal(c.id, 'materia', e.target.value)}
                            className="mt-1 w-full rounded-lg border border-slate-300 px-2 py-1 text-sm"
                          />
                        </div>
                        <div>
                          <label htmlFor={`cursada-${c.id}-dia`} className="block text-xs font-medium text-slate-500">Día</label>
                          <select
                            id={`cursada-${c.id}-dia`}
                            value={c.dia}
                            onChange={(e) => actualizarCursadaLocal(c.id, 'dia', e.target.value as DiaSemana)}
                            className="mt-1 w-full rounded-lg border border-slate-300 px-2 py-1 text-sm"
                          >
                            {DIAS_SEMANA.map((d) => (
                              <option key={d} value={d}>
                                {d}
                              </option>
                            ))}
                          </select>
                        </div>
                        <div />
                        <div>
                          <label htmlFor={`cursada-${c.id}-hora-inicio`} className="block text-xs font-medium text-slate-500">Hora inicio</label>
                          <input
                            id={`cursada-${c.id}-hora-inicio`}
                            type="time"
                            value={c.hora_inicio.slice(0, 5)}
                            onChange={(e) => actualizarCursadaLocal(c.id, 'hora_inicio', e.target.value)}
                            className="mt-1 w-full rounded-lg border border-slate-300 px-2 py-1 text-sm"
                          />
                        </div>
                        <div>
                          <label htmlFor={`cursada-${c.id}-hora-fin`} className="block text-xs font-medium text-slate-500">Hora fin</label>
                          <input
                            id={`cursada-${c.id}-hora-fin`}
                            type="time"
                            value={c.hora_fin.slice(0, 5)}
                            onChange={(e) => actualizarCursadaLocal(c.id, 'hora_fin', e.target.value)}
                            className="mt-1 w-full rounded-lg border border-slate-300 px-2 py-1 text-sm"
                          />
                        </div>
                      </div>
                      <div className="mt-3 flex gap-2">
                        <button
                          onClick={async () => {
                            if (await guardarCursada(c)) setCursadaEditandoId(null);
                          }}
                          disabled={guardando}
                          className="rounded-lg bg-blue-600 px-3 py-1 text-sm font-medium text-white disabled:opacity-50"
                        >
                          Guardar
                        </button>
                        <button
                          onClick={() => cerrarEdicionCursada(c.id)}
                          disabled={guardando}
                          className="rounded-lg border border-slate-300 px-3 py-1 text-sm font-medium text-slate-600 disabled:opacity-50"
                        >
                          Cancelar
                        </button>
                        <button
                          onClick={() => eliminarCursada(c)}
                          disabled={guardando}
                          className="ml-auto rounded-lg border border-red-300 px-3 py-1 text-sm font-medium text-red-600 disabled:opacity-50"
                        >
                          Eliminar
                        </button>
                      </div>
                    </div>
                  ) : (
                    <div key={c.id} className="flex items-center justify-between rounded-lg bg-white px-3 py-2 shadow-sm">
                      <div>
                        <p className="text-sm font-medium text-slate-800">{c.materia}</p>
                        <p className="text-xs text-slate-500">{c.hora_inicio.slice(0, 5)}–{c.hora_fin.slice(0, 5)}</p>
                      </div>
                      <div className="flex gap-0.5">
                        <BotonIcono label="Editar" tono="neutral" onClick={() => abrirEdicionCursada(c.id)} />
                        <BotonIcono label="Eliminar" tono="peligro" onClick={() => eliminarCursada(c)} />
                      </div>
                    </div>
                  )
                )}
              </div>
            </div>
          ))}

          {mostrarAgregarCursada && (
            <div className="mt-3 rounded-xl border border-dashed border-slate-300 bg-white p-3">
              <p className="text-xs font-medium text-slate-500">Nueva cursada</p>
              <div className="mt-1 grid grid-cols-2 gap-2">
                <input
                  type="text"
                  placeholder="Materia"
                  aria-label="Materia"
                  value={nuevaCursada.materia}
                  onChange={(e) => setNuevaCursada({ ...nuevaCursada, materia: e.target.value })}
                  className="col-span-2 rounded-lg border border-slate-300 px-2 py-1 text-sm"
                />
                <select
                  aria-label="Día"
                  value={nuevaCursada.dia}
                  onChange={(e) => setNuevaCursada({ ...nuevaCursada, dia: e.target.value as DiaSemana })}
                  className="rounded-lg border border-slate-300 px-2 py-1 text-sm"
                >
                  {DIAS_SEMANA.map((d) => (
                    <option key={d} value={d}>
                      {d}
                    </option>
                  ))}
                </select>
                <div />
                <input
                  type="time"
                  aria-label="Hora inicio"
                  value={nuevaCursada.hora_inicio}
                  onChange={(e) => setNuevaCursada({ ...nuevaCursada, hora_inicio: e.target.value })}
                  className="rounded-lg border border-slate-300 px-2 py-1 text-sm"
                />
                <input
                  type="time"
                  aria-label="Hora fin"
                  value={nuevaCursada.hora_fin}
                  onChange={(e) => setNuevaCursada({ ...nuevaCursada, hora_fin: e.target.value })}
                  className="rounded-lg border border-slate-300 px-2 py-1 text-sm"
                />
              </div>
              <button
                onClick={agregarCursada}
                disabled={guardando}
                className="mt-2 rounded-lg bg-blue-600 px-3 py-1 text-sm font-medium text-white disabled:opacity-50"
              >
                Agregar
              </button>
            </div>
          )}

          <div className="mt-6 flex items-center justify-between">
            <h2 className="text-sm font-semibold text-slate-700">Trabajo</h2>
            <button
              onClick={() => setMostrarAgregarTrabajo((v) => !v)}
              className="text-sm font-medium text-blue-600"
            >
              {mostrarAgregarTrabajo ? 'Cancelar' : '+ Agregar'}
            </button>
          </div>

          {trabajo.length === 0 && !mostrarAgregarTrabajo && (
            <p className="mt-2 text-sm text-slate-400">Todavía no agregaste ningún horario de trabajo.</p>
          )}

          {porDia(trabajo).map(([dia, delDia]) => (
            <div key={dia} className="mt-3">
              <h3 className="text-xs font-semibold uppercase tracking-wide text-slate-400">{dia}</h3>
              <div className="mt-1.5 space-y-1.5">
                {delDia.map((t) =>
                  trabajoEditandoId === t.id ? (
                    <div key={t.id} className="rounded-xl border border-blue-200 bg-blue-50/40 p-3">
                      <div className="grid grid-cols-2 gap-2">
                        <div>
                          <label htmlFor={`trabajo-${t.id}-dia`} className="block text-xs font-medium text-slate-500">Día</label>
                          <select
                            id={`trabajo-${t.id}-dia`}
                            value={t.dia}
                            onChange={(e) => actualizarTrabajoLocal(t.id, 'dia', e.target.value as DiaSemana)}
                            className="mt-1 w-full rounded-lg border border-slate-300 px-2 py-1 text-sm"
                          >
                            {DIAS_SEMANA.map((d) => (
                              <option key={d} value={d}>
                                {d}
                              </option>
                            ))}
                          </select>
                        </div>
                        <div />
                        <div>
                          <label htmlFor={`trabajo-${t.id}-hora-inicio`} className="block text-xs font-medium text-slate-500">Hora inicio</label>
                          <input
                            id={`trabajo-${t.id}-hora-inicio`}
                            type="time"
                            value={t.hora_inicio.slice(0, 5)}
                            onChange={(e) => actualizarTrabajoLocal(t.id, 'hora_inicio', e.target.value)}
                            className="mt-1 w-full rounded-lg border border-slate-300 px-2 py-1 text-sm"
                          />
                        </div>
                        <div>
                          <label htmlFor={`trabajo-${t.id}-hora-fin`} className="block text-xs font-medium text-slate-500">Hora fin</label>
                          <input
                            id={`trabajo-${t.id}-hora-fin`}
                            type="time"
                            value={t.hora_fin.slice(0, 5)}
                            onChange={(e) => actualizarTrabajoLocal(t.id, 'hora_fin', e.target.value)}
                            className="mt-1 w-full rounded-lg border border-slate-300 px-2 py-1 text-sm"
                          />
                        </div>
                      </div>
                      <div className="mt-3 flex gap-2">
                        <button
                          onClick={async () => {
                            if (await guardarTrabajo(t)) setTrabajoEditandoId(null);
                          }}
                          disabled={guardando}
                          className="rounded-lg bg-blue-600 px-3 py-1 text-sm font-medium text-white disabled:opacity-50"
                        >
                          Guardar
                        </button>
                        <button
                          onClick={() => cerrarEdicionTrabajo(t.id)}
                          disabled={guardando}
                          className="rounded-lg border border-slate-300 px-3 py-1 text-sm font-medium text-slate-600 disabled:opacity-50"
                        >
                          Cancelar
                        </button>
                        <button
                          onClick={() => eliminarTrabajo(t)}
                          disabled={guardando}
                          className="ml-auto rounded-lg border border-red-300 px-3 py-1 text-sm font-medium text-red-600 disabled:opacity-50"
                        >
                          Eliminar
                        </button>
                      </div>
                    </div>
                  ) : (
                    <div key={t.id} className="flex items-center justify-between rounded-lg bg-white px-3 py-2 shadow-sm">
                      <p className="text-sm font-medium text-slate-800">{t.hora_inicio.slice(0, 5)}–{t.hora_fin.slice(0, 5)}</p>
                      <div className="flex gap-0.5">
                        <BotonIcono label="Editar" tono="neutral" onClick={() => abrirEdicionTrabajo(t.id)} />
                        <BotonIcono label="Eliminar" tono="peligro" onClick={() => eliminarTrabajo(t)} />
                      </div>
                    </div>
                  )
                )}
              </div>
            </div>
          ))}

          {mostrarAgregarTrabajo && (
            <div className="mt-3 rounded-xl border border-dashed border-slate-300 bg-white p-3">
              <p className="text-xs font-medium text-slate-500">Nuevo horario de trabajo</p>
              <div className="mt-1 grid grid-cols-2 gap-2">
                <select
                  aria-label="Día"
                  value={nuevoTrabajo.dia}
                  onChange={(e) => setNuevoTrabajo({ ...nuevoTrabajo, dia: e.target.value as DiaSemana })}
                  className="col-span-2 rounded-lg border border-slate-300 px-2 py-1 text-sm"
                >
                  {DIAS_SEMANA.map((d) => (
                    <option key={d} value={d}>
                      {d}
                    </option>
                  ))}
                </select>
                <input
                  type="time"
                  aria-label="Hora inicio"
                  value={nuevoTrabajo.hora_inicio}
                  onChange={(e) => setNuevoTrabajo({ ...nuevoTrabajo, hora_inicio: e.target.value })}
                  className="rounded-lg border border-slate-300 px-2 py-1 text-sm"
                />
                <input
                  type="time"
                  aria-label="Hora fin"
                  value={nuevoTrabajo.hora_fin}
                  onChange={(e) => setNuevoTrabajo({ ...nuevoTrabajo, hora_fin: e.target.value })}
                  className="rounded-lg border border-slate-300 px-2 py-1 text-sm"
                />
              </div>
              <button
                onClick={agregarTrabajo}
                disabled={guardando}
                className="mt-2 rounded-lg bg-blue-600 px-3 py-1 text-sm font-medium text-white disabled:opacity-50"
              >
                Agregar
              </button>
            </div>
          )}

          <HorarioFijoMesita perfil={perfil} onCambio={() => setHorarioFijoVersion((v) => v + 1)} />
          <MisTurnosMesita perfil={perfil} refrescarSenal={horarioFijoVersion} />
        </>
      )}
    </div>
  );
}
