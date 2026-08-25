-- Daily receipt photos. Unlike vendor QR codes (public-by-design, meant to be
-- scanned by anyone), receipts are financial records for this business only —
-- private bucket, RLS-gated by business_id folder prefix, viewed via signed URLs.

create table receipts (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references businesses(id) on delete cascade,
  receipt_date date not null,
  note text,
  image_path text not null,
  created_at timestamptz not null default now()
);

alter table receipts enable row level security;

create policy "tenant isolation" on receipts
  for all
  using (business_id = auth_business_id())
  with check (business_id = auth_business_id());

insert into storage.buckets (id, name, public)
values ('receipts', 'receipts', false)
on conflict (id) do nothing;

-- Files are stored as `${business_id}/${filename}` — the first path segment
-- doubles as the tenant check, same idiom Supabase docs use for private
-- per-tenant storage.
create policy "receipts tenant read" on storage.objects
  for select to authenticated
  using (bucket_id = 'receipts' and (storage.foldername(name))[1] = auth_business_id()::text);

create policy "receipts tenant insert" on storage.objects
  for insert to authenticated
  with check (bucket_id = 'receipts' and (storage.foldername(name))[1] = auth_business_id()::text);

create policy "receipts tenant delete" on storage.objects
  for delete to authenticated
  using (bucket_id = 'receipts' and (storage.foldername(name))[1] = auth_business_id()::text);
