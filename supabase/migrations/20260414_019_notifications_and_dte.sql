-- ── notifications ────────────────────────────────────────────────────────────
create table if not exists public.notifications (
  id            uuid primary key default gen_random_uuid(),
  restaurant_id uuid not null references public.restaurants(id) on delete cascade,
  type          text not null,
  title         text not null,
  message       text,
  severity      text not null default 'info' check (severity in ('info','success','warning','critical')),
  category      text check (category in ('operacion','inventario','caja','dte','equipo','sistema')),
  is_read       boolean not null default false,
  resolved      boolean not null default false,
  action_url    text,
  action_label  text,
  dedupe_key    text,
  metadata      jsonb,
  expires_at    timestamptz,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);

create index if not exists notifications_restaurant_id_idx on public.notifications(restaurant_id);
create index if not exists notifications_is_read_idx on public.notifications(restaurant_id, is_read) where is_read = false;
create index if not exists notifications_expires_at_idx on public.notifications(expires_at) where expires_at is not null;

alter table public.notifications enable row level security;

create policy "team members can manage notifications"
  on public.notifications for all
  using (
    exists (
      select 1 from public.team_members tm
      where tm.restaurant_id = notifications.restaurant_id
        and tm.user_id = auth.uid()
        and tm.active = true
    )
  );

-- RPC para limpiar notificaciones expiradas
create or replace function public.purge_expired_notifications()
returns void language sql security definer as $$
  delete from public.notifications where expires_at < now();
$$;

-- ── dte_credentials ───────────────────────────────────────────────────────────
create table if not exists public.dte_credentials (
  id              uuid primary key default gen_random_uuid(),
  restaurant_id   uuid not null unique references public.restaurants(id) on delete cascade,
  cert_ciphertext text not null,
  cert_iv         text not null,
  cert_auth_tag   text not null,
  pass_ciphertext text not null,
  pass_iv         text not null,
  pass_auth_tag   text not null,
  cert_subject    text,
  cert_issuer     text,
  cert_valid_from timestamptz,
  cert_valid_to   timestamptz,
  uploaded_by     uuid references auth.users(id),
  uploaded_at     timestamptz not null default now(),
  rotated_at      timestamptz
);

alter table public.dte_credentials enable row level security;

create policy "only owner can manage dte credentials"
  on public.dte_credentials for all
  using (
    exists (
      select 1 from public.team_members tm
      where tm.restaurant_id = dte_credentials.restaurant_id
        and tm.user_id = auth.uid()
        and tm.role in ('owner', 'admin')
        and tm.active = true
    )
  );
