-- Viva Nomads — aplicar 0120 (portão da publicação no banco: documento aprovado vale para admin/service_role, ordem dos gatilhos, chamado de visitante, fim do backup).
-- Aplicada pela Action quando o PR é mesclado (o merge é a aprovação do Daniel).
-- Rollback: supabase/producao/rollback/0120_rollback.sql.
begin;
set local lock_timeout = '5s';

-- 1) #49 — Publicar exige documento aprovado TAMBÉM para admin e service_role.
--    Antes a checagem ficava depois do "return new" antecipado (service_role,
--    admin, postgres): quem passava por ali publicava sem documento aprovado.
--    Agora a transição para 'active' (UPDATE) é conferida antes. Ficam de fora
--    o dono do banco (postgres/supabase_admin: migrações e funções internas) e
--    gatilhos aninhados (pg_trigger_depth() > 1), que já eram isentos. O INSERT
--    de service_role (semente do laboratório) segue como estava.
create or replace function public.properties_protege_campos() returns trigger
language plpgsql set search_path = public as $$
declare
  q record;
  doc text;
begin
  if tg_op = 'UPDATE'
     and new.status::text = 'active'
     and old.status::text is distinct from 'active'
     and current_user not in ('supabase_admin', 'postgres')
     and pg_trigger_depth() <= 1
  then
    select qc.document_status into doc
      from public.qualification_checklists qc
     where qc.property_id = new.id
       and qc.owner_id = new.owner_id
     order by qc.created_at desc
     limit 1;
    if coalesce(doc, 'none') <> 'approved' then
      raise exception 'Documentação do imóvel ainda não aprovada' using errcode = '42501';
    end if;
  end if;

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

-- 2) #81 — Ordem dos gatilhos: o das 8 fotos passa a rodar DEPOIS do que
--    reescreve photo_count (o nome decide a ordem: "z" vem depois de "protege").
--    Antes, quem mandava photo_count = 8 junto com status = 'active' passava
--    pelo gatilho das fotos, e só depois o valor era devolvido ao verdadeiro.
do $$
begin
  if exists (select 1 from pg_trigger
              where tgrelid = 'public.properties'::regclass and tgname = 'properties_min_photos') then
    drop trigger properties_min_photos on public.properties;
  end if;
end $$;

create or replace trigger trg_properties_z_min_photos
  before update of status on public.properties
  for each row execute function public.enforce_min_photos();

-- 3) #120 — Chamado novo de visitante (sem conta): e-mail com formato válido e
--    nome de 2 a 60 caracteres. É gatilho de INSERT (e não CHECK) porque os
--    chamados antigos de contas apagadas ficam sem usuário e sem e-mail (0081)
--    e um CHECK barraria qualquer UPDATE neles (SLA, status).
create or replace function public.chamados_exige_dono() returns trigger
language plpgsql set search_path = public as $$
begin
  if new.usuario_id is null and new.visitante_email is null then
    raise exception 'chamado sem usuário nem e-mail' using errcode = '23514';
  end if;
  if new.usuario_id is null then
    if char_length(new.visitante_email) > 254
       or new.visitante_email !~ '^[^@[:space:]]+@[^@[:space:]]+\.[^@[:space:]]+$' then
      raise exception 'e-mail do visitante inválido' using errcode = '23514';
    end if;
    if new.visitante_nome is null or char_length(btrim(new.visitante_nome)) not between 2 and 60 then
      raise exception 'nome do visitante deve ter de 2 a 60 caracteres' using errcode = '23514';
    end if;
  end if;
  return new;
end $$;

-- 4) #26 — Fim do backup do draft_data da 0052/0053 (0 linhas, nenhuma função,
--    visão nem FK usa a tabela).
do $$
begin
  if to_regclass('public._backup_p0_draft_data') is not null then
    drop table public._backup_p0_draft_data;
  end if;
end $$;

insert into supabase_migrations.schema_migrations (version, name, statements, created_by)
select '20261014000120', '0120_portao_publicacao',
       array['-- conteúdo em supabase/migrations/0120_portao_publicacao.sql'], 'danielrodovalho228@gmail.com'
 where not exists (select 1 from supabase_migrations.schema_migrations where version = '20261014000120');
commit;
