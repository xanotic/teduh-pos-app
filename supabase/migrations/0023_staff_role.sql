-- Lets a staff member be tagged as a Manager vs regular Staff, so Pay Staff
-- can show/filter by role.

alter table staff add column role text not null default 'staff' check (role in ('staff', 'manager'));
