alter table public.donations replica identity full;
alter publication supabase_realtime add table public.donations;

alter table public.donation_status_log replica identity full;
alter publication supabase_realtime add table public.donation_status_log;