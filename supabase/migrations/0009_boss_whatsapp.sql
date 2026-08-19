-- Optional WhatsApp number to send the daily report straight to, without
-- picking a contact each time. Digits only (country code + number, no + or spaces).
alter table businesses add column if not exists boss_whatsapp text;
