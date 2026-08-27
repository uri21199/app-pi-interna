import { useState, type ReactNode } from 'react';
import { useLocation } from 'react-router-dom';
import { useAuth } from '../shared/AuthProvider';
import { iniciales } from '../shared/iniciales';
import { Sidebar } from './Sidebar';

const TITULOS: { prefix: string; titulo: string }[] = [
  { prefix: '/grilla', titulo: 'Mesita' },
  { prefix: '/pasadas', titulo: 'Pasadas' },
  { prefix: '/materiales', titulo: 'Materiales' },
  { prefix: '/perfil', titulo: 'Mi perfil' },
  { prefix: '/admin/militantes', titulo: 'Militantes' },
  { prefix: '/admin/aulas', titulo: 'Aulas' },
  { prefix: '/admin/historial', titulo: 'Historial pasadas/mesita' },
];

function tituloDe(pathname: string): string {
  if (pathname === '/') return 'Proyecto Ingeniería';
  return TITULOS.find((t) => pathname.startsWith(t.prefix))?.titulo ?? 'Proyecto Ingeniería';
}

export function AppLayout({ children }: { children: ReactNode }) {
  const [menuAbierto, setMenuAbierto] = useState(false);
  const { perfil } = useAuth();
  const location = useLocation();

  return (
    <div className="min-h-screen bg-slate-50">
      <header className="sticky top-0 z-30 flex items-center justify-between border-b border-slate-200 bg-white px-4 py-3">
        <button
          onClick={() => setMenuAbierto(true)}
          aria-label="Abrir menú"
          className="flex h-8 w-8 flex-col items-center justify-center gap-1"
        >
          <span className="block h-0.5 w-5 bg-slate-600" />
          <span className="block h-0.5 w-5 bg-slate-600" />
          <span className="block h-0.5 w-5 bg-slate-600" />
        </button>

        <h1 className="text-base font-semibold text-slate-800">{tituloDe(location.pathname)}</h1>

        <div className="flex h-8 w-8 items-center justify-center rounded-full bg-blue-600 text-xs font-semibold text-white">
          {perfil ? iniciales(perfil.nombre) : '?'}
        </div>
      </header>

      {menuAbierto && <Sidebar onClose={() => setMenuAbierto(false)} />}

      <main>{children}</main>
    </div>
  );
}
