-- staff_payouts.staff_id is "on delete set null" — so once a staff member is
-- deleted (no longer working there), every one of their past payouts loses
-- its name and shows as "No staff selected". Store the name directly on the
-- payout row instead, so history survives the staff member being removed.

alter table staff_payouts add column staff_name text;

-- Backfill from whichever staff links are still intact right now.
update staff_payouts p
set staff_name = s.name
from staff s
where p.staff_id = s.id
  and p.staff_name is null;
