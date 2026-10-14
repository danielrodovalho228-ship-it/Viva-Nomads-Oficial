-- Rollback da 0120: volta as funções e o gatilho das fotos ao estado da 0081/0060 e recria a tabela de backup (vazia).
begin;
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


do $$
begin
  if exists (select 1 from pg_trigger
              where tgrelid = 'public.properties'::regclass and tgname = 'trg_properties_z_min_photos') then
    drop trigger trg_properties_z_min_photos on public.properties;
  end if;
end $$;
create or replace trigger properties_min_photos
  before update of status on public.properties
  for each row execute function public.enforce_min_photos();

create or replace function public.chamados_exige_dono() returns trigger
language plpgsql set search_path = public as $$
begin
  if new.usuario_id is null and new.visitante_email is null then
    raise exception 'chamado sem usuário nem e-mail' using errcode = '23514';
  end if;
  return new;
end $$;

create table if not exists public._backup_p0_draft_data (
  property_id uuid primary key,
  draft_data jsonb,
  migracao text not null,
  salvo_em timestamptz not null default now()
);
alter table public._backup_p0_draft_data enable row level security;
revoke all on public._backup_p0_draft_data from anon, authenticated;

delete from supabase_migrations.schema_migrations where version = '20261014000120';
commit;
