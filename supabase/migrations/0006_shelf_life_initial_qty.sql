-- Add initial_qty column to shelf_life to track initial batch quantity vs current remaining quantity
alter table shelf_life add column if not exists initial_qty integer;
update shelf_life set initial_qty = qty where initial_qty is null;
