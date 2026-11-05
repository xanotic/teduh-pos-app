-- Short, globally-unique numeric SKU per menu item, used for the printed
-- barcode label instead of the full uuid — a 1D barcode needs far fewer
-- characters than a uuid to print with bars wide enough to scan from a
-- distance on a tiny 12x40mm label. Plain `integer` (not bigint) so
-- PostgREST/supabase-js always returns it as a real JS number.
create sequence if not exists menu_items_sku_seq as integer;

alter table menu_items add column if not exists sku integer;
alter table menu_items alter column sku set default nextval('menu_items_sku_seq');
update menu_items set sku = nextval('menu_items_sku_seq')::integer where sku is null;
alter table menu_items alter column sku set not null;
do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'menu_items_sku_unique') then
    alter table menu_items add constraint menu_items_sku_unique unique (sku);
  end if;
end $$;
