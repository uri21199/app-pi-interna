import { useState } from 'react';
import type { Filtros, FiltroDia, FiltroEstado } from '../types/filters';
import { DIAS_SEMANA, formatDia } from '../lib/dia';

const DIA_CHIPS: { label: string; value: FiltroDia }[] = [
  { label: 'Hoy', value: 'hoy' },
  ...DIAS_SEMANA.map((d) => ({ label: formatDia(d).slice(0, 3), value: d })),
  { label: 'Semana', value: 'semana' },
];

const ESTADO_CHIPS: { label: string; value: FiltroEstado }[] = [
  { label: 'Todos', value: 'todos' },
  { label: 'Pendiente', value: 'pendiente' },
  { label: 'Hecho', value: 'hecho' },
];

interface FiltersBarProps {
  filtros: Filtros;
  onChange: (filtros: Filtros) => void;
  carrerasDisponibles: string[];
}

export function FiltersBar({ filtros, onChange, carrerasDisponibles }: FiltersBarProps) {
  const [carrerasAbiertas, setCarrerasAbiertas] = useState(false);

  function toggleCarrera(nombre: string) {
    const yaEsta = filtros.carreras.includes(nombre);
    onChange({
      ...filtros,
      carreras: yaEsta
        ? filtros.carreras.filter((c) => c !== nombre)
        : [...filtros.carreras, nombre],
    });
  }

  return (
    <div className="sticky top-0 z-10 space-y-2 border-b border-slate-200 bg-white p-3">
      <div className="flex gap-2 overflow-x-auto pb-1">
        {DIA_CHIPS.map((chip) => (
          <button
            key={chip.value}
            onClick={() => onChange({ ...filtros, dia: chip.value })}
            className={`shrink-0 rounded-full px-3 py-1 text-sm font-medium ${
              filtros.dia === chip.value
                ? 'bg-blue-600 text-white'
                : 'bg-slate-100 text-slate-700'
            }`}
          >
            {chip.label}
          </button>
        ))}
      </div>

      <div className="flex gap-2 overflow-x-auto pb-1">
        {ESTADO_CHIPS.map((chip) => (
          <button
            key={chip.value}
            onClick={() => onChange({ ...filtros, estado: chip.value })}
            className={`shrink-0 rounded-full px-3 py-1 text-sm font-medium ${
              filtros.estado === chip.value
                ? 'bg-emerald-600 text-white'
                : 'bg-slate-100 text-slate-700'
            }`}
          >
            {chip.label}
          </button>
        ))}
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <button
          onClick={() => setCarrerasAbiertas((v) => !v)}
          className="rounded-full bg-slate-100 px-3 py-1 text-sm font-medium text-slate-700"
        >
          Carreras {filtros.carreras.length > 0 ? `(${filtros.carreras.length})` : ''}
        </button>

        <input
          type="text"
          value={filtros.texto}
          onChange={(e) => onChange({ ...filtros, texto: e.target.value })}
          placeholder="Buscar materia, docente o aula..."
          className="min-w-[10rem] flex-1 rounded-full border border-slate-300 px-3 py-1 text-sm focus:border-blue-500"
        />
      </div>

      {carrerasAbiertas && (
        <div className="grid grid-cols-2 gap-1 rounded-lg bg-slate-50 p-2">
          {carrerasDisponibles.map((nombre) => (
            <label key={nombre} className="flex items-center gap-2 text-sm text-slate-700">
              <input
                type="checkbox"
                checked={filtros.carreras.includes(nombre)}
                onChange={() => toggleCarrera(nombre)}
              />
              {nombre}
            </label>
          ))}
        </div>
      )}

      <div className="flex items-center gap-2 text-sm text-slate-600">
        <span>Horario</span>
        <input
          type="time"
          value={filtros.horaDesde}
          onChange={(e) => onChange({ ...filtros, horaDesde: e.target.value })}
          className="rounded-md border border-slate-300 px-2 py-1"
        />
        <span>-</span>
        <input
          type="time"
          value={filtros.horaHasta}
          onChange={(e) => onChange({ ...filtros, horaHasta: e.target.value })}
          className="rounded-md border border-slate-300 px-2 py-1"
        />
      </div>
    </div>
  );
}
