import { useEffect, useRef } from 'react';
import { NavLink } from 'react-router-dom';
import { useAuth } from '../shared/AuthProvider';
import { iniciales } from '../shared/iniciales';

const NAV_BASE = [
  { to: '/', label: 'Inicio' },
  { to: '/pasadas', label: 'Pasadas' },
  { to: '/grilla', label: 'Mesita' },
  { to: '/materiales', label: 'Materiales' },
  { to: '/perfil', label: 'Mi perfil' },
];

const NAV_ADMIN = [
  { to: '/admin/militantes', label: 'Militantes' },
  { to: '/admin/aulas', label: 'Aulas' },
  { to: '/admin/historial', label: 'Historial pasadas/mesita' },
];

const linkClase = ({ isActive }: { isActive: boolean }) =>
  `block rounded-lg px-3 py-2 text-sm font-medium ${
    isActive ? 'bg-blue-50 text-blue-600' : 'text-slate-700 hover:bg-slate-50'
  }`;

export function Sidebar({ onClose }: { onClose: () => void }) {
  const { perfil, signOut } = useAuth();
  const panelRef = useRef<HTMLDivElement>(null);

  // Foco atrapado dentro del drawer mientras está abierto (Tab/Shift+Tab no
  // se escapan a la página de atrás), Escape lo cierra, y al cerrarse el
  // foco vuelve a lo que lo abrió (el botón de hamburguesa).
  useEffect(() => {
    const focoPrevio = document.activeElement as HTMLElement | null;
    const panel = panelRef.current;

    function elementosFocuseables(): HTMLElement[] {
      return Array.from(panel?.querySelectorAll<HTMLElement>('a[href], button:not([disabled])') ?? []);
    }

    elementosFocuseables()[0]?.focus();

    function onKeyDown(e: KeyboardEvent) {
      if (e.key === 'Escape') {
        onClose();
        return;
      }
      if (e.key !== 'Tab') return;
      const items = elementosFocuseables();
      if (items.length === 0) return;
      const primero = items[0];
      const ultimo = items[items.length - 1];
      if (e.shiftKey && document.activeElement === primero) {
        e.preventDefault();
        ultimo.focus();
      } else if (!e.shiftKey && document.activeElement === ultimo) {
        e.preventDefault();
        primero.focus();
      }
    }

    document.addEventListener('keydown', onKeyDown);
    return () => {
      document.removeEventListener('keydown', onKeyDown);
      focoPrevio?.focus();
    };
  }, [onClose]);

  return (
    <div className="fixed inset-0 z-40 flex">
      <div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-label="Menú"
        className="flex w-72 max-w-[80vw] flex-col bg-white shadow-xl"
      >
        <div className="flex items-center gap-3 border-b border-slate-200 p-4">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-blue-600 text-sm font-semibold text-white">
            {perfil ? iniciales(perfil.nombre) : '?'}
          </div>
          <div className="min-w-0">
            <p className="truncate font-medium text-slate-800">{perfil?.nombre ?? 'Sin vincular'}</p>
            <p className="text-xs capitalize text-slate-500">{perfil?.rol ?? '—'}</p>
          </div>
        </div>

        <nav className="flex-1 overflow-y-auto p-2">
          {NAV_BASE.map((item) => (
            <NavLink key={item.to} to={item.to} end onClick={onClose} className={linkClase}>
              {item.label}
            </NavLink>
          ))}

          {perfil?.rol === 'admin' && (
            <>
              <div className="my-3 border-t border-slate-200" />
              <p className="px-3 pb-1 text-xs font-semibold uppercase tracking-wide text-slate-400">Panel admin</p>
              {NAV_ADMIN.map((item) => (
                <NavLink key={item.to} to={item.to} onClick={onClose} className={linkClase}>
                  {item.label}
                </NavLink>
              ))}
            </>
          )}
        </nav>

        <div className="border-t border-slate-200 p-2">
          <button
            onClick={() => {
              onClose();
              signOut();
            }}
            className="block w-full rounded-lg px-3 py-2 text-left text-sm font-medium text-red-600 hover:bg-red-50"
          >
            Cerrar sesión
          </button>
        </div>
      </div>

      <button className="flex-1 bg-black/30" aria-label="Cerrar menú" onClick={onClose} />
    </div>
  );
}
