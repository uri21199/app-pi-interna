import { Routes, Route } from 'react-router-dom';
import { Resumen } from './pages/Resumen';

// La ruta pública /grilla/confirmar/:token vive a nivel del shell (src/App.tsx),
// fuera de este módulo: no debe pasar por RequireAuth/AppLayout.
// La edición de cursada/trabajo de un militante ahora la hace cada uno desde
// Mi Perfil — ya no existe un panel admin separado para eso.
export function GrillaModule() {
  return (
    <Routes>
      <Route path="/" element={<Resumen />} />
    </Routes>
  );
}
