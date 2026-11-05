alter table transaction_items add column if not exists is_expiry_sale boolean not null default false;
