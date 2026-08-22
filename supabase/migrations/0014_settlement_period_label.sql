-- Consignment settlements now record what was actually sold in a chosen
-- date/range (not a manual "baki" recount), so keep a human-readable label
-- of which period each settlement covers, for the Past Settlements list.
alter table consignment_settlements add column if not exists period_label text;
