-- Optional stock count per menu item. Null means "not tracked" so existing
-- items keep working exactly as before until the owner sets a number.

alter table menu_items add column stock integer;
