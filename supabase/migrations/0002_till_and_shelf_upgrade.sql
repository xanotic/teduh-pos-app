-- Cash till reconciliation (opening balance carried forward day to day)
-- and shelf-life upgrade: consignment vs upfront-payment stock, with loss tracking.

-- ---------- daily_balances ----------

create table daily_balances (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references businesses(id) on delete cascade,
  date date not null,
  opening_balance numeric(10, 2) not null default 0,
  actual_closing numeric(10, 2),
  updated_at timestamptz not null default now(),
  unique (business_id, date)
);

alter table daily_balances enable row level security;

create policy "tenant isolation" on daily_balances
  for all
  using (business_id = auth_business_id())
  with check (business_id = auth_business_id());

create index on daily_balances (business_id, date);

-- ---------- shelf_life: consignment vs upfront payment ----------
-- Consignment stock: supplier is only paid for what actually sells, so unsold/expired
-- stock costs the cafe nothing extra. Upfront stock: already paid for regardless of
-- whether it sells, so an expired unit is a real cash loss = cost x qty.

alter table shelf_life add column payment_type text not null default 'consignment'
  check (payment_type in ('consignment', 'upfront'));
alter table shelf_life add column qty integer not null default 1;
alter table shelf_life add column cost numeric(10, 2);
