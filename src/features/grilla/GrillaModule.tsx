import { Routes, Route } from 'react-router-dom';
import { Resumen } from './pages/Resumen';

// La ruta pública /grilla/confirmar/:token vive a nivel del shell (src/App.tsx),
// fuera de este módulo: no debe pasar por RequireAuth/AppLayout.
// La administración de horarios de mesita se movió al panel admin global
// (/admin/grillas, ver src/App.tsx) — este módulo ya no tiene su propio tab de Admin.
export function GrillaModule() {
  return (
    <Routes>
      <Route path="/" element={<Resumen />} />
    </Routes>
  );
}
