-- ============================================================
-- PUSH_SUBSCRIPTIONS
-- Suscripciones de Web Push por dispositivo/navegador de cada
-- militante. Un militante puede tener más de una fila (varios
-- dispositivos, o reinstaló la PWA y generó una suscripción nueva).
--
-- Etapa actual: solo diagnóstico (ver src/features/notificaciones).
-- Todavía NO está conectado al cron de mesita — eso es un paso
-- aparte, a propósito, para no repetir a ciegas un intento anterior
-- de push que falló sin causa identificada.
-- ============================================================

create extension if not exists "pgcrypto";

create table push_subscriptions (
  id uuid primary key default gen_random_uuid(),
  militante_id uuid not null references militantes(id) on delete cascade,
  endpoint text not null unique,
  p256dh text not null,
  auth text not null,
  user_agent text,
  creado_en timestamptz not null default now()
);

create index idx_push_subscriptions_militante on push_subscriptions (militante_id);

alter table push_subscriptions enable row level security;
create policy "acceso total anon" on push_subscriptions for all using (true) with check (true);
