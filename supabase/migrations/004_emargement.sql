-- Émargement : une feuille par session (jeton secret), signatures depuis un téléphone sans compte (jeton du QR uniquement)
create schema if not exists emarg;
grant usage on schema emarg to authenticated;   -- anon n'a PAS accès direct aux tables : tout passe par les fonctions public.*

create table if not exists emarg.sheet(
  id uuid primary key default gen_random_uuid(),
  token text unique not null default encode(gen_random_bytes(18),'hex'),
  session_ref text, titre text,
  jours jsonb not null default '[]', stagiaires jsonb not null default '[]',
  created_by text, created_at timestamptz not null default now());
create table if not exists emarg.sign(
  id uuid primary key default gen_random_uuid(),
  sheet uuid not null references emarg.sheet(id) on delete cascade,
  jour text not null, demi text not null check (demi in ('m','a')),
  stagiaire text not null, signed_at timestamptz not null default now(), png text not null,
  unique(sheet,jour,demi,stagiaire));
alter table emarg.sheet enable row level security;
alter table emarg.sign enable row level security;
drop policy if exists sheet_rw on emarg.sheet;
create policy sheet_rw on emarg.sheet for all to authenticated using (public.my_member_id() is not null) with check (public.my_member_id() is not null);
drop policy if exists sign_read on emarg.sign;
create policy sign_read on emarg.sign for select to authenticated using (public.my_member_id() is not null);

-- Création/mise à jour d'une feuille : réservée à un membre connecté
create or replace function public.emarg_create_sheet(p_session_ref text,p_titre text,p_jours jsonb,p_stagiaires jsonb)
returns jsonb language plpgsql security definer set search_path=emarg,public as $$
declare t text; new_id uuid;
begin
  if public.my_member_id() is null then return jsonb_build_object('ok',false,'err','non autorisé'); end if;
  select id,token into new_id,t from emarg.sheet where session_ref=p_session_ref limit 1;
  if new_id is null then
    insert into emarg.sheet(session_ref,titre,jours,stagiaires,created_by)
      values(p_session_ref,p_titre,coalesce(p_jours,'[]'),coalesce(p_stagiaires,'[]'),public.my_member_id()) returning id,token into new_id,t;
  else update emarg.sheet set titre=p_titre,jours=coalesce(p_jours,'[]'),stagiaires=coalesce(p_stagiaires,'[]') where id=new_id; end if;
  return jsonb_build_object('ok',true,'token',t);
end $$;

-- Lecture d'une feuille par son jeton (téléphone, sans compte)
create or replace function public.emarg_get_sheet(p_token text)
returns jsonb language plpgsql security definer set search_path=emarg,public as $$
declare sh emarg.sheet; sg jsonb;
begin
  select * into sh from emarg.sheet where token=p_token; if not found then return null; end if;
  select coalesce(jsonb_agg(jsonb_build_object('jour',jour,'demi',demi,'stagiaire',stagiaire,'at',signed_at)),'[]') into sg from emarg.sign where sheet=sh.id;
  return jsonb_build_object('titre',sh.titre,'jours',sh.jours,'stagiaires',sh.stagiaires,'signatures',sg);
end $$;

-- Ajout d'une signature via le jeton (téléphone, sans compte) ; remplace si déjà signé
create or replace function public.emarg_add_sign(p_token text,p_jour text,p_demi text,p_stagiaire text,p_png text)
returns jsonb language plpgsql security definer set search_path=emarg,public as $$
declare sh_id uuid;
begin
  select id into sh_id from emarg.sheet where token=p_token;
  if sh_id is null then return jsonb_build_object('ok',false,'err','feuille introuvable'); end if;
  if p_demi not in ('m','a') then return jsonb_build_object('ok',false,'err','demi-journée invalide'); end if;
  if length(coalesce(p_png,''))<100 or length(p_png)>300000 then return jsonb_build_object('ok',false,'err','signature invalide'); end if;
  insert into emarg.sign(sheet,jour,demi,stagiaire,png) values(sh_id,p_jour,p_demi,p_stagiaire,p_png)
    on conflict (sheet,jour,demi,stagiaire) do update set png=excluded.png, signed_at=now();
  return jsonb_build_object('ok',true);
end $$;

revoke all on function public.emarg_create_sheet(text,text,jsonb,jsonb) from public;
revoke all on function public.emarg_get_sheet(text) from public;
revoke all on function public.emarg_add_sign(text,text,text,text,text) from public;
grant execute on function public.emarg_create_sheet(text,text,jsonb,jsonb) to authenticated;
grant execute on function public.emarg_get_sheet(text) to anon, authenticated;
grant execute on function public.emarg_add_sign(text,text,text,text,text) to anon, authenticated;
