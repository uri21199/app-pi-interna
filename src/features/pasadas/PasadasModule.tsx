import { Routes, Route } from 'react-router-dom';
import { Home } from './pages/Home';

// La administración de comisiones/aulas se movió al panel admin global
// (/admin/aulas, ver src/App.tsx) — este módulo ya no tiene su propio tab de Admin.
export function PasadasModule() {
  return (
    <Routes>
      <Route path="/" element={<Home />} />
    </Routes>
  );
}
