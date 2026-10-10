-- Tracks when a batch was actually delivered, separate from when it expires.
-- Defaults to today when adding a batch (set in the app, not here) but is
-- freely adjustable in case it's logged a day late or backdated.

alter table shelf_life add column delivery_date date;
