-- Teste da 0120 (portão da publicação) num Postgres LOCAL descartável — nunca em produção.
-- Uso (banco vazio, depois de criar as roles service_role/authenticated/anon):
--   1) psql -f este arquivo (cria o esquema mínimo com as funções ANTIGAS, 0060/0081)
--   2) aplicar supabase/producao/aplicar-0120.sql (2x: idempotente, sem NOTICE)
--   3) psql -f supabase/testes/portao-0120-casos.sql  -> a tabela "resultado" não pode ter "ok = false".
-- Antes da 0120 os casos #49 (service_role/admin), #81, #120 e #26 falham; depois passam.
create or replace function public.properties_protege_campos() returns trigger
language plpgsql set search_path = public as $$
declare
  q record;
begin
  if current_user in ('service_role', 'supabase_admin', 'postgres')
     or pg_trigger_depth() > 1
     or public.is_admin()
  then
    return new;
  end if;

  select qc.document_status, qc.ready_to_live_score, qc.ready_to_live_badge,
         qc.tag_home_office, qc.tag_work_located, qc.tag_condo_approved
    into q
    from public.qualification_checklists qc
   where qc.property_id = new.id
     and qc.owner_id = new.owner_id
   order by qc.created_at desc
   limit 1;

  if found then
    new.ready_to_live_score := coalesce(q.ready_to_live_score, 0);
    new.ready_to_live_badge := coalesce(q.ready_to_live_badge, false);
    new.tag_home_office     := coalesce(q.tag_home_office, false);
    new.tag_work_located    := coalesce(q.tag_work_located, false);
    new.tag_condo_approved  := coalesce(q.tag_condo_approved, false);
  elsif tg_op = 'INSERT' then
    new.ready_to_live_score := 0;
    new.ready_to_live_badge := false;
    new.tag_home_office     := false;
    new.tag_work_located    := false;
    new.tag_condo_approved  := false;
  else
    new.ready_to_live_score := old.ready_to_live_score;
    new.ready_to_live_badge := old.ready_to_live_badge;
    new.tag_home_office     := old.tag_home_office;
    new.tag_work_located    := old.tag_work_located;
    new.tag_condo_approved  := old.tag_condo_approved;
  end if;

  if tg_op = 'INSERT' then
    new.photo_count          := 0;
    new.listing_quality_tier := 'padrao';
    new.rating               := 0;
    new.review_count         := 0;
    new.work_ready_badge     := false;
    new.work_score           := 0;
  else
    new.photo_count          := old.photo_count;
    new.listing_quality_tier := old.listing_quality_tier;
    new.rating               := old.rating;
    new.review_count         := old.review_count;
    new.work_ready_badge     := old.work_ready_badge;
    new.work_score           := old.work_score;
  end if;

  if new.status::text = 'active'
     and (tg_op = 'INSERT' or old.status::text is distinct from 'active')
     and coalesce(q.document_status, 'none') <> 'approved'
  then
    raise exception 'Documentação do imóvel ainda não aprovada' using errcode = '42501';
  end if;
  return new;
end;
$$;


grant all on schema public to service_role, authenticated, anon;
create schema supabase_migrations;
create table supabase_migrations.schema_migrations(version text primary key, name text, statements text[], created_by text);
create or replace function public.is_admin() returns boolean language sql as $$ select coalesce(current_setting('t.admin',true),'')='1' $$;
create table public.properties(id uuid primary key default gen_random_uuid(), owner_id uuid, status text default 'draft', photo_count int default 0,
 ready_to_live_score int, ready_to_live_badge bool, tag_home_office bool, tag_work_located bool, tag_condo_approved bool,
 listing_quality_tier text, rating numeric, review_count int, work_ready_badge bool, work_score int);
create table public.qualification_checklists(id uuid default gen_random_uuid(), property_id uuid, owner_id uuid, document_status text default 'none',
 ready_to_live_score int, ready_to_live_badge bool, tag_home_office bool, tag_work_located bool, tag_condo_approved bool, created_at timestamptz default now());
create table public.chamados(id uuid default gen_random_uuid(), usuario_id uuid, visitante_email text, visitante_nome text);
create table public._backup_p0_draft_data(property_id uuid primary key, draft_data jsonb, migracao text not null, salvo_em timestamptz default now());
grant all on all tables in schema public to service_role, authenticated, anon;
create or replace function public.enforce_min_photos() returns trigger language plpgsql set search_path=public as $$
begin if new.status = 'active' and coalesce(new.photo_count,0) < 8 then raise exception 'Anúncio precisa de pelo menos 8 fotos para ser publicado.'; end if; return new; end $$;
create trigger properties_min_photos before update of status on public.properties for each row execute function enforce_min_photos();
create trigger trg_properties_protege_campos before insert or update on public.properties for each row execute function properties_protege_campos();
create or replace function public.chamados_exige_dono() returns trigger language plpgsql set search_path=public as $$
begin if new.usuario_id is null and new.visitante_email is null then raise exception 'sem dono' using errcode='23514'; end if; return new; end $$;
create trigger chamados_exige_dono before insert on public.chamados for each row execute function chamados_exige_dono();
create table resultado(caso text, esperado text, obtido text, ok bool);
create or replace function t(caso text, esperado text, q text, papel text default 'postgres', admin text default '0') returns void language plpgsql as $$
declare o text;
begin
  perform set_config('t.admin', admin, false);
  begin execute 'set role '||papel; execute q; o:='passa'; exception when others then o:='falha'; end;
  reset role;
  insert into resultado values(caso, esperado, o, o=esperado);
end $$;
