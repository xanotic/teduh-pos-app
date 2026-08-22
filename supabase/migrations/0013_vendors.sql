-- Vendors: each consignment/upfront supplier gets a name and an optional QR
-- pay code image, so payouts can be grouped by who to pay and scanned
-- straight from the Consignment page instead of hunting for the right code.

create table vendors (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references businesses(id) on delete cascade,
  name text not null,
  qr_url text,
  created_at timestamptz not null default now(),
  unique (business_id, name)
);

alter table vendors enable row level security;

create policy "tenant isolation" on vendors
  for all
  using (business_id = auth_business_id())
  with check (business_id = auth_business_id());

-- Link each shelf-life batch to the vendor that supplied it
alter table shelf_life add column if not exists vendor_id uuid references vendors(id) on delete set null;

-- Storage bucket for vendor QR pay images. Public read is fine — a payment QR
-- is meant to be scanned by anyone, it's not a secret.
insert into storage.buckets (id, name, public)
values ('vendor-qr', 'vendor-qr', true)
on conflict (id) do nothing;

create policy "vendor qr public read" on storage.objects
  for select using (bucket_id = 'vendor-qr');

create policy "vendor qr authenticated insert" on storage.objects
  for insert to authenticated with check (bucket_id = 'vendor-qr');

create policy "vendor qr authenticated update" on storage.objects
  for update to authenticated using (bucket_id = 'vendor-qr');

create policy "vendor qr authenticated delete" on storage.objects
  for delete to authenticated using (bucket_id = 'vendor-qr');
