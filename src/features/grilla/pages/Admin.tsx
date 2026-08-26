import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { supabase } from '../../../shared/supabase';
import { formatDateLocal, lunesDeLaSemana } from '../lib/dia';
import { coincide } from '../../pasadas/lib/texto';
import { Cargando } from '../../../shared/Spinner';
import { useAuth } from '../../../shared/AuthProvider';
import { registrarCambio } from '../../perfil/historial';
import { DIAS_SEMANA, type CursadaMilitante, type DiaSemana, type Militante, type TrabajoMilitante } from '../types/db';

type NuevaCursada = { materia: string; dia: DiaSemana; hora_inicio: string; hora_fin: string };
type NuevoTrabajo = { dia: DiaSemana; hora_inicio: string; hora_fin: string };

const CURSADA_VACIA: NuevaCursada = { materia: '', dia: 'Lunes', hora_inicio: '', hora_fin: '' };
const TRABAJO_VACIO: NuevoTrabajo = { dia: 'Lunes', hora_inicio: '', hora_fin: '' };

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

function filaTieneCambios<T>(original: T | undefined, actual: T, campos: readonly (keyof T)[]): boolean {
  if (!original) return false;
  return campos.some((campo) => {
    const a = String(original[campo]);
    const b = String(actual[campo]);
    return campo === 'hora_inicio' || campo === 'hora_fin' ? a.slice(0, 5) !== b.slice(0, 5) : a !== b;
  });
}

const CAMPOS_CURSADA = ['materia', 'dia', 'hora_inicio', 'hora_fin'] as const;
const CAMPOS_TRABAJO = ['dia', 'hora_inicio', 'hora_fin'] as const;

function normalizarValor(campo: string, valor: string): string {
  return campo === 'hora_inicio' || campo === 'hora_fin' ? valor.slice(0, 5) : valor;
}

function describirCursada(c: { materia: string; dia: string; hora_inicio: string; hora_fin: string }): string {
  return `${c.materia} · ${c.dia} ${c.hora_inicio.slice(0, 5)}-${c.hora_fin.slice(0, 5)}`;
}

function describirTrabajo(t: { dia: string; hora_inicio: string; hora_fin: string }): string {
  return `${t.dia} ${t.hora_inicio.slice(0, 5)}-${t.hora_fin.slice(0, 5)}`;
}

function EjeSemanalCard() {
  const [texto, setTexto] = useState('');
  const [cargando, setCargando] = useState(true);
  const [guardando, setGuardando] = useState(false);
  const [mensaje, setMensaje] = useState<string | null>(null);
  const semana = lunesDeLaSemana(formatDateLocal(new Date()));

  useEffect(() => {
    supabase
      .from('ejes_semanales')
      .select('texto')
      .eq('semana', semana)
      .maybeSingle()
      .then(({ data }) => {
        setTexto(data?.texto ?? '');
        setCargando(false);
      });
  }, [semana]);

  async function guardar() {
    setGuardando(true);
    setMensaje(null);
    const { error } = await supabase.from('ejes_semanales').upsert({ semana, texto }, { onConflict: 'semana' });
    setGuardando(false);
    setMensaje(error ? errorAmigable('guardar el eje', error) : 'Eje guardado.');
  }

  return (
    <div className="rounded-xl border border-slate-200 bg-white p-3">
      <h2 className="text-sm font-semibold text-slate-700">Eje de la semana (desde {semana})</h2>
      {cargando ? (
        <Cargando className="mt-2 text-sm text-slate-400" />
      ) : (
        <>
          <textarea
            aria-label="Eje de la semana"
            value={texto}
            onChange={(e) => setTexto(e.target.value)}
            rows={2}
            placeholder="Texto que se manda en el mail de esta semana"
            className="mt-2 w-full rounded-lg border border-slate-300 px-2 py-1 text-sm"
          />
          <button
            onClick={guardar}
            disabled={guardando}
            className="mt-2 rounded-lg bg-blue-600 px-3 py-1 text-sm font-medium text-white disabled:opacity-50"
          >
            Guardar eje
          </button>
          <Mensaje texto={mensaje} />
        </>
      )}
    </div>
  );
}

export function GrillasAdmin() {
  const { perfil: admin } = useAuth();
  const [militantes, setMilitantes] = useState<Militante[]>([]);
  const [cargandoLista, setCargandoLista] = useState(true);
  const [nuevoNombre, setNuevoNombre] = useState('');
  const [nuevoEmail, setNuevoEmail] = useState('');
  const [creando, setCreando] = useState(false);
  const [mensajeLista, setMensajeLista] = useState<string | null>(null);
  const [busqueda, setBusqueda] = useState('');

  const [seleccionado, setSeleccionado] = useState<Militante | null>(null);
  const [cursada, setCursada] = useState<CursadaMilitante[]>([]);
  const [cursadaOriginal, setCursadaOriginal] = useState<Record<string, CursadaMilitante>>({});
  const [trabajo, setTrabajo] = useState<TrabajoMilitante[]>([]);
  const [trabajoOriginal, setTrabajoOriginal] = useState<Record<string, TrabajoMilitante>>({});
  const [cargandoDetalle, setCargandoDetalle] = useState(false);
  const [mensaje, setMensaje] = useState<string | null>(null);
  const [nuevaCursada, setNuevaCursada] = useState<NuevaCursada>(CURSADA_VACIA);
  const [nuevoTrabajo, setNuevoTrabajo] = useState<NuevoTrabajo>(TRABAJO_VACIO);
  // Estado de "ocupado" por sección/fila en vez de un solo flag global: así
  // guardar una fila no deshabilita los botones de las demás filas ni de la
  // otra sección (cursada vs. trabajo).
  const [cursadaOcupada, setCursadaOcupada] = useState<string | null>(null);
  const [agregandoCursada, setAgregandoCursada] = useState(false);
  const [trabajoOcupado, setTrabajoOcupado] = useState<string | null>(null);
  const [agregandoTrabajo, setAgregandoTrabajo] = useState(false);

  const militantesFiltrados = useMemo(() => {
    if (!busqueda.trim()) return militantes;
    return militantes.filter((m) => coincide(`${m.nombre} ${m.email}`, busqueda));
  }, [militantes, busqueda]);

  const hayCambiosSinGuardar = useMemo(() => {
    if (cursada.some((c) => filaTieneCambios(cursadaOriginal[c.id], c, CAMPOS_CURSADA))) return true;
    if (trabajo.some((t) => filaTieneCambios(trabajoOriginal[t.id], t, CAMPOS_TRABAJO))) return true;
    if (nuevaCursada.materia.trim() || nuevaCursada.hora_inicio || nuevaCursada.hora_fin) return true;
    if (nuevoTrabajo.hora_inicio || nuevoTrabajo.hora_fin) return true;
    return false;
  }, [cursada, cursadaOriginal, trabajo, trabajoOriginal, nuevaCursada, nuevoTrabajo]);

  useEffect(() => {
    if (!hayCambiosSinGuardar) return;
    function avisar(e: BeforeUnloadEvent) {
      e.preventDefault();
      e.returnValue = '';
    }
    window.addEventListener('beforeunload', avisar);
    return () => window.removeEventListener('beforeunload', avisar);
  }, [hayCambiosSinGuardar]);

  function cargarMilitantes() {
    setCargandoLista(true);
    supabase
      .from('militantes')
      .select('*')
      .order('nombre')
      .then(({ data }) => {
        setMilitantes(data ?? []);
        setCargandoLista(false);
      });
  }

  useEffect(cargarMilitantes, []);

  async function crearMilitante() {
    if (!nuevoNombre.trim() || !nuevoEmail.trim()) return;
    setCreando(true);
    setMensajeLista(null);
    const { error } = await supabase.from('militantes').insert({ nombre: nuevoNombre.trim(), email: nuevoEmail.trim() });
    setCreando(false);
    if (error) {
      setMensajeLista(errorAmigable('agregar el militante', error));
      return;
    }
    setNuevoNombre('');
    setNuevoEmail('');
    setMensajeLista('Militante agregado.');
    cargarMilitantes();
  }

  async function seleccionar(m: Militante) {
    setSeleccionado(m);
    setMensaje(null);
    setNuevaCursada(CURSADA_VACIA);
    setNuevoTrabajo(TRABAJO_VACIO);
    setCargandoDetalle(true);
    const [{ data: c }, { data: t }] = await Promise.all([
      supabase.from('cursada_militante').select('*').eq('militante_id', m.id).order('dia').order('hora_inicio'),
      supabase.from('trabajo_militante').select('*').eq('militante_id', m.id).order('dia').order('hora_inicio'),
    ]);
    setCursada(c ?? []);
    setCursadaOriginal(Object.fromEntries((c ?? []).map((row) => [row.id, row])));
    setTrabajo(t ?? []);
    setTrabajoOriginal(Object.fromEntries((t ?? []).map((row) => [row.id, row])));
    setCargandoDetalle(false);
  }

  function volver() {
    if (hayCambiosSinGuardar && !window.confirm('Tenés cambios sin guardar. ¿Salir de todos modos?')) return;
    setSeleccionado(null);
    setCursada([]);
    setTrabajo([]);
  }

  function actualizarCursadaLocal<K extends keyof CursadaMilitante>(id: string, campo: K, valor: CursadaMilitante[K]) {
    setCursada((prev) => prev.map((c) => (c.id === id ? { ...c, [campo]: valor } : c)));
  }

  async function guardarCursada(c: CursadaMilitante) {
    setCursadaOcupada(c.id);
    setMensaje(null);
    const { error } = await supabase
      .from('cursada_militante')
      .update({ materia: c.materia, dia: c.dia, hora_inicio: c.hora_inicio, hora_fin: c.hora_fin })
      .eq('id', c.id);
    if (error) {
      setCursadaOcupada(null);
      setMensaje(errorAmigable('guardar la cursada', error));
      return;
    }

    const original = cursadaOriginal[c.id];
    for (const campo of CAMPOS_CURSADA) {
      if (original && original[campo] !== c[campo]) {
        await registrarCambio({
          militanteId: c.militante_id,
          modificadoPor: admin?.id ?? c.militante_id,
          tabla: 'cursada_militante',
          registroId: c.id,
          campoModificado: campo,
          valorAnterior: normalizarValor(campo, original[campo]),
          valorNuevo: normalizarValor(campo, c[campo]),
          accion: 'editar',
        });
      }
    }
    setCursadaOcupada(null);
    setCursadaOriginal((prev) => ({ ...prev, [c.id]: c }));
    setMensaje('Cursada guardada.');
  }

  async function eliminarCursada(c: CursadaMilitante) {
    if (!window.confirm('¿Eliminar esta cursada?')) return;
    setCursadaOcupada(c.id);
    setMensaje(null);
    const { error } = await supabase.from('cursada_militante').delete().eq('id', c.id);
    if (error) {
      setCursadaOcupada(null);
      setMensaje(errorAmigable('eliminar la cursada', error));
      return;
    }
    await registrarCambio({
      militanteId: c.militante_id,
      modificadoPor: admin?.id ?? c.militante_id,
      tabla: 'cursada_militante',
      registroId: c.id,
      campoModificado: 'fila completa',
      valorAnterior: describirCursada(c),
      valorNuevo: null,
      accion: 'eliminar',
    });
    setCursadaOcupada(null);
    setCursada((prev) => prev.filter((x) => x.id !== c.id));
    setMensaje('Cursada eliminada.');
  }

  async function agregarCursada() {
    if (!seleccionado || !nuevaCursada.materia.trim() || !nuevaCursada.hora_inicio || !nuevaCursada.hora_fin) return;
    setAgregandoCursada(true);
    setMensaje(null);
    const { data, error } = await supabase
      .from('cursada_militante')
      .insert({ militante_id: seleccionado.id, ...nuevaCursada, materia: nuevaCursada.materia.trim() })
      .select('*')
      .single();
    if (error || !data) {
      setAgregandoCursada(false);
      setMensaje(errorAmigable('agregar la cursada', error));
      return;
    }
    await registrarCambio({
      militanteId: seleccionado.id,
      modificadoPor: admin?.id ?? seleccionado.id,
      tabla: 'cursada_militante',
      registroId: data.id,
      campoModificado: 'fila completa',
      valorAnterior: null,
      valorNuevo: describirCursada(data),
      accion: 'crear',
    });
    setAgregandoCursada(false);
    setCursada((prev) => [...prev, data]);
    setCursadaOriginal((prev) => ({ ...prev, [data.id]: data }));
    setNuevaCursada(CURSADA_VACIA);
    setMensaje('Cursada agregada.');
  }

  function actualizarTrabajoLocal<K extends keyof TrabajoMilitante>(id: string, campo: K, valor: TrabajoMilitante[K]) {
    setTrabajo((prev) => prev.map((t) => (t.id === id ? { ...t, [campo]: valor } : t)));
  }

  async function guardarTrabajo(t: TrabajoMilitante) {
    setTrabajoOcupado(t.id);
    setMensaje(null);
    const { error } = await supabase
      .from('trabajo_militante')
      .update({ dia: t.dia, hora_inicio: t.hora_inicio, hora_fin: t.hora_fin })
      .eq('id', t.id);
    if (error) {
      setTrabajoOcupado(null);
      setMensaje(errorAmigable('guardar el trabajo', error));
      return;
    }

    const original = trabajoOriginal[t.id];
    for (const campo of CAMPOS_TRABAJO) {
      if (original && original[campo] !== t[campo]) {
        await registrarCambio({
          militanteId: t.militante_id,
          modificadoPor: admin?.id ?? t.militante_id,
          tabla: 'trabajo_militante',
          registroId: t.id,
          campoModificado: campo,
          valorAnterior: normalizarValor(campo, original[campo]),
          valorNuevo: normalizarValor(campo, t[campo]),
          accion: 'editar',
        });
      }
    }
    setTrabajoOcupado(null);
    setTrabajoOriginal((prev) => ({ ...prev, [t.id]: t }));
    setMensaje('Trabajo guardado.');
  }

  async function eliminarTrabajo(t: TrabajoMilitante) {
    if (!window.confirm('¿Eliminar este horario de trabajo?')) return;
    setTrabajoOcupado(t.id);
    setMensaje(null);
    const { error } = await supabase.from('trabajo_militante').delete().eq('id', t.id);
    if (error) {
      setTrabajoOcupado(null);
      setMensaje(errorAmigable('eliminar el trabajo', error));
      return;
    }
    await registrarCambio({
      militanteId: t.militante_id,
      modificadoPor: admin?.id ?? t.militante_id,
      tabla: 'trabajo_militante',
      registroId: t.id,
      campoModificado: 'fila completa',
      valorAnterior: describirTrabajo(t),
      valorNuevo: null,
      accion: 'eliminar',
    });
    setTrabajoOcupado(null);
    setTrabajo((prev) => prev.filter((x) => x.id !== t.id));
    setMensaje('Trabajo eliminado.');
  }

  async function agregarTrabajo() {
    if (!seleccionado || !nuevoTrabajo.hora_inicio || !nuevoTrabajo.hora_fin) return;
    setAgregandoTrabajo(true);
    setMensaje(null);
    const { data, error } = await supabase
      .from('trabajo_militante')
      .insert({ militante_id: seleccionado.id, ...nuevoTrabajo })
      .select('*')
      .single();
    if (error || !data) {
      setAgregandoTrabajo(false);
      setMensaje(errorAmigable('agregar el trabajo', error));
      return;
    }
    await registrarCambio({
      militanteId: seleccionado.id,
      modificadoPor: admin?.id ?? seleccionado.id,
      tabla: 'trabajo_militante',
      registroId: data.id,
      campoModificado: 'fila completa',
      valorAnterior: null,
      valorNuevo: describirTrabajo(data),
      accion: 'crear',
    });
    setAgregandoTrabajo(false);
    setTrabajo((prev) => [...prev, data]);
    setTrabajoOriginal((prev) => ({ ...prev, [data.id]: data }));
    setNuevoTrabajo(TRABAJO_VACIO);
    setMensaje('Trabajo agregado.');
  }

  return (
    <div className="mx-auto min-h-screen max-w-2xl bg-slate-50 p-4 pb-16">
      <h1 className="text-lg font-semibold text-slate-800">Grillas</h1>

      <div className="mt-3">
        <EjeSemanalCard />
      </div>

      {!seleccionado && (
        <div className="mt-4">
          <h2 className="text-sm font-semibold text-slate-700">Militantes</h2>

          <div className="mt-2 rounded-xl border border-slate-200 bg-white p-3">
            <p className="text-xs font-medium text-slate-500">Agregar militante</p>
            <div className="mt-1 flex flex-col gap-2 sm:flex-row">
              <input
                type="text"
                placeholder="Nombre"
                aria-label="Nombre"
                value={nuevoNombre}
                onChange={(e) => setNuevoNombre(e.target.value)}
                className="flex-1 rounded-lg border border-slate-300 px-2 py-1 text-sm"
              />
              <input
                type="email"
                placeholder="Email"
                aria-label="Email"
                value={nuevoEmail}
                onChange={(e) => setNuevoEmail(e.target.value)}
                className="flex-1 rounded-lg border border-slate-300 px-2 py-1 text-sm"
              />
              <button
                onClick={crearMilitante}
                disabled={creando}
                className="rounded-lg bg-blue-600 px-3 py-1 text-sm font-medium text-white disabled:opacity-50"
              >
                Agregar
              </button>
            </div>
            <Mensaje texto={mensajeLista} />
          </div>

          <input
            type="text"
            value={busqueda}
            onChange={(e) => setBusqueda(e.target.value)}
            placeholder="Buscar por nombre o email..."
            className="mt-3 w-full rounded-lg border border-slate-300 px-3 py-1.5 text-sm focus:border-blue-500"
          />

          <div className="mt-3 space-y-1">
            {cargandoLista && <Cargando className="text-sm text-slate-400" />}
            {!cargandoLista && militantesFiltrados.length === 0 && (
              <p className="text-sm text-slate-400">Sin resultados.</p>
            )}
            {!cargandoLista &&
              militantesFiltrados.map((m) => (
                <button
                  key={m.id}
                  onClick={() => seleccionar(m)}
                  className="flex w-full items-center justify-between rounded-lg border border-slate-200 bg-white p-2 text-left text-sm active:bg-slate-50"
                >
                  <span>
                    <span className="font-medium text-slate-800">{m.nombre}</span>
                    <span className="text-slate-500"> · {m.email}</span>
                  </span>
                  {!m.activo && <span className="rounded-full bg-slate-100 px-2 py-0.5 text-xs text-slate-500">Inactivo</span>}
                </button>
              ))}
          </div>
        </div>
      )}

      {seleccionado && (
        <div className="mt-4">
          <button onClick={volver} className="text-sm font-medium text-blue-600">
            ← Volver a la lista
          </button>

          {cargandoDetalle && <Cargando className="mt-3 text-sm text-slate-400" />}

          <Mensaje texto={mensaje} />

          <div className="mt-3 rounded-xl border border-slate-200 bg-white p-3">
            <div className="flex items-center justify-between gap-2">
              <div>
                <p className="font-medium text-slate-800">{seleccionado.nombre}</p>
                <p className="text-sm text-slate-500">{seleccionado.email}</p>
              </div>
              {!seleccionado.activo && (
                <span className="shrink-0 rounded-full bg-slate-100 px-2 py-0.5 text-xs text-slate-500">Inactivo</span>
              )}
            </div>
            <Link to="/admin/militantes" className="mt-2 inline-block text-xs font-medium text-blue-600">
              Editar nombre, email o estado en Militantes →
            </Link>
          </div>

          <h3 className="mt-4 text-sm font-semibold text-slate-700">Cursada</h3>
          {cursada.map((c) => (
            <div key={c.id} className="mt-2 rounded-xl border border-slate-200 bg-white p-3">
              <div className="grid grid-cols-2 gap-2">
                <div className="col-span-2">
                  <label htmlFor={`grillas-cursada-${c.id}-materia`} className="block text-xs font-medium text-slate-500">Materia</label>
                  <input
                    id={`grillas-cursada-${c.id}-materia`}
                    type="text"
                    value={c.materia}
                    onChange={(e) => actualizarCursadaLocal(c.id, 'materia', e.target.value)}
                    className="mt-1 w-full rounded-lg border border-slate-300 px-2 py-1 text-sm"
                  />
                </div>
                <div>
                  <label htmlFor={`grillas-cursada-${c.id}-dia`} className="block text-xs font-medium text-slate-500">Día</label>
                  <select
                    id={`grillas-cursada-${c.id}-dia`}
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
                  <label htmlFor={`grillas-cursada-${c.id}-hora-inicio`} className="block text-xs font-medium text-slate-500">Hora inicio</label>
                  <input
                    id={`grillas-cursada-${c.id}-hora-inicio`}
                    type="time"
                    value={c.hora_inicio.slice(0, 5)}
                    onChange={(e) => actualizarCursadaLocal(c.id, 'hora_inicio', e.target.value)}
                    className="mt-1 w-full rounded-lg border border-slate-300 px-2 py-1 text-sm"
                  />
                </div>
                <div>
                  <label htmlFor={`grillas-cursada-${c.id}-hora-fin`} className="block text-xs font-medium text-slate-500">Hora fin</label>
                  <input
                    id={`grillas-cursada-${c.id}-hora-fin`}
                    type="time"
                    value={c.hora_fin.slice(0, 5)}
                    onChange={(e) => actualizarCursadaLocal(c.id, 'hora_fin', e.target.value)}
                    className="mt-1 w-full rounded-lg border border-slate-300 px-2 py-1 text-sm"
                  />
                </div>
              </div>
              <div className="mt-3 flex gap-2">
                <button
                  onClick={() => guardarCursada(c)}
                  disabled={cursadaOcupada === c.id}
                  className="rounded-lg bg-blue-600 px-3 py-1 text-sm font-medium text-white disabled:opacity-50"
                >
                  Guardar
                </button>
                <button
                  onClick={() => eliminarCursada(c)}
                  disabled={cursadaOcupada === c.id}
                  className="rounded-lg border border-red-300 px-3 py-1 text-sm font-medium text-red-600 disabled:opacity-50"
                >
                  Eliminar
                </button>
              </div>
            </div>
          ))}

          <div className="mt-2 rounded-xl border border-dashed border-slate-300 bg-white p-3">
            <p className="text-xs font-medium text-slate-500">Agregar cursada</p>
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
              disabled={agregandoCursada}
              className="mt-2 rounded-lg bg-blue-600 px-3 py-1 text-sm font-medium text-white disabled:opacity-50"
            >
              Agregar
            </button>
          </div>

          <h3 className="mt-4 text-sm font-semibold text-slate-700">Trabajo</h3>
          {trabajo.map((t) => (
            <div key={t.id} className="mt-2 rounded-xl border border-slate-200 bg-white p-3">
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label htmlFor={`grillas-trabajo-${t.id}-dia`} className="block text-xs font-medium text-slate-500">Día</label>
                  <select
                    id={`grillas-trabajo-${t.id}-dia`}
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
                  <label htmlFor={`grillas-trabajo-${t.id}-hora-inicio`} className="block text-xs font-medium text-slate-500">Hora inicio</label>
                  <input
                    id={`grillas-trabajo-${t.id}-hora-inicio`}
                    type="time"
                    value={t.hora_inicio.slice(0, 5)}
                    onChange={(e) => actualizarTrabajoLocal(t.id, 'hora_inicio', e.target.value)}
                    className="mt-1 w-full rounded-lg border border-slate-300 px-2 py-1 text-sm"
                  />
                </div>
                <div>
                  <label htmlFor={`grillas-trabajo-${t.id}-hora-fin`} className="block text-xs font-medium text-slate-500">Hora fin</label>
                  <input
                    id={`grillas-trabajo-${t.id}-hora-fin`}
                    type="time"
                    value={t.hora_fin.slice(0, 5)}
                    onChange={(e) => actualizarTrabajoLocal(t.id, 'hora_fin', e.target.value)}
                    className="mt-1 w-full rounded-lg border border-slate-300 px-2 py-1 text-sm"
                  />
                </div>
              </div>
              <div className="mt-3 flex gap-2">
                <button
                  onClick={() => guardarTrabajo(t)}
                  disabled={trabajoOcupado === t.id}
                  className="rounded-lg bg-blue-600 px-3 py-1 text-sm font-medium text-white disabled:opacity-50"
                >
                  Guardar
                </button>
                <button
                  onClick={() => eliminarTrabajo(t)}
                  disabled={trabajoOcupado === t.id}
                  className="rounded-lg border border-red-300 px-3 py-1 text-sm font-medium text-red-600 disabled:opacity-50"
                >
                  Eliminar
                </button>
              </div>
            </div>
          ))}

          <div className="mt-2 rounded-xl border border-dashed border-slate-300 bg-white p-3">
            <p className="text-xs font-medium text-slate-500">Agregar trabajo</p>
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
              disabled={agregandoTrabajo}
              className="mt-2 rounded-lg bg-blue-600 px-3 py-1 text-sm font-medium text-white disabled:opacity-50"
            >
              Agregar
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
