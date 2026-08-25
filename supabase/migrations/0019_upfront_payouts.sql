-- Upfront vendors are paid a lump sum for a delivery, not itemized by what
-- sold (that's Consignment's job) — so this is a flat amount + vendor + note,
-- not a settlement-with-line-items like consignment_settlements.

create table upfront_payouts (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references businesses(id) on delete cascade,
  vendor_id uuid references vendors(id) on delete set null,
  amount numeric(12, 2) not null,
  note text,
  paid boolean not null default false,
  paid_at timestamptz,
  created_at timestamptz not null default now()
);

alter table upfront_payouts enable row level security;

create policy "tenant isolation" on upfront_payouts
  for all
  using (business_id = auth_business_id())
  with check (business_id = auth_business_id());
