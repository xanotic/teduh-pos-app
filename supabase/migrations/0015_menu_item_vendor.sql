-- shelf_life.vendor_id only tags whichever batch rows currently exist, and
-- those rows get deleted once a batch fully sells through (see
-- deductShelfLifeFifo) — so "Assign vendor" on a sold-out consignment item
-- had nothing left to update. menu_items.vendor_id is the persistent home
-- for "which vendor supplies this item" instead.
alter table menu_items add column if not exists vendor_id uuid references vendors(id) on delete set null;
