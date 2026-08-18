-- Happy Hour settings upgrade:
-- 1. Adds discount_type ('flat' for exact fixed price or 'percent' for percentage discount)
-- 2. Adds discount_percent (e.g. 20.00 for 20% off)
-- 3. Adds target_date (YYYY-MM-DD for one-time today schedule)

alter table happy_hour_settings 
  add column if not exists discount_type text not null default 'flat',
  add column if not exists discount_percent numeric(5, 2) not null default 20.00,
  add column if not exists target_date text;
