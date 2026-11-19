-- Code de l'application dans le stockage de fichiers, bucket privé réservé aux membres actifs
insert into storage.buckets (id, name, public) values ('app','app',false)
  on conflict (id) do update set public=false;

drop policy if exists app_obj_read on storage.objects;
create policy app_obj_read on storage.objects for select to authenticated
  using (bucket_id = 'app' and public.my_member_id() is not null);
-- aucune écriture depuis le navigateur : dépôt par l'administrateur technique (clé de service)

-- app_files n'est plus la source du code ; on la vide pour éviter toute confusion
delete from public.app_files where name = 'app';
