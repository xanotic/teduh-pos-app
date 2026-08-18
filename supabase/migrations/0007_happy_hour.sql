-- Happy Hour settings per business
-- Allows setting a flat price (e.g. RM 5.00 for everything) during a scheduled time window,
-- or activating manually on-demand for flash sales.

create table if not exists happy_hour_settings (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references businesses(id) on delete cascade unique,
  is_enabled boolean not null default false,
  price numeric(10, 2) not null default 5.00,
  start_time text not null default '17:00',
  end_time text not null default '19:00',
  days text[] not null default array['mon', 'tue', 'wed', 'thu', 'fri', 'sat', 'sun'],
  force_active boolean not null default false,
  updated_at timestamptz not null default now()
);

alter table happy_hour_settings enable row level security;

create policy "tenant isolation" on happy_hour_settings
  for all
  using (business_id = auth_business_id())
  with check (business_id = auth_business_id());

create index if not exists idx_happy_hour_business on happy_hour_settings (business_id);
