-- Code de l'application : téléchargeable uniquement par un membre connecté et actif
create table if not exists public.app_files (
  name        text primary key,
  version     integer not null,
  content     text not null,
  updated_at  timestamptz not null default now()
);
alter table public.app_files enable row level security;
drop policy if exists app_read on public.app_files;
create policy app_read on public.app_files for select to authenticated using (public.my_member_id() is not null);
-- aucune écriture depuis le navigateur : publication par l'administrateur technique uniquement
