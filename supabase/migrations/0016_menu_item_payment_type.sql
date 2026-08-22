-- Same bug class as vendor_id: consignment/upfront classification was
-- derived only from current shelf_life rows (+ settlement history for
-- consignment only), and shelf_life rows get deleted once a batch fully
-- sells through (see deductShelfLifeFifo) — so a sold-out item lost its
-- Consignment/Upfront badge entirely. menu_items.payment_type is the
-- persistent record instead.

alter table menu_items add column if not exists payment_type text
  check (payment_type in ('consignment', 'upfront'));

-- Backfill from whichever shelf_life batch was most recently added per item
update menu_items mi
set payment_type = sl.payment_type
from (
  select distinct on (business_id, lower(item)) business_id, item, payment_type
  from shelf_life
  order by business_id, lower(item), created_at desc
) sl
where mi.business_id = sl.business_id
  and lower(mi.name) = lower(sl.item)
  and mi.payment_type is null;

-- Anything with consignment settlement history but no shelf_life batch left
-- (already fully sold out) is necessarily consignment — only consignment
-- items ever get a settlement.
update menu_items mi
set payment_type = 'consignment'
where mi.payment_type is null
  and exists (
    select 1 from consignment_settlement_items csi
    join consignment_settlements cs on cs.id = csi.settlement_id
    where cs.business_id = mi.business_id
      and lower(csi.name) = lower(mi.name)
  );
