-- Teduh POS multi-tenant schema
-- Every business-owned table carries business_id and is locked down by RLS
-- so one business can never read or write another's rows.

create extension if not exists "pgcrypto";

-- ---------- businesses & profiles ----------

create table businesses (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  slug text unique not null,
  created_at timestamptz not null default now()
);

create table profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  business_id uuid not null references businesses(id) on delete cascade,
  role text not null default 'owner',
  created_at timestamptz not null default now()
);

-- helper: the caller's business_id, used by every RLS policy below
create or replace function auth_business_id()
returns uuid
language sql
security definer
stable
as $$
  select business_id from profiles where id = auth.uid()
$$;

alter table businesses enable row level security;
alter table profiles enable row level security;

create policy "read own business" on businesses
  for select using (id = auth_business_id());

create policy "read own profile" on profiles
  for select using (id = auth.uid());

-- ---------- menu_items ----------

create table menu_items (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references businesses(id) on delete cascade,
  name text not null,
  category text not null,
  price numeric(10, 2) not null default 0,
  cost numeric(10, 2),
  created_at timestamptz not null default now()
);

alter table menu_items enable row level security;

create policy "tenant isolation" on menu_items
  for all
  using (business_id = auth_business_id())
  with check (business_id = auth_business_id());

-- ---------- transactions ----------

create table transactions (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references businesses(id) on delete cascade,
  ts timestamptz not null default now(),
  payment_method text not null check (payment_method in ('Cash', 'QR Pay', 'Giveaway')),
  note text,
  total numeric(10, 2) not null default 0,
  created_at timestamptz not null default now()
);

alter table transactions enable row level security;

create policy "tenant isolation" on transactions
  for all
  using (business_id = auth_business_id())
  with check (business_id = auth_business_id());

-- ---------- transaction_items ----------

create table transaction_items (
  id uuid primary key default gen_random_uuid(),
  transaction_id uuid not null references transactions(id) on delete cascade,
  name text not null,
  category text not null,
  price numeric(10, 2) not null default 0,
  cost numeric(10, 2),
  qty integer not null default 1
);

alter table transaction_items enable row level security;

-- scoped through the parent transaction's business_id, since this table has no business_id of its own
create policy "tenant isolation via transaction" on transaction_items
  for all
  using (
    exists (
      select 1 from transactions t
      where t.id = transaction_items.transaction_id
        and t.business_id = auth_business_id()
    )
  )
  with check (
    exists (
      select 1 from transactions t
      where t.id = transaction_items.transaction_id
        and t.business_id = auth_business_id()
    )
  );

-- ---------- shelf_life ----------

create table shelf_life (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references businesses(id) on delete cascade,
  item text not null,
  expires_at date not null,
  notes text,
  created_at timestamptz not null default now()
);

alter table shelf_life enable row level security;

create policy "tenant isolation" on shelf_life
  for all
  using (business_id = auth_business_id())
  with check (business_id = auth_business_id());

-- ---------- indexes ----------

create index on menu_items (business_id);
create index on transactions (business_id, ts desc);
create index on transaction_items (transaction_id);
create index on shelf_life (business_id, expires_at);

-- ---------- signup bootstrap ----------
-- Called once right after a new user signs up (see app/(auth)/actions.ts):
-- creates their business + links their auth user to it via profiles.
create or replace function bootstrap_business(business_name text, business_slug text)
returns uuid
language plpgsql
security definer
as $$
declare
  new_business_id uuid;
begin
  if exists (select 1 from profiles where id = auth.uid()) then
    raise exception 'Profile already exists for this user';
  end if;

  insert into businesses (name, slug) values (business_name, business_slug)
    returning id into new_business_id;

  insert into profiles (id, business_id) values (auth.uid(), new_business_id);

  return new_business_id;
end;
$$;
