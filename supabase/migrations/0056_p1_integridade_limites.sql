-- ════════════════════════════════════════════════════════════════════════════
-- 0056 — P1 (a): A3 (dono aprovando o próprio documento / publicando sem
-- aprovação / inflando selos) + limites de uso e idempotência das rotas pagas.
-- Aplicar DEPOIS da 0052 (o is_admin() só é confiável com ela). Idempotente.
--
--   A3  qualification_checklists: o usuário comum só grava o próprio checklist;
--       document_status nasce 'pending' (com documento) ou 'none' e só a equipe
--       (admin, que não revisa o PRÓPRIO) ou o servidor muda status/revisão.
--   A3  properties: publicar (status → active) só com o último documento do dono
--       APROVADO (regra no banco, não só na tela); selos e etiquetas espelham a
--       última qualificação; nota, avaliações, fotos e qualidade do anúncio não
--       são graváveis pelo dono (só servidor/triggers do próprio banco).
--   A5  limites_uso + consumir_limite(): contador por chave (usuário/IP) para
--       IA, Places, CAF e formulário de empresas. Só o servidor usa.
--   A5  cobrancas_fechamento: uma comissão e um contrato por candidatura
--       (idempotência das chamadas pagas).
--
-- Rollback: supabase/producao/rollback/0056_rollback.sql
-- ════════════════════════════════════════════════════════════════════════════

-- ── A3 — revisão de documento só pela equipe ────────────────────────────────
create or replace function public.qualificacao_protege_revisao()
returns trigger
language plpgsql
security invoker
set search_path = public
as $$
declare
  servidor boolean := current_user in ('service_role', 'supabase_admin', 'postgres');
begin
  if tg_op = 'INSERT' then
    if not servidor then
      new.document_status := case when new.document_path is not null then 'pending' else 'none' end;
      new.document_review_reason := null;
      new.document_reviewed_at := null;
      new.document_reviewed_by := null;
    end if;
    return new;
  end if;

  if servidor then
    return new;
  end if;
  if new.owner_id is distinct from old.owner_id
     or new.document_path is distinct from old.document_path
     or new.document_hash_sha256 is distinct from old.document_hash_sha256
  then
    raise exception 'Alteração não permitida no checklist' using errcode = '42501';
  end if;
  if new.document_status        is distinct from old.document_status
     or new.document_review_reason is distinct from old.document_review_reason
     or new.document_reviewed_at   is distinct from old.document_reviewed_at
     or new.document_reviewed_by   is distinct from old.document_reviewed_by
     or new.status                 is distinct from old.status
  then
    if not public.is_admin() then
      raise exception 'Somente a equipe Viva Nomads revisa documentos' using errcode = '42501';
    end if;
    if old.owner_id = auth.uid() then
      raise exception 'Ninguém revisa o próprio documento' using errcode = '42501';
    end if;
  end if;
  return new;
end;
$$;

drop trigger if exists trg_qualificacao_protege_revisao on public.qualification_checklists;
create trigger trg_qualificacao_protege_revisao
  before insert or update on public.qualification_checklists
  for each row execute function public.qualificacao_protege_revisao();

-- ── A3 — anúncio: publicar só com documento aprovado; campos do sistema ─────
create or replace function public.properties_protege_campos()
returns trigger
language plpgsql
security invoker
set search_path = public
as $$
declare
  q record;
begin
  -- Servidor, admin e triggers do próprio banco (ex.: recálculo de fotos, que
  -- roda dentro do trigger de property_photos → profundidade > 1) passam.
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
   where qc.owner_id = new.owner_id
   order by qc.created_at desc
   limit 1;

  -- Selos/etiquetas = os da última qualificação do dono (não o que a tela manda).
  new.ready_to_live_score := coalesce(q.ready_to_live_score, 0);
  new.ready_to_live_badge := coalesce(q.ready_to_live_badge, false);
  new.tag_home_office     := coalesce(q.tag_home_office, false);
  new.tag_work_located    := coalesce(q.tag_work_located, false);
  new.tag_condo_approved  := coalesce(q.tag_condo_approved, false);

  -- Campos que só o sistema calcula.
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

  -- Publicar exige o último documento do dono APROVADO.
  if new.status::text = 'active'
     and (tg_op = 'INSERT' or old.status::text is distinct from 'active')
     and coalesce(q.document_status, 'none') <> 'approved'
  then
    raise exception 'Documentação do imóvel ainda não aprovada' using errcode = '42501';
  end if;
  return new;
end;
$$;

drop trigger if exists trg_properties_protege_campos on public.properties;
create trigger trg_properties_protege_campos
  before insert or update on public.properties
  for each row execute function public.properties_protege_campos();

-- ── A5 — limites de uso (usuário/IP) ────────────────────────────────────────
create table if not exists public.limites_uso (
  id bigserial primary key,
  chave text not null,
  criado_em timestamptz not null default now()
);
create index if not exists limites_uso_chave_idx on public.limites_uso (chave, criado_em desc);
alter table public.limites_uso enable row level security;
revoke all on public.limites_uso from anon, authenticated;

-- Consome 1 uso da `chave` se ainda houver saldo na janela. Atômico por chave
-- (lock transacional). true = permitido (e registrado); false = estourou.
create or replace function public.consumir_limite(chave text, maximo int, janela_segundos int)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  usados int;
begin
  perform pg_advisory_xact_lock(hashtext('limites_uso:' || chave));
  delete from public.limites_uso l
   where l.chave = consumir_limite.chave
     and l.criado_em < now() - make_interval(secs => janela_segundos * 2);
  select count(*) into usados
    from public.limites_uso l
   where l.chave = consumir_limite.chave
     and l.criado_em > now() - make_interval(secs => janela_segundos);
  if usados >= maximo then
    return false;
  end if;
  insert into public.limites_uso (chave) values (consumir_limite.chave);
  return true;
end;
$$;
revoke all on function public.consumir_limite(text, int, int) from public, anon, authenticated;
grant execute on function public.consumir_limite(text, int, int) to service_role;

-- ── A5 — uma comissão e um contrato por candidatura ─────────────────────────
create table if not exists public.cobrancas_fechamento (
  lead_id uuid not null references public.leads (id) on delete cascade,
  tipo text not null check (tipo in ('comissao', 'contrato')),
  externo_id text,
  criado_em timestamptz not null default now(),
  primary key (lead_id, tipo)
);
alter table public.cobrancas_fechamento enable row level security;
revoke all on public.cobrancas_fechamento from anon, authenticated;
