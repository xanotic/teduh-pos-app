-- Hourly-pay support for Pay Staff: an optional default rate per staff member,
-- and the hours/rate actually used on a specific payout — kept alongside the
-- existing `amount` column (still the authoritative paid total) so history
-- stays accurate even if a staff member's rate changes later.

alter table staff add column hourly_rate numeric(10, 2);

alter table staff_payouts add column hours numeric(10, 2);
alter table staff_payouts add column hourly_rate numeric(10, 2);
