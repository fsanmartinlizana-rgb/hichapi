-- Delivery integrations per restaurant
--
-- Guarda el estado de conexión con plataformas de delivery (PedidosYa, Rappi,
-- Uber Eats, Justo, etc.). Encriptado en nivel de aplicación — por ahora
-- almacenamos solo metadatos y placeholders.

create table if not exists delivery_integrations (
  id              uuid primary key default gen_random_uuid(),
  restaurant_id   uuid not null references restaurants(id) on delete cascade,
  platform        text not null check (platform in (
    'pedidosya', 'rappi', 'uber_eats', 'justo', 'didi_food', 'cornershop'
  )),
  status          text not null default 'disconnected'
                  check (status in ('disconnected', 'pending', 'connected', 'error')),
  external_id     text null,      -- merchant id / store id en la plataforma
  api_key_hint    text null,      -- últimos 4 caracteres del API key, nunca completo
  auto_sync_menu  boolean not null default false,
  last_sync_at    timestamptz null,
  config          jsonb not null default '{}'::jsonb,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now(),

  unique (restaurant_id, platform)
);

create index if not exists idx_delivery_integrations_restaurant
  on delivery_integrations (restaurant_id);

comment on table delivery_integrations is
  'Integraciones con plataformas de delivery externas. Fila por restaurante + plataforma.';

-- RLS: solo owner/admin del restaurante puede leer/escribir.
alter table delivery_integrations enable row level security;

drop policy if exists "delivery_integrations_read" on delivery_integrations;
create policy "delivery_integrations_read"
  on delivery_integrations
  for select
  using (
    exists (
      select 1 from team_members tm
      where tm.restaurant_id = delivery_integrations.restaurant_id
        and tm.user_id = auth.uid()
        and tm.status = 'active'
        and tm.role in ('owner', 'admin', 'super_admin')
    )
  );

drop policy if exists "delivery_integrations_write" on delivery_integrations;
create policy "delivery_integrations_write"
  on delivery_integrations
  for all
  using (
    exists (
      select 1 from team_members tm
      where tm.restaurant_id = delivery_integrations.restaurant_id
        and tm.user_id = auth.uid()
        and tm.status = 'active'
        and tm.role in ('owner', 'admin', 'super_admin')
    )
  );
