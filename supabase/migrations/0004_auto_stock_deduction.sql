-- Atomic stock adjustment, matched by item name (transaction_items only stores
-- name/category/price/cost/qty, not a menu_items id — same lookup pattern the
-- shelf-life autofill and legacy import already use). Restricted to the
-- caller's own business via auth_business_id(), and a no-op for items where
-- stock isn't being tracked (stock is null).
create or replace function adjust_menu_stock(p_name text, p_delta integer)
returns void
language sql
security definer
as $$
  update menu_items
  set stock = greatest(stock + p_delta, 0)
  where business_id = auth_business_id() and name = p_name and stock is not null;
$$;
