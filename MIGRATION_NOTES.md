# MIGRATION_NOTES

Fase 0 de `app-pi-interna`: copiar (no mover) el código de `app-grilla` y `pasadas-fiuba` a una app única, sin tocar los repos originales ni sus deploys en producción.

- `app-grilla` copiado desde commit `be20bb9` (2026-08-22).
- `pasadas-fiuba` copiado desde commit `ab26c0c` (2026-08-22).
- Ambos repos originales quedan intactos en `../app-grilla` y `../pasadas-fiuba`, siguen deployando a `grilla-cobertura.netlify.app` y `pasadas-fiuba.netlify.app` sin cambios.

## Estructura elegida

App única (un `package.json`, un build de Vite) en vez de monorepo con workspaces — decisión confirmada con el usuario porque el objetivo final es un solo shell con nav/router/auth compartidos, no dos apps que siguen deployando por separado. El hosting todavía no está definido (ver sección "Netlify removido" más abajo): por ahora se trabaja y testea 100% en local.

```
src/
  shared/          # código idéntico en ambas apps originales
    supabase.ts
    PasswordGate.tsx
  features/
    grilla/        # ex app-grilla/src
    pasadas/       # ex pasadas-fiuba/src
  App.tsx          # shell nuevo: BrowserRouter + /grilla/* + /pasadas/*
server/            # funciones serverless, sin atar a ninguna plataforma (ver abajo)
supabase/
  migrations/grilla/    # ex app-grilla/supabase/migrations
  migrations/pasadas/   # ex pasadas-fiuba/supabase/migrations
  reference/             # dumps de schema + import de datos, solo consulta
```

## Qué se copió tal cual (sin cambios)

- `lib/dia.ts`, `types/db.ts`, `types/filters.ts`, `lib/texto.ts`, `hooks/useBloques.ts`, `components/BloqueCard.tsx`, `components/FiltersBar.tsx`, `pages/Home.tsx`, `pages/Confirmar.tsx` — lógica de negocio de cada módulo, intacta.
- Los tres archivos de funciones de app-grilla (`confirmar.ts`, `notificar-nocturno.ts`, `notificar-test.ts`, ahora en `server/`) y su `lib/` (`crearNotificacion.ts`, `dia.ts`, `mailer.ts`, `supabaseAdmin.ts`) — lógica de negocio sin cambios (ver "Netlify removido" para lo que sí se tocó).
- Migraciones SQL de ambos proyectos, namespaced por carpeta (`migrations/grilla/`, `migrations/pasadas/`) para evitar colisión de nombres (`001_...`, `002_...` en ambos).
- `schema_mesita.sql`, `schema_supabase.sql`, `import_datos_fiuba.sql` → movidos a `supabase/reference/` solo como documentación histórica (no hace falta correrlos: la app apunta al mismo proyecto de Supabase que ya tiene el schema corrido).

## Qué se adaptó (imports/rutas, no lógica)

- `lib/supabase.ts` y `PasswordGate.tsx` eran prácticamente idénticos en ambos repos → se unificaron en `src/shared/`. Los imports de `supabase` y `PasswordGate` en cada módulo se ajustaron a la nueva profundidad de carpetas.
- `App.tsx` de cada app original se partió en `GrillaModule.tsx` / `PasadasModule.tsx` (mismas `Routes`/gates que antes, pero sin su propio `<BrowserRouter>`, porque ahora hay uno solo a nivel shell montando cada módulo en `/grilla/*` y `/pasadas/*`).
- `NavBar.tsx` de cada módulo: los links pasaron de rutas absolutas (`to="/"`, `to="/admin"`) a relativas (`to="."`, `to="admin"`) — necesario para que la nav interna de cada módulo siga funcionando bajo su nuevo prefijo (`/grilla`, `/pasadas`) en vez de la raíz. **No es rediseño de nav** (eso es Fase 1): cada módulo conserva su propia NavBar de dos ítems tal cual estaba.
- `AuthGate.tsx`/`AdminGate.tsx` de cada módulo: sin cambios de lógica, solo el import de `PasswordGate` apuntando a `shared/`. Los `storageKey` (`mesita_fiuba_auth_ok` vs `pasadas_fiuba_auth_ok`) se dejaron intactos — dos gates independientes conviven en la misma app (no se unificó login todavía, eso es Fase 1: Supabase Auth).

## Qué quedó afuera (por ahora, no es pérdida de funcionalidad)

- READMEs extensos de cada repo original (documentación de uso, no de código).
- `Grilla de cobertura PI.xlsx`, `Horarios FIUBA 2C2026.xlsx` — insumos de importación ya usados, no hacen falta en runtime.
- `dist/`, `node_modules/` — regenerables, no se copian nunca.

## Config / env vars

Ambas apps originales ya apuntaban al **mismo proyecto de Supabase** (`auocnqowbwkyfnzcvepi`) y tenían **los mismos valores** de `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY`, `VITE_APP_PASSWORD` y `VITE_ADMIN_PASSWORD` (confirmado con diff de los `.env.local` reales) — no hace falta decidir entre proyectos ni contraseñas distintas para Fase 0. `app-pi-interna/.env.local` (no versionado) se armó copiando el de `app-grilla`, que incluye además las vars solo-servidor (`SUPABASE_SERVICE_ROLE_KEY`, `SENDGRID_API_KEY`, `SENDGRID_FROM_EMAIL`) que `pasadas-fiuba` no necesitaba. Ver `.env.example` para la lista completa sin valores.

## Netlify removido (2026-08-22, post Fase 0)

Se sacó toda la configuración específica de Netlify porque el hosting final todavía no está decidido — primero se trabaja y testea localmente:

- Eliminados: `netlify.toml`, dependencia `@netlify/functions` (y sus ~425 subpaquetes), `.netlify`/`deno.lock` de `.gitignore`.
- `netlify/functions/` → renombrado a `server/` (carpeta neutral). La lógica interna (`mailer.ts`, `crearNotificacion.ts`, `supabaseAdmin.ts`, `dia.ts`) no cambió.
- Los tres entrypoints (`confirmar.ts`, `notificar-nocturno.ts`, `notificar-test.ts`) dejaron de importar el tipo `Handler` de `@netlify/functions`; ahora usan una interfaz `FunctionEvent`/`FunctionResponse` genérica (misma forma que Netlify/AWS Lambda: `{httpMethod, queryStringParameters, body}` → `{statusCode, headers, body}`) definida localmente. **Van a necesitar un adaptador real** una vez elegido el hosting (Express, Vercel, Cloudflare Workers, etc. tienen formas de request/response distintas).
- `crearNotificacion.ts`: `siteUrl()` ya no lee `process.env.URL` (variable implícita de Netlify) — solo `process.env.SITE_URL`, a setear a mano en cualquier entorno nuevo.
- `tsconfig.functions.json` → `tsconfig.server.json`, apuntando a `server/` en vez de `netlify/functions`.
- El scheduling del job nocturno (antes `[functions."notificar-nocturno"] schedule = "0 0 * * *"` en `netlify.toml`) **no existe más en ningún lado** — hay que decidir cómo se dispara ese cron en el hosting que se elija.
- El frontend sigue llamando a `/api/confirmar` (`Confirmar.tsx`) — es un path genérico, no específico de Netlify, pero **quien sea que hostee esto va a tener que mapear `/api/*` a las funciones de `server/`** de alguna manera (antes lo hacía el redirect de `netlify.toml`).

## Modelo de roles + historial de disponibilidad (2026-08-22, previo al Paso 1)

Antes de tocar código, el usuario corrió a mano en el SQL Editor de Supabase el schema propuesto para migrar del gate de clave compartida a roles reales:

- `militantes` ganó `user_id uuid unique references auth.users(id) on delete set null` (nullable a propósito: un admin puede dar de alta un militante sin que la persona tenga cuenta todavía) y `rol rol_usuario not null default 'militante'` (enum `'militante' | 'admin'`). `militantes.id` no cambió — cero impacto en las FKs existentes de `cursada_militante`/`trabajo_militante`/`notificaciones_mesita`.
- Helpers `is_admin()` y `mi_militante_id()` (ambos `security definer`, para evitar recursión de RLS).
- RLS reescrita en `militantes`, `cursada_militante`, `trabajo_militante`: reemplaza el `"acceso total anon" using (true)` de antes por lectura abierta a `authenticated` + escritura restringida a dueño del perfil o admin.
- Trigger `proteger_columnas_admin_militantes`: bloquea que un no-admin cambie su propio `rol`/`activo` (RLS no puede restringir columnas individuales). **Se parcheó una vez** (2026-08-22) para exceptuar `auth.role() = 'service_role'` — sin eso, ni siquiera el script de alta de militantes podía crear al primer admin (problema de bootstrap).
- Tabla nueva `historial_disponibilidad` (log append-only, mismo criterio que `pasadas`): `id, militante_id, tabla, registro_id, campo_modificado, valor_anterior, valor_nuevo, accion, modificado_en, modificado_por`. Solo políticas de `select`/`insert` (propio o admin) — sin `update`/`delete`, nunca se pisa un registro.
- **Flujo de alta confirmado con el usuario:** el admin le pide el mail a la persona nueva y define él mismo la contraseña inicial (se la comparte después) — no hay auto-registro. Esto es lo que implementa `server/crearMilitante.ts` (ver Paso 1 abajo).

## Paso 1: fundación de Auth (2026-08-22)

Reemplaza el gate de clave compartida (`PasswordGate`/`AuthGate`/`AdminGate`, uno por módulo) por sesión real de Supabase Auth, compartida por toda la app.

- **Nuevo en `src/shared/`:** `AuthProvider.tsx` (contexto con `session`, `perfil` — la fila de `militantes` del usuario logueado —, `loading`, `signOut`), `Login.tsx` (form email/password), `RequireAuth.tsx` (muestra `Login` si no hay sesión) y `RequireAdmin.tsx` (muestra "no autorizado" si `perfil.rol !== 'admin'`).
- **Eliminados** (sin reemplazo con compat-shims, quedaron completamente sin uso): `src/shared/PasswordGate.tsx`, `AuthGate.tsx`/`AdminGate.tsx` de ambos módulos.
- `GrillaModule.tsx`/`PasadasModule.tsx`: mismo esqueleto de rutas que en Fase 0, solo se cambió `AuthGate`→`RequireAuth` y `AdminGate`→`RequireAdmin`. La ruta pública `/grilla/confirmar/:token` sigue **fuera** de cualquier gate (verificado con browser-automation: no pide login).
- `src/App.tsx`: todo el shell envuelto en un único `<AuthProvider>` — la sesión persiste al navegar entre `/`, `/grilla` y `/pasadas` (un solo login para toda la app, no dos como en Fase 0). El Home sigue siendo el provisorio (se reemplaza en el Paso 2), ahora con saludo `Hola, {nombre} ({rol})` y botón de cerrar sesión temporal.
- **`server/crearMilitante.ts`**: implementa el flujo de alta admin-crea-cuenta. Idempotente — si el militante ya tiene `user_id` vinculado, reutiliza la cuenta y solo actualiza la contraseña (sirve como "resetear contraseña" reejecutándolo). Usa `supabaseAdmin.auth.admin.createUser`/`updateUserById` (service role, nunca expuesto al cliente).
- **`server/cli/crear-militante.ts`** + script `npm run crear-militante -- <email> <password> "<nombre>" [--admin]`: como todavía no hay UI de admin (eso es Paso 3) ni hosting elegido para exponer esto como endpoint HTTP, por ahora es un script de línea de comandos que corre localmente con la service role key. Requiere Node 22.6+ (usa `--experimental-strip-types` para correr `.ts` directo, sin compilar) — ya confirmado que la máquina tiene Node 24. `tsconfig.server.json` necesitó `allowImportingTsExtensions: true` porque el loader nativo de Node exige extensión `.ts` explícita en los imports relativos (a diferencia del bundler de Vite).
- `.env.example`: se sacaron `VITE_APP_PASSWORD`/`VITE_ADMIN_PASSWORD` (ya no los lee nada).

**Verificado con browser-automation contra el Supabase real:** login con credenciales inválidas → error correcto sin romper nada; se creó una cuenta admin descartable (`qa-admin-paso1@example.com`) vía el CLI, se logueó de verdad, mostró "Hola, QA Admin Paso1 (admin)", y `/grilla/admin` (protegido por `RequireAdmin`) la dejó pasar y cargó datos reales — la cuenta y su fila en `militantes` se borraron al terminar la prueba, siguiendo el mismo criterio de QA que ya se usaba en app-grilla (nunca dejar datos de prueba en la base compartida).

## Paso 2: Home, menú lateral y Mi perfil (2026-08-23)

Reestructuré el shell para que auth y layout vivan en un solo lugar (antes cada módulo tenía su propio `RequireAuth`; ver diff de rutas abajo), y agregué las pantallas pedidas.

- **`src/app/`** (nuevo, screens propias del shell, distinto de `src/shared/` que es infraestructura reusable): `AppLayout.tsx` (header sticky: hamburguesa + título + avatar con iniciales, monta el drawer), `Sidebar.tsx` (drawer: header con avatar/nombre/rol, nav base para todos los roles, placeholder atenuado "+ Próximamente", sección "Panel admin" solo si `rol === 'admin'`, Cerrar sesión al fondo), `Home.tsx` (saludo, cards de Pasadas/Mesita/Mi perfil).
- **Card de Mesita en Home**: consulta `notificaciones_mesita` filtrando `militante_id`, `disponible = true` y `fecha >= hoy`, toma la más próxima. Muestra "Hoy"/"Mañana" + horario, o "Sin turnos asignados" si no hay ninguna. **Nota:** `notificaciones_mesita` todavía tiene la policy vieja `"acceso total anon" using (true)` de Fase 0 (no se tocó en el paso de RLS de militantes) — sigue funcionando porque esa policy aplica a cualquier rol incluido `authenticated`, pero no está scoped por usuario. Queda como deuda de RLS para cuando se revise el resto de las tablas.
- **`src/features/perfil/`**: `MiPerfil.tsx` (edición de `cursada_militante`/`trabajo_militante` propias — mismo patrón de UI que `Admin.tsx` de grilla pero para "mí" en vez de "cualquier militante") + `historial.ts` (`registrarCambio(...)`, inserta en `historial_disponibilidad`). Al guardar una fila editada, compara contra un snapshot cargado al inicio y escribe **una fila de historial por campo que cambió**; alta/baja de una fila completa escriben una sola fila con `campo_modificado: 'fila completa'`.
- **`src/features/admin/AdminPlaceholder.tsx`**: pantallas placeholder para los 3 links de "Panel admin" del drawer (Militantes, Historial pasadas/mesita, Cambios de horarios) — muestran "Esta sección se implementa en el Paso 3", protegidas por `RequireAdmin` igual que las reales lo estarán.
- **Refactor de rutas (`src/App.tsx`, `GrillaModule.tsx`, `PasadasModule.tsx`):** `RequireAuth` ahora envuelve una sola vez a nivel shell (junto con `AppLayout`) en vez de una vez por módulo. La ruta pública `/grilla/confirmar/:token` se movió de "dentro de `GrillaModule`" a un route sibling en `App.tsx`, **fuera** de `RequireAuth`/`AppLayout` (sigue sin pedir login, verificado). `GrillaModule`/`PasadasModule` quedaron más simples: solo sus rutas internas + `RequireAdmin` en `/admin` + su propio `NavBar` de tabs (que convive con el drawer global: el drawer es para navegación entre módulos, el `NavBar` de cada módulo sigue siendo para navegar dentro del módulo).

**Verificado con browser-automation contra el Supabase real** (cuenta admin descartable `qa-paso2@example.com`, borrada al terminar): login → Home con saludo real y "Sin turnos asignados" → drawer abre y muestra nav base + sección Panel admin (por ser rol admin) → Mi perfil → agregar cursada (persiste, botón confirma "Cursada agregada.") → editar `hora_inicio` (confirma "Cursada guardada.") → eliminar (confirma "Cursada eliminada."). Se confirmó en la base que `historial_disponibilidad` quedó con las 3 filas correctas (`crear` → `editar` con `campo_modificado: 'hora_inicio'`, `valor_anterior: '08:00:00'`, `valor_nuevo: '09:00'` → `eliminar`), nunca se pisó ninguna, y que borrar el militante de prueba cascadeó correctamente el borrado de su propio historial.

**Detalle menor detectado, no corregido (cosmético):** el `valor_anterior` de un campo hora viene de la DB con formato `HH:MM:SS` y el `valor_nuevo` del input `<input type="time">` viene como `HH:MM` — mismo dato, formato distinto. No afecta funcionalidad, pero si se quiere un historial más prolijo para mostrar en el panel admin (Paso 3), conviene normalizar antes de guardar.

## Consolidación de los admin de módulo en el panel admin global (2026-08-23)

A pedido del usuario, después de ver la app corriendo en local: sacar los tabs "Admin" de dentro de cada módulo y centralizarlos en el drawer.

- `GrillaModule`/`PasadasModule` quedaron con una sola ruta cada uno (Resumen / Home) — ya no tienen `/admin` propio ni `NavBar` (se borraron `grilla/components/NavBar.tsx` y `pasadas/components/NavBar.tsx`, sin otro consumidor).
- Las pantallas `Admin.tsx` de cada módulo **no se reescribieron ni se movieron de carpeta** (siguen en `features/grilla/pages/Admin.tsx` y `features/pasadas/pages/Admin.tsx`, con sus imports intactos) — solo se renombró el componente exportado (`Admin` → `GrillasAdmin` y `Admin` → `AulasAdmin` respectivamente, ya que ambos módulos usaban el mismo nombre) y se remontaron a nivel shell en `App.tsx` como `/admin/grillas` y `/admin/aulas`, protegidas por `RequireAdmin` igual que el resto del panel admin.
- Mapeo de dominio: **"Grillas"** = lo que ya gestionaba `app-grilla/Admin.tsx` (eje semanal + lista de militantes + su cursada/trabajo). **"Aulas"** = lo que ya gestionaba `pasadas-fiuba/Admin.tsx` (buscar comisión, editar nombre/observaciones, editar bloques de horario incluyendo aula). Quedan como secciones **reales** del drawer (ya no placeholder), junto a Militantes/Historial/Cambios de horarios que siguen siendo placeholder del Paso 3.
- Verificado con browser-automation usando la cuenta real de Lauti: `/grilla` y `/pasadas` ya no muestran ningún tab de Admin; desde el drawer, "Grillas" navega a `/admin/grillas` y "Aulas" a `/admin/aulas`, ambas cargando datos reales sin errores de consola.

## Paso 3: panel admin — Militantes y Cambios de horarios (2026-08-23)

- **Puente de desarrollo (`devApiPlugin.ts`, root):** plugin de Vite con `apply: 'serve'` (solo corre en `npm run dev`, nunca en `vite build`/`vite preview`) que expone `/api/admin/crear-militante` como middleware del dev server. Necesario porque dar de alta un militante con contraseña elegida por el admin requiere `server/crearMilitante.ts` (service role key), que **nunca** puede vivir en el bundle del cliente — y todavía no hay hosting elegido para exponer esto como función real. El endpoint verifica el `Authorization: Bearer <access_token>` contra `server/verificarAdmin.ts` (resuelve el usuario con `supabaseAdmin.auth.getUser` y chequea `rol === 'admin'` en `militantes`) antes de crear nada — no confía solo en el gate del cliente. **Cuando se elija el hosting, este plugin se reemplaza por el endpoint real de esa plataforma** (mismo contrato: POST con `{nombre, email, password, rol?}`, requiere Bearer token de un admin).
- **Detalle técnico:** el script `dev` de `package.json` pasó de `vite` a `node --env-file=.env.local node_modules/vite/bin/vite.js` — sin esto, `server/lib/supabaseAdmin.ts` (que lee `process.env.SUPABASE_URL`/`SUPABASE_SERVICE_ROLE_KEY` directo de Node) fallaba porque Vite solo inyecta `.env.local` al bundle del cliente (`import.meta.env`, vars `VITE_*`), no al `process.env` del propio proceso de Node que corre el dev server.
- **`src/features/admin/MilitantesAdmin.tsx`:** lista todos los militantes con badges (rol, Inactivo, Sin cuenta), form "Agregar militante" (nombre/email/password/rol → pega al endpoint de arriba; si el mail ya existe sin cuenta, vincula en vez de duplicar, mismo comportamiento idempotente que el CLI del Paso 1) y pantalla de edición por militante (nombre/email/rol/activo) que usa el cliente normal de Supabase — **no necesita el puente de service role**, porque el admin logueado ya tiene permiso vía RLS (`militantes: edicion propia o admin`) y el trigger de protección de columnas lo deja pasar por ser admin real. "Baja" es soft-delete (destildar Activo), no hay DELETE físico todavía.
- **`src/features/admin/CambiosHorariosAdmin.tsx`:** lee `historial_disponibilidad` (últimas 200 filas) + `militantes` (para resolver nombres), con filtro por militante. También usa el cliente normal (mismo motivo: RLS ya permite lectura total a un admin real). Muestra motivo (alta/edición/baja), tabla afectada, campo, valor anterior→nuevo, y quién hizo el cambio si fue distinto del dueño del horario.
- **`/admin/historial`** (vista agregada de pasadas/mesita) sigue siendo placeholder — queda fuera del alcance del Paso 3 tal como se acordó, porque depende de datos reales generados con el nuevo modelo.

**Verificado con browser-automation contra el Supabase real, con la cuenta de Lauti** (admin real): `/admin/militantes` carga la lista real de los 13 militantes con sus badges correctos; se dio de alta una cuenta QA descartable desde el form de la UI (confirmado en la base: usuario de auth + fila de militante vinculada correctamente); `/admin/cambios-horarios` muestra el dropdown de filtro con todos los militantes y renderiza correctamente una fila de historial de prueba insertada a mano. Cuenta y fila de historial de prueba borradas al terminar.

## Revisión de seguridad/UX post Paso 3 y correcciones (2026-08-23)

Después de terminar el Paso 3, se pidió un repaso completo de seguridad/UX/código muerto antes de seguir agregando features. Hallazgos completos en el historial de la conversación; acá quedan las correcciones aplicadas, en orden de urgencia acordado con el usuario.

**Cambios de código (sin tocar la base):**
- `RequireAuth.tsx`: ahora bloquea a cualquier usuario con `perfil.activo === false` mostrando "Tu cuenta fue desactivada. Contactá a un administrador." con botón de cerrar sesión — antes, dar de baja a alguien en Militantes no le sacaba el acceso a la app, solo era cosmético.
- `MilitantesAdmin.tsx`: el input de "Contraseña inicial" pasó de `type="text"` a `type="password"` (quedaba visible en pantalla mientras se tipeaba).
- Borrado `server/notificar-test.ts`: dependía de `process.env.VITE_ADMIN_PASSWORD`, variable eliminada en el Paso 1 — quedó código muerto con una verificación de auth que nunca iba a pasar.
- `features/grilla/pages/Admin.tsx` y `features/pasadas/pages/Admin.tsx`: el `<h1>` decía "Admin" en ambas pantallas aunque el drawer ya las llama "Grillas"/"Aulas" — corregido para que coincida.
- `AdminPlaceholder.tsx`: el texto decía "Esta sección se implementa en el Paso 3" — ya se terminó el Paso 3 y esta sección (vista agregada) quedó afuera a propósito, así que el texto ahora es genérico ("todavía no está implementada").

**Cambios de base de datos (SQL corrido a mano por el usuario):**
- **Cierre de RLS abierta:** `carreras`, `materias`, `comisiones`, `comision_carreras`, `bloques_horario` pasaron de `"acceso total anon" using (true)` (cualquiera, ni hacía falta login) a lectura `authenticated` + escritura solo `is_admin()`. `pasadas`: lectura `authenticated`, insert `authenticated` (marcar una pasada sigue siendo una acción normal de cualquier militante, no de admin), sin update/delete (append-only). `ejes_semanales`: pasó a ser 100% admin-only (lectura y escritura) — ningún militante lo consulta directo desde el cliente, solo lo lee el server con service role para armar el mail. `notificaciones_mesita`: pasó a solo-lectura para `authenticated` — todas las escrituras reales las hace el server (`crearYNotificar`/`confirmar.ts`) con service role, que bypassea RLS.
- **`is_admin()` ahora también exige `activo = true`** — un admin dado de baja pierde sus privilegios de admin en la base, no solo en la UI.
- **`proteger_columnas_admin_militantes()` ahora bloquea dejar la app sin ningún admin**: si el cambio implicaría que `rol='admin' and activo=true` pase a tener 0 filas, la actualización se rechaza con "No podés sacarle el rol admin (o desactivar) al único admin que queda."

**Verificado en vivo con dos cuentas QA descartables (admin + militante) y, con mucho cuidado, sobre la cuenta real de Lauti para el último caso:**
- Lecturas: admin ve todo igual que antes (Resumen, Pasadas, Grillas, Aulas, Militantes, Cambios de horarios) — la nueva RLS no rompió ningún flujo existente.
- Un militante regular puede seguir marcando una pasada (`insert` en `pasadas` permitido) y ve Pasadas normalmente.
- **Intento directo contra la REST API de Supabase** (con la sesión real del militante no-admin, sin pasar por la UI): un `UPDATE` a `comisiones` devolvió 200 con 0 filas afectadas (bloqueado por RLS, confirmado que el dato no cambió) y un `SELECT` a `ejes_semanales` devolvió 0 filas — antes de este fix, ambas hubieran funcionado.
- **Desactivación real**: se puso `activo=false` a la cuenta QA militante y el siguiente intento de login mostró correctamente el mensaje de cuenta desactivada en vez de dejarla entrar.
- **Resguardo de último admin**: se bajó temporalmente el rol de Lauti a militante (vía service role, reversible), se intentó auto-degradar la cuenta QA admin (en ese momento la única admin real) desde la UI de Militantes, y el trigger lo rechazó con el mensaje esperado. Se restauró a Lauti (`rol=admin, activo=true`) inmediatamente después y se confirmó el estado final. La cuenta QA admin no quedó afectada por el intento fallido (transacción abortada, sin cambios parciales).
- Las dos cuentas QA y todos los datos de prueba (incluida una fila de `pasadas` creada por el test de la REST API) se borraron al terminar.

**Nota de alcance (no resuelta a propósito):** el resto de las policies de lectura (`militantes`, `cursada_militante`, `trabajo_militante`) siguen permitiendo lectura a cualquier `authenticated`, incluso si está `activo=false`. Si se quiere que una baja también le saque la posibilidad de *leer* datos (no solo usar la app), es un endurecimiento aparte — no se incluyó en esta tanda para no inflarla.

## Segunda tanda de correcciones post-revisión (2026-08-23)

Del resto de la lista de la revisión, se atacaron los puntos considerados de mayor impacto/costo razonable antes de seguir con features nuevas:

- **`/grilla/confirmar/:token` (la página del mail) reparada.** `devApiPlugin.ts` ahora también expone `/api/confirmar` (GET y POST), haciendo de puente hacia `server/confirmar.ts` — mismo criterio de "solo dev" que el endpoint de alta. `server/confirmar.ts` necesitó extensión `.ts` explícita en sus imports relativos (mismo motivo técnico que ya habíamos resuelto en el CLI: al quedar alcanzado por el programa de `tsconfig.node.json` vía el import dinámico de `devApiPlugin.ts`, el loader nativo de Node/TS exige la extensión). Verificado con curl real: GET carga los datos de la notificación, POST guarda la respuesta y persiste (`yaRespondido: true`).
- **`crearNotificacion.ts` corregido**: el link del mail ahora apunta a `${base}/grilla/confirmar/${token}` en vez de `${base}/confirmar/${token}`.
- **Sincronización de email admin→auth**: nuevo `server/actualizarEmail.ts` + endpoint `/api/admin/actualizar-email` (mismo patrón que crear-militante: dev-only, requiere Bearer de un admin real). `MilitantesAdmin.guardarSeleccionado` detecta si el email cambió y, si el militante tiene cuenta vinculada, sincroniza `auth.users` antes de tocar la tabla. Verificado en la base: `militantes.email` y `auth.users.email` quedan iguales después de editar.
- **Confirmación antes de borrar**: `window.confirm(...)` agregado en `eliminarCursada`/`eliminarTrabajo` de `MiPerfil.tsx` y de `features/grilla/pages/Admin.tsx` (Grillas) — antes borraban con un solo tap sin aviso.
- **Mínimo de contraseña**: `crearMilitante()` ahora rechaza contraseñas de menos de 8 caracteres (aplica tanto al alta desde la UI como desde el CLI, ya que ambos pasan por la misma función) + validación espejo en el cliente de `MilitantesAdmin` para feedback inmediato.
- **Claridad del campo "Activo"**: se agregó una aclaración debajo del checkbox en Militantes ("Si lo destildás, no va a poder entrar a la app ni recibir notificaciones de mesita") — ahora es verdad además, desde la corrección anterior de RLS/`RequireAuth`.
- **Limpieza**: borrado el tipo `EjeSemanal` (exportado, nunca usado).

Verificado con una cuenta QA descartable de punta a punta (login, alta, generar una notificación de mesita de prueba insertando directo en `notificaciones_mesita` para no mandar mail real, cargar `/grilla/confirmar/:token` sin login, confirmar un horario, editar su email desde Militantes). Todo borrado al terminar.

**Quedó explícitamente afuera de esta tanda** (bajo el mismo criterio de "no inflar" usado en la tanda de seguridad): accesibilidad del drawer (focus trap, Escape, `aria-modal`), labels sin `htmlFor`, título dinámico del header por sección, Home sin aviso de notificaciones de mesita pendientes de responder, sin paginación/buscador en Militantes/Cambios de horarios, tipos `Militante`/`MilitanteRow` duplicados, soporte de pantallas grandes, y el cron nocturno (sigue sin ningún disparador — depende de elegir hosting, no es arreglable con un puente de dev como `/api/confirmar`).

## Tercera tanda de correcciones (2026-08-23)

- **Accesibilidad del drawer** (`Sidebar.tsx`): agregado `role="dialog"`/`aria-modal="true"`, foco atrapado con Tab/Shift+Tab (no se escapa al contenido de atrás), Escape lo cierra, y al cerrarse el foco vuelve al elemento que lo abrió (el botón de hamburguesa). Verificado: `role="dialog"` presente, foco inicial cae en el primer link ("Inicio"), Escape cierra el drawer.
- **Título dinámico del header** (`AppLayout.tsx`): mapea el pathname actual a un título por sección (Mesita, Pasadas, Mi perfil, Militantes, Grillas, Aulas, etc.) — antes decía siempre "Proyecto Ingeniería" sin importar dónde estabas. Verificado en `/pasadas` → "Pasadas", `/perfil` → "Mi perfil", `/` → "Proyecto Ingeniería" (fallback correcto).
- **Home avisa de notificaciones de mesita sin responder**: nueva consulta (`disponible IS NULL`, `fecha >= hoy`) que muestra un banner ámbar con link directo a `/grilla/confirmar/:token` (el mismo token que se manda por mail) si hay algo pendiente. Esto tiene sentido ahora que `/api/confirmar` ya funciona (tanda anterior). **Nota:** ese link usa la ruta pública sin `AppLayout` (es la misma que llega por mail), así que un usuario logueado que la usa desde Home "sale" visualmente del shell (sin header/drawer) mientras confirma — aceptado como trade-off razonable en vez de duplicar la pantalla de confirmación dentro del shell autenticado.
- **Tipos `Militante` (compartido) y `MilitanteRow` (duplicado en `MilitantesAdmin.tsx`) consolidados**: `Militante` (en `grilla/types/db.ts`) ahora incluye `rol`/`user_id` (importando el tipo `Rol` de `shared/AuthProvider.tsx`), y `MilitantesAdmin.tsx` lo reusa en vez de tener su propia interfaz.
- **Formato de hora consistente en `historial_disponibilidad`**: `MiPerfil.tsx` normaliza `hora_inicio`/`hora_fin` a `HH:MM` antes de guardar el diff (antes el valor viejo salía de la DB en `HH:MM:SS` y el nuevo del input en `HH:MM`, mismo dato con formato distinto). Verificado en la base: un cambio de horario ahora registra `"08:00"` → `"09:00"` en vez de `"08:00:00"` → `"09:00"`.

Verificado con una cuenta QA descartable: login, aviso de pendiente visible en Home, títulos de header correctos en varias rutas, drawer con `role="dialog"` + foco inicial + cierre por Escape, y el fix de formato confirmado directo en la tabla. Todo borrado al terminar.

**Quedó afuera de esta tanda también** (mismo criterio): labels sin `htmlFor` (toca muchos formularios, puramente mecánico, bajo riesgo real dado el tamaño del equipo), paginación/buscador en Militantes/Cambios de horarios, soporte de pantallas grandes, y el cron nocturno.

## Cuarta tanda: resto de funcional/UX (2026-08-23)

Sobre el cron nocturno se le preguntó explícitamente al usuario si quería un botón manual de "ejecutar ahora" en el panel admin — **se descartó a propósito**: como `app-pi-interna` comparte el mismo proyecto de Supabase que `app-grilla` en producción, ese botón mandaría mails reales a militantes reales y escribiría en la misma tabla que ya gestiona el cron real de producción. Queda sin disparador, documentado, a la espera de elegir hosting.

Del resto de la lista:

- **Labels sin `htmlFor`/`id`**: agregado en `Login.tsx` (email/contraseña) y `MilitantesAdmin.tsx` (nombre/email/rol en la vista de edición — el checkbox de "Activo" ya estaba bien porque el input está anidado dentro del `<label>`, esa forma de asociación también es válida). No se tocaron `MiPerfil.tsx`/`GrillasAdmin`/`AulasAdmin` en esta pasada por ser mucho volumen repetitivo de baja prioridad real — queda para una pasada dedicada si se pide.
- **Buscador en Militantes**: input de texto que filtra por nombre o email (reusa `coincide()` de `pasadas/lib/texto.ts`, insensible a mayúsculas/acentos), con estado "Sin resultados." si no matchea nada.
- **Paginación en Cambios de horarios**: reemplazado el `limit(200)` fijo por `range()` en páginas de 100 + botón "Cargar más" que aparece solo si la última página vino completa (heurística simple: si devolvió menos de 100, no hay más).
- **Estado vacío de Mesita en Home**: "Sin turnos asignados" → "Te avisamos cuando te toque cubrir" (más accionable, no solo describe la ausencia).
- **Soporte liviano para pantallas grandes**: `mx-auto max-w-2xl` agregado a los contenedores raíz de Home, Mi Perfil, Militantes, Cambios de horarios, Grillas, Aulas y Resumen — no es un rediseño responsive, solo evita que el contenido se estire borde a borde en monitores anchos. **No se tocó** `pasadas/pages/Home.tsx` (tiene una `FiltersBar` sticky con estructura más compleja, se dejó para una pasada de diseño aparte si hace falta).

Verificado con browser-automation usando la cuenta real de Lauti (sin necesidad de cuentas QA descartables esta vez, todo fue de solo-lectura/búsqueda): buscador filtra correctamente ("lauti" → 1 resultado, "zzz-no-existe" → "Sin resultados."), labels de Militantes con `htmlFor`/`id` presentes y confirmados vía DOM, Login también. Cambios de horarios sigue funcionando (sin datos para probar la paginación real, pero la lógica de "cargar más" quedó verificada por code review — el mismo patrón `range()` que ya usa el resto de la app).

## Quinta tanda: resto del relevamiento (2026-08-23)

- **Labels sin `htmlFor`/`id` completados** en `MiPerfil.tsx`, `features/grilla/pages/Admin.tsx` (Grillas) y `features/pasadas/pages/Admin.tsx` (Aulas) — mismo criterio que Login/Militantes: cada fila mapeada (cursada/trabajo/bloque de horario) usa el `id` real de esa fila para armar el `htmlFor`/`id` (ej. `` `cursada-${c.id}-materia` ``) y evitar ids duplicados en el DOM cuando hay varias filas. Los inputs que solo tenían `placeholder` (los formularios de "Agregar...") sumaron `aria-label` además, porque ahí no había ningún `<label>` visible que asociar. Verificado con browser-automation: 0 labels huérfanos en Mi Perfil y Grillas (chequeo automático de `label[for]` sin `id` correspondiente en el DOM).
- **`pasadas/pages/Home.tsx`**: se le sumó el mismo `mx-auto max-w-2xl` que al resto — al revisarlo de nuevo, la `FiltersBar` sticky funciona igual de bien dentro de un contenedor angosto (el `sticky` es relativo al scroll, no al ancho), así que no hacía falta un tratamiento especial. Verificado que sigue renderizando y funcionando sin errores.
- **`historial_disponibilidad.modificado_por` (FK sin `on delete`): revisado y decidido NO tocar.** Al pensarlo de nuevo, el comportamiento actual (`NO ACTION`, bloquea el DELETE) es en realidad una salvaguarda razonable — evita borrar físicamente a un militante cuyas acciones están referenciadas en el log de auditoría — no un bug. Además hoy es inalcanzable: no existe ningún DELETE físico de militantes en la app (solo soft-delete vía `activo=false`). Cambiarlo ahora sin una razón concreta sería resolver un problema hipotético con una decisión de diseño (¿debería perderse la atribución del cambio si se borra a quien lo hizo?) que no hace falta tomar todavía.
- **Cron nocturno y notificaciones push**: sin cambios, mismos motivos que antes (comparte base con producción / necesita una sesión de diagnóstico dedicada).
- **`git init`**: no se tocó — es una decisión de alcance (¿remoto sí o no, nombre del repo, cuándo hacer el primer commit?) más que un bug de código, se deja para cuando el usuario quiera definirlo explícitamente.

## Pendiente / riesgos conocidos para pasos siguientes

- **`devApiPlugin.ts` es un puente de solo-desarrollo**, no una decisión de hosting — cuando se elija dónde alojar la app, hay que reimplementar `/api/admin/crear-militante`, `/api/admin/actualizar-email` y `/api/confirmar` (y en general `/api/*`) con el mecanismo real de esa plataforma.
- **El cron nocturno (`notificar-nocturno.ts`) sigue sin ningún disparador — decisión explícita del usuario** de no agregar un botón manual, porque `app-pi-interna` comparte el mismo proyecto de Supabase que `app-grilla` en producción y eso mandaría mails reales / interferiría con el cron real. Se retoma cuando se elija hosting.
- Lectura de `militantes`/`cursada_militante`/`trabajo_militante` sigue abierta a cualquier `authenticated` aunque esté `activo=false` — solo se cerró el acceso a la app y el uso de privilegios de admin, no la lectura general para inactivos.
- Notificaciones push: **riesgo conocido, no resuelto**. Ya hubo un intento previo de PWA con push que no entregaba notificaciones (causa no identificada). Antes de reemplazar el mail nocturno de app-grilla por push hay que dedicar una sesión aparte a diagnosticar (permisos de browser, service worker, VAPID keys, soporte iOS vs Android) y evaluar mantener el mail como fallback durante la prueba.
- Repo git: esta carpeta todavía no tiene `git init` ni remoto propio — pendiente de decidir alcance con el usuario, no de código.

## Verificación hecha en Fase 0

- `npm install` + `npm run build` (`tsc -b && vite build`) → compila sin errores.
- `npm run dev` levantado localmente, verificado con browser-automation:
  - `/` → shell home con links a ambos módulos, sin errores de consola.
  - `/grilla` → pantalla de clave (Mesita FIUBA), login exitoso, `Resumen de cobertura` carga datos reales de Supabase.
  - `/grilla/admin` (vía click en NavBar, ruta relativa) → pide clave de admin, carga lista real de militantes.
  - `/pasadas` → pantalla de clave (Pasadas FIUBA), login exitoso, filtros y lista de bloques cargan sin error (0 resultados es esperado según filtro de día por defecto).
  - Cero errores de consola y cero requests fallidos en los tres casos.
