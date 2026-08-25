-- Staff members and paying them, mirroring the vendors/upfront_payouts pattern:
-- a name + optional QR pay code, and a lump-sum payout log (salary, advance,
-- etc) with a paid/unpaid history — not itemized by anything, just who/how much.

create table staff (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references businesses(id) on delete cascade,
  name text not null,
  qr_url text,
  created_at timestamptz not null default now(),
  unique (business_id, name)
);

alter table staff enable row level security;

create policy "tenant isolation" on staff
  for all
  using (business_id = auth_business_id())
  with check (business_id = auth_business_id());

create table staff_payouts (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references businesses(id) on delete cascade,
  staff_id uuid references staff(id) on delete set null,
  amount numeric(12, 2) not null,
  note text,
  paid boolean not null default false,
  paid_at timestamptz,
  created_at timestamptz not null default now()
);

alter table staff_payouts enable row level security;

create policy "tenant isolation" on staff_payouts
  for all
  using (business_id = auth_business_id())
  with check (business_id = auth_business_id());

-- Storage bucket for staff QR pay images. Public read, same reasoning as
-- vendor-qr — a payment QR is meant to be scanned by anyone, it's not a secret.
insert into storage.buckets (id, name, public)
values ('staff-qr', 'staff-qr', true)
on conflict (id) do nothing;

create policy "staff qr public read" on storage.objects
  for select using (bucket_id = 'staff-qr');

create policy "staff qr authenticated insert" on storage.objects
  for insert to authenticated with check (bucket_id = 'staff-qr');

create policy "staff qr authenticated update" on storage.objects
  for update to authenticated using (bucket_id = 'staff-qr');

create policy "staff qr authenticated delete" on storage.objects
  for delete to authenticated using (bucket_id = 'staff-qr');
