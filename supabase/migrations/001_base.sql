-- PPA Pilot · base de données (Supabase / PostgreSQL)
-- Une ligne par fiche : la synchro n'échange que ce qui change, et les droits sont vérifiés par le serveur.

-- ---------- Équipe : lien entre un compte de connexion et une personne du CRM ----------
create table if not exists public.members (
  id          text primary key,                       -- identifiant CRM (E1, E7, E8…)
  user_id     uuid unique references auth.users(id) on delete set null,
  email       text unique,
  role        text not null check (role in ('direction','admin','terrain','phoneuse','formateur')),
  active      boolean not null default true,
  created_at  timestamptz not null default now()
);
alter table public.members enable row level security;

create or replace function public.my_member_id() returns text
language sql stable security definer set search_path = public as
$$ select id from public.members where user_id = auth.uid() and active $$;

create or replace function public.my_role() returns text
language sql stable security definer set search_path = public as
$$ select role from public.members where user_id = auth.uid() and active $$;

create or replace function public.is_mgr() returns boolean
language sql stable security definer set search_path = public as
$$ select coalesce((select role in ('direction','admin') from public.members where user_id = auth.uid() and active), false) $$;

drop policy if exists members_read on public.members;
create policy members_read on public.members for select to authenticated using (public.my_member_id() is not null);
drop policy if exists members_write on public.members;
create policy members_write on public.members for all to authenticated
  using (public.my_role() = 'direction') with check (public.my_role() = 'direction');

-- ---------- Fiches ----------
create table if not exists public.records (
  coll        text not null,                          -- collection v112 : clients, deals, sessions, dos, comInv…
  id          text not null,                          -- identifiant de la fiche dans sa collection
  data        jsonb not null,
  client_id   text,                                   -- entreprise concernée (pour les recherches et les droits)
  owners      text[] not null default '{}',           -- personnes (hors direction/administration) autorisées à voir la fiche
  deleted     boolean not null default false,
  updated_at  timestamptz not null default now(),
  updated_by  text,
  primary key (coll, id)
);
create index if not exists records_owners_idx on public.records using gin (owners);
create index if not exists records_client_idx on public.records (client_id);
create index if not exists records_updated_idx on public.records (updated_at);
alter table public.records enable row level security;

-- Collections visibles par toute l'équipe connectée (agenda partagé, référentiels, réglages)
create or replace function public.is_shared(c text) returns boolean
language sql immutable as
$$ select c = any (array['equipe','conf','prep','rules','access','meta','cities','rdv','sessions','catalog','suiviItems','imports']) $$;

create or replace function public.can_see(c text, o text[]) returns boolean
language sql stable security definer set search_path = public as
$$ select public.my_member_id() is not null and (public.is_mgr() or public.is_shared(c) or public.my_member_id() = any(o)) $$;

drop policy if exists rec_read on public.records;
create policy rec_read on public.records for select to authenticated using (public.can_see(coll, owners));
drop policy if exists rec_insert on public.records;
create policy rec_insert on public.records for insert to authenticated
  with check (public.my_member_id() is not null and (public.is_mgr() or public.my_member_id() = any(owners) or coll in ('rdv','log','comLog','deals')));
drop policy if exists rec_update on public.records;
create policy rec_update on public.records for update to authenticated
  using (public.can_see(coll, owners))
  with check (public.my_member_id() is not null and (public.is_mgr() or public.my_member_id() = any(owners) or coll in ('rdv','log','comLog')));
-- Pas de suppression physique depuis le CRM : on marque « deleted » (l'historique garde tout).

-- Horodatage et auteur posés par le serveur (impossible à falsifier depuis le navigateur)
create or replace function public.rec_stamp() returns trigger
language plpgsql security definer set search_path = public as
$$ begin new.updated_at := now(); new.updated_by := coalesce(public.my_member_id(), new.updated_by); return new; end $$;
drop trigger if exists rec_stamp on public.records;
create trigger rec_stamp before insert or update on public.records for each row execute function public.rec_stamp();

-- ---------- Historique : chaque version précédente est conservée ----------
create table if not exists public.records_history (
  hid         bigserial primary key,
  coll        text not null,
  id          text not null,
  data        jsonb,
  owners      text[],
  deleted     boolean,
  changed_at  timestamptz not null default now(),
  changed_by  text
);
create index if not exists records_history_idx on public.records_history (coll, id, changed_at desc);
alter table public.records_history enable row level security;
drop policy if exists hist_read on public.records_history;
create policy hist_read on public.records_history for select to authenticated using (public.is_mgr());

create or replace function public.rec_history() returns trigger
language plpgsql security definer set search_path = public as
$$ begin
  insert into public.records_history(coll,id,data,owners,deleted,changed_by) values (old.coll,old.id,old.data,old.owners,old.deleted,public.my_member_id());
  return new; end $$;
drop trigger if exists rec_history on public.records;
create trigger rec_history after update on public.records for each row
  when (old.data is distinct from new.data or old.deleted is distinct from new.deleted or old.owners is distinct from new.owners)
  execute function public.rec_history();

-- ---------- Temps réel : chaque modification est poussée aux personnes autorisées ----------
do $$ begin
  if not exists (select 1 from pg_publication_tables where pubname='supabase_realtime' and tablename='records') then
    alter publication supabase_realtime add table public.records;
  end if;
end $$;
alter table public.records replica identity full;
