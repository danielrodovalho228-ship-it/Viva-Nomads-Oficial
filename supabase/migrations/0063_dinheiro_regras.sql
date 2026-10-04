-- ─────────────────────────────────────────────────────────────────────────────
-- 0063 — dinheiro e regras (auditoria dos 5 agentes, PR B). Idempotente.
--
--  1. Renovação só com ACEITE DAS DUAS PARTES: blocos 2..n nascem
--     'pendente_aceite' (antes 'agendado', e o ciclo diário os ativava
--     sozinho). Só vira 'agendado' com os dois aceites. Pendente que passou da
--     data de início sem os dois aceites vira 'nao_aceito'.
--  2. Teto do contrato: soma dos blocos ≤ 180 dias (datas INCLUSIVAS) e soma
--     das cauções ≤ 3 aluguéis (art. 38 §2º). Contrato-mãe ≤ 180 dias.
--  3. Selos não somem ao editar anúncio sem qualificação ligada: mantém os
--     valores atuais (antes zerava). + liga qualificações antigas ao único
--     imóvel ATIVO do dono.
--  4. Piloto Fundador: no máximo 20 contas; a data de entrada é carimbada.
--  5. Pedido de Moradia expira no FIM do dia, no horário de Brasília.
-- ─────────────────────────────────────────────────────────────────────────────

-- ── 1/2. contrato_blocos ────────────────────────────────────────────────────
alter table public.contrato_blocos
  add column if not exists aceite_proprietario_em timestamptz,
  add column if not exists aceite_inquilino_em timestamptz;

alter table public.contrato_blocos drop constraint if exists contrato_blocos_status_check;
alter table public.contrato_blocos add constraint contrato_blocos_status_check
  check (status in ('pendente_aceite', 'nao_aceito', 'agendado', 'ativo', 'encerrado', 'renovado', 'encerrado_sem_renovacao'));

create or replace function public.contrato_blocos_regras()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  aluguel numeric;
  dias_total int;
  caucao_total numeric;
begin
  -- Bloco além do 1º só entra em vigor com os DOIS aceites.
  if coalesce(new.numero_bloco, 1) > 1
     and new.status in ('agendado', 'ativo')
     and (tg_op = 'INSERT' or old.status is distinct from new.status)
     and (new.aceite_proprietario_em is null or new.aceite_inquilino_em is null)
  then
    raise exception 'Renovação precisa do aceite do proprietário e do inquilino.' using errcode = '23514';
  end if;

  select c.aluguel_mensal into aluguel from public.contratos c where c.id = new.contrato_id;

  -- Soma do contrato (sem os não aceitos), contando esta linha como ficará.
  select coalesce(sum(b.fim - b.inicio + 1), 0), coalesce(sum(b.caucao), 0)
    into dias_total, caucao_total
    from public.contrato_blocos b
   where b.contrato_id = new.contrato_id
     and b.status <> 'nao_aceito'
     and b.id is distinct from new.id;
  if new.status <> 'nao_aceito' then
    dias_total := dias_total + coalesce(new.fim - new.inicio + 1, 0);
    caucao_total := caucao_total + coalesce(new.caucao, 0);
  end if;

  if dias_total > 180 then
    raise exception 'O contrato passaria de 180 dias. Para continuar, é preciso um novo contrato.' using errcode = '23514';
  end if;
  if aluguel is not null and aluguel > 0 and caucao_total > aluguel * 3 then
    raise exception 'A caução total do contrato não pode passar de 3 aluguéis (art. 38 §2º da Lei 8.245/91).' using errcode = '23514';
  end if;
  return new;
end;
$$;
drop trigger if exists trg_contrato_blocos_regras on public.contrato_blocos;
create trigger trg_contrato_blocos_regras
  before insert or update on public.contrato_blocos
  for each row execute function public.contrato_blocos_regras();

alter table public.contratos drop constraint if exists contratos_prazo_max_180;
alter table public.contratos add constraint contratos_prazo_max_180
  check (prazo_total_dias is null or prazo_total_dias <= 180);

-- Ciclo diário: sucessor só conta se foi ACEITO (agendado/ativo); pendente
-- vencido vira 'nao_aceito'.
create or replace function public.avancar_ciclo_blocos()
returns void
language plpgsql
security definer
set search_path = public
as $fn$
declare
  hoje date := (now() at time zone 'America/Sao_Paulo')::date;
begin
  -- (0) Proposta de renovação sem os dois aceites até o dia de início: caduca.
  update contrato_blocos
     set status = 'nao_aceito', encerrado_em = coalesce(encerrado_em, now())
   where status = 'pendente_aceite' and inicio <= hoje;

  -- (a) Ativa blocos ACEITOS que entraram em vigência hoje.
  update contrato_blocos
     set status = 'ativo'
   where status = 'agendado' and inicio <= hoje and fim >= hoje;

  -- (b) Bloco vencido com sucessor ACEITO → 'renovado'.
  update contrato_blocos b
     set status = 'renovado', encerrado_em = coalesce(b.encerrado_em, now())
   where b.status in ('agendado', 'ativo') and b.fim < hoje
     and exists (select 1 from contrato_blocos n
                  where n.contrato_id = b.contrato_id and n.numero_bloco = b.numero_bloco + 1
                    and n.status in ('agendado', 'ativo', 'renovado', 'encerrado', 'encerrado_sem_renovacao'));

  -- (c) Bloco vencido SEM sucessor aceito → encerra sem renovação.
  update contrato_blocos b
     set status = 'encerrado_sem_renovacao', encerrado_em = coalesce(b.encerrado_em, now())
   where b.status in ('agendado', 'ativo') and b.fim < hoje
     and not exists (select 1 from contrato_blocos n
                      where n.contrato_id = b.contrato_id and n.numero_bloco = b.numero_bloco + 1
                        and n.status in ('agendado', 'ativo', 'renovado', 'encerrado', 'encerrado_sem_renovacao'));

  -- (d) Contrato-mãe sem bloco vigente/aceito e com bloco encerrado sem
  --     renovação → 'encerrado_sem_renovacao'.
  update contratos c
     set status = 'encerrado_sem_renovacao', encerrado_em = coalesce(c.encerrado_em, now())
   where c.status = 'ativo'
     and exists (select 1 from contrato_blocos b where b.contrato_id = c.id and b.status = 'encerrado_sem_renovacao')
     and not exists (select 1 from contrato_blocos b where b.contrato_id = c.id and b.status in ('agendado', 'ativo'));
end
$fn$;

-- ── 3. selos: sem qualificação ligada, a edição MANTÉM os valores atuais ────
create or replace function public.properties_protege_campos()
returns trigger
language plpgsql
security invoker
set search_path = public
as $$
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
    -- Selos/etiquetas = os da qualificação DESTE imóvel (não o que a tela manda).
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
    -- Sem qualificação ligada: a tela não muda os selos, e eles não somem.
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

  -- Publicar exige o documento DESTE imóvel aprovado.
  if new.status::text = 'active'
     and (tg_op = 'INSERT' or old.status::text is distinct from 'active')
     and coalesce(q.document_status, 'none') <> 'approved'
  then
    raise exception 'Documentação do imóvel ainda não aprovada' using errcode = '42501';
  end if;
  return new;
end;
$$;

-- Qualificações sem imóvel: liga à do único imóvel ATIVO do dono.
update public.qualification_checklists qc
   set property_id = u.property_id
  from (
    select owner_id, min(id::text)::uuid as property_id
      from public.properties
     where status = 'active'
     group by owner_id
    having count(*) = 1
  ) u
 where qc.property_id is null
   and qc.owner_id = u.owner_id;

-- ── 4. Fundador: até 20 contas; carimba a data ──────────────────────────────
create or replace function public.fundador_vagas()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.fundador and not coalesce(old.fundador, false) then
    if (select count(*) from public.profiles where fundador and id <> new.id) >= 20 then
      raise exception 'As 20 vagas do Piloto Fundador já foram preenchidas.' using errcode = '23514';
    end if;
    new.fundador_em := coalesce(new.fundador_em, now());
  end if;
  return new;
end;
$$;
drop trigger if exists trg_fundador_vagas on public.profiles;
create trigger trg_fundador_vagas
  before update of fundador on public.profiles
  for each row execute function public.fundador_vagas();

-- Marcar Fundador: só admin (ou o servidor). A trava das 20 vagas vale sempre.
create or replace function public.marcar_fundador(alvo uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if not (public.is_admin() or current_user in ('service_role', 'postgres')) then
    raise exception 'Só a equipe marca Fundador.' using errcode = '42501';
  end if;
  update public.profiles set fundador = true where id = alvo and role = 'owner';
  if not found then
    raise exception 'Proprietário não encontrado.' using errcode = '23514';
  end if;
end;
$$;
revoke all on function public.marcar_fundador(uuid) from public;
grant execute on function public.marcar_fundador(uuid) to authenticated, service_role;

-- ── 5. Pedido expira no fim do dia (Brasília) ───────────────────────────────
create or replace function public.set_pedido_expira_em()
returns trigger
language plpgsql
as $trg$
begin
  if new.expira_em is null then
    new.expira_em := least(
      ((new.data_inicio + 15)::timestamp + time '23:59:59') at time zone 'America/Sao_Paulo',
      coalesce(new.criado_em, now()) + interval '60 days'
    );
  end if;
  return new;
end
$trg$;

-- Conferência (rodar depois):
--   select pg_get_constraintdef(oid) from pg_constraint where conname = 'contrato_blocos_status_check';
--   select tgname from pg_trigger where tgname in ('trg_contrato_blocos_regras', 'trg_fundador_vagas');
