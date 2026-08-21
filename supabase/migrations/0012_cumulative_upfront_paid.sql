alter table businesses add column if not exists cumulative_upfront_paid numeric(12, 2) not null default 0;

-- Running, never-reset ledger of cash actually paid upfront for stock —
-- shelf_life rows get deleted once a batch sells through, so break-even
-- can't be recomputed from current rows alone (see adjust_menu_stock for the
-- same atomic, business-scoped update pattern).
create or replace function adjust_upfront_paid(p_delta numeric)
returns void
language sql
security definer
as $$
  update businesses
  set cumulative_upfront_paid = greatest(cumulative_upfront_paid + p_delta, 0)
  where id = auth_business_id();
$$;
