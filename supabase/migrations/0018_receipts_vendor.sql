-- Tag a receipt with which vendor it's for, same vendor list used in Shelf Life/Consignment.
alter table receipts add column if not exists vendor_id uuid references vendors(id) on delete set null;
