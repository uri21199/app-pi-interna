import { BrowserRouter, Routes, Route } from 'react-router-dom';
import { AuthProvider } from './shared/AuthProvider';
import { RequireAuth } from './shared/RequireAuth';
import { RequireAdmin } from './shared/RequireAdmin';
import { AppLayout } from './app/AppLayout';
import { Home } from './app/Home';
import { GrillaModule } from './features/grilla/GrillaModule';
import { PasadasModule } from './features/pasadas/PasadasModule';
import { Confirmar } from './features/grilla/pages/Confirmar';
import { GrillasAdmin } from './features/grilla/pages/Admin';
import { AulasAdmin } from './features/pasadas/pages/Admin';
import { MiPerfil } from './features/perfil/MiPerfil';
import { Materiales } from './features/materiales/pages/Materiales';
import { AdminPlaceholder } from './features/admin/AdminPlaceholder';
import { MilitantesAdmin } from './features/admin/MilitantesAdmin';
import { CambiosHorariosAdmin } from './features/admin/CambiosHorariosAdmin';

function App() {
  return (
    <AuthProvider>
      <BrowserRouter>
        <Routes>
          {/* Ruta pública: llega desde el mail, sin login ni layout. */}
          <Route path="/grilla/confirmar/:token" element={<Confirmar />} />

          {/* Todo lo demás requiere sesión y vive dentro del shell (header + drawer). */}
          <Route
            path="/*"
            element={
              <RequireAuth>
                <AppLayout>
                  <Routes>
                    <Route path="/" element={<Home />} />
                    <Route path="/grilla/*" element={<GrillaModule />} />
                    <Route path="/pasadas/*" element={<PasadasModule />} />
                    <Route path="/perfil" element={<MiPerfil />} />
                    <Route path="/materiales" element={<Materiales />} />
                    <Route
                      path="/admin/militantes"
                      element={
                        <RequireAdmin>
                          <MilitantesAdmin />
                        </RequireAdmin>
                      }
                    />
                    <Route
                      path="/admin/grillas"
                      element={
                        <RequireAdmin>
                          <GrillasAdmin />
                        </RequireAdmin>
                      }
                    />
                    <Route
                      path="/admin/aulas"
                      element={
                        <RequireAdmin>
                          <AulasAdmin />
                        </RequireAdmin>
                      }
                    />
                    <Route
                      path="/admin/historial"
                      element={
                        <RequireAdmin>
                          <AdminPlaceholder titulo="Historial pasadas/mesita" />
                        </RequireAdmin>
                      }
                    />
                    <Route
                      path="/admin/cambios-horarios"
                      element={
                        <RequireAdmin>
                          <CambiosHorariosAdmin />
                        </RequireAdmin>
                      }
                    />
                  </Routes>
                </AppLayout>
              </RequireAuth>
            }
          />
        </Routes>
      </BrowserRouter>
    </AuthProvider>
  );
}

export default App;
