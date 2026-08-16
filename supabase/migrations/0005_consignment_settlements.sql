-- Consignment payout tracking: log the remaining ("baki") count for each
-- supplier item at a point in time, against how many were delivered, so the
-- app can work out how many sold and how much is owed to the supplier.

create table consignment_settlements (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references businesses(id) on delete cascade,
  settled_at timestamptz not null default now(),
  paid boolean not null default false,
  paid_at timestamptz,
  created_at timestamptz not null default now()
);

alter table consignment_settlements enable row level security;

create policy "tenant isolation" on consignment_settlements
  for all
  using (business_id = auth_business_id())
  with check (business_id = auth_business_id());

create table consignment_settlement_items (
  id uuid primary key default gen_random_uuid(),
  settlement_id uuid not null references consignment_settlements(id) on delete cascade,
  name text not null,
  delivered_qty integer not null default 0,
  remaining_qty integer not null default 0,
  cost numeric(10, 2)
);

alter table consignment_settlement_items enable row level security;

create policy "tenant isolation via settlement" on consignment_settlement_items
  for all
  using (
    exists (
      select 1 from consignment_settlements s
      where s.id = consignment_settlement_items.settlement_id
        and s.business_id = auth_business_id()
    )
  )
  with check (
    exists (
      select 1 from consignment_settlements s
      where s.id = consignment_settlement_items.settlement_id
        and s.business_id = auth_business_id()
    )
  );

create index on consignment_settlements (business_id, settled_at desc);
create index on consignment_settlement_items (settlement_id);
