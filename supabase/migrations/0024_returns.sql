-- Returned tab: logging stock a vendor physically takes back early (before
-- it expires), separate from a sale and separate from wastage/expiry. Each
-- row is a record of what left the shelf and went back to the vendor, so it
-- doesn't quietly get sold against or sit there until it expires.

create table returns (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references businesses(id) on delete cascade,
  item text not null,
  vendor_id uuid references vendors(id) on delete set null,
  qty integer not null check (qty > 0),
  payment_type text check (payment_type in ('consignment', 'upfront')),
  cost numeric(10, 2),
  upfront_reversed numeric(10, 2),
  note text,
  created_at timestamptz not null default now()
);

alter table returns enable row level security;

create policy "tenant isolation" on returns
  for all
  using (business_id = auth_business_id())
  with check (business_id = auth_business_id());
