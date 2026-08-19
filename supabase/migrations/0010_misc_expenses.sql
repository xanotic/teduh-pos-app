-- Miscellaneous expenses: equipment/items bought for the business, separate
-- from food cost/shelf-life tracking (e.g. a new blender, packaging, gas).
create table if not exists misc_expenses (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references businesses(id) on delete cascade,
  description text not null,
  amount numeric(10, 2) not null,
  spent_at date not null,
  created_at timestamptz not null default now()
);

alter table misc_expenses enable row level security;

create policy "tenant isolation" on misc_expenses
  for all
  using (business_id = auth_business_id())
  with check (business_id = auth_business_id());

create index if not exists idx_misc_expenses_business on misc_expenses (business_id, spent_at desc);
