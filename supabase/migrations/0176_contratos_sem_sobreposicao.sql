-- Viva Nomads — 0176: nenhum período sobreposto no mesmo imóvel (complemento do coordenador, 19/10).
-- contratos.periodo (daterange) é mantido por gatilho a partir dos blocos; um EXCLUDE (btree_gist) recusa dois contratos
-- ativos do mesmo imóvel com períodos que se cruzam. Sequenciais continuam permitidos. A sobreposição de TESTE que já
-- existe (Santa Mônica, d9c70197 × 11281a61) é resolvida encerrando o contrato de teste mais antigo; conta real = para.
create extension if not exists btree_gist with schema extensions;

-- 1. Período do contrato, mantido pelo banco: do 1º início ao último fim dos blocos (o bloco recusado não conta).
alter table public.contratos add column if not exists periodo daterange;
comment on column public.contratos.periodo is 'Do primeiro início ao último fim dos blocos (fim inclusivo). Mantido pelo gatilho contrato_blocos_periodo (0176).';

create or replace function public.contrato_periodo_dos_blocos(p_contrato uuid)
returns daterange
language sql
stable
set search_path = public
as $$
  select case when count(*) = 0 then null else daterange(min(b.inicio), max(b.fim), '[]') end
    from public.contrato_blocos b
   where b.contrato_id = p_contrato
     and b.status is distinct from 'nao_aceito'
$$;

create or replace function public.contrato_blocos_atualiza_periodo()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_contrato uuid := case when tg_op = 'DELETE' then old.contrato_id else new.contrato_id end;
  v_periodo daterange := public.contrato_periodo_dos_blocos(v_contrato);
begin
  update public.contratos set periodo = v_periodo where id = v_contrato and periodo is distinct from v_periodo;
  return null;
end;
$$;
revoke all on function public.contrato_blocos_atualiza_periodo() from public, anon, authenticated;

drop trigger if exists contrato_blocos_periodo on public.contrato_blocos;
create trigger contrato_blocos_periodo
  after insert or delete or update of inicio, fim, status, contrato_id on public.contrato_blocos
  for each row execute function public.contrato_blocos_atualiza_periodo();

update public.contratos c
   set periodo = public.contrato_periodo_dos_blocos(c.id)
 where c.periodo is distinct from public.contrato_periodo_dos_blocos(c.id);

-- 2. Sobreposições que já existem. Conta real (qualquer parte sem is_teste): PARA e lista os casos para o Daniel.
--    Só contas de teste: o contrato de TESTE mais antigo do par fica encerrado (guardado para o rollback).
create table if not exists public._bkp_0176_contratos_encerrados (
  id uuid primary key,
  status text not null,
  encerrado_em timestamptz,
  guardado_em timestamptz not null default now()
);
revoke all on public._bkp_0176_contratos_encerrados from anon, authenticated;

do $$
declare
  v_reais text;
  v_id uuid;
begin
  with teste as (
    select c.id, (coalesce(pi.is_teste, false) and coalesce(po.is_teste, false)) as so_teste
      from public.contratos c
      join public.properties p on p.id = c.property_id
      left join public.profiles pi on pi.id = c.tenant_id
      left join public.profiles po on po.id = p.owner_id
  )
  select string_agg(format('imóvel %s: contrato %s (%s) × contrato %s (%s)', a.property_id, a.id, a.periodo, b.id, b.periodo), '; ')
    into v_reais
    from public.contratos a
    join public.contratos b on b.property_id = a.property_id and a.id < b.id
    join teste ta on ta.id = a.id
    join teste tb on tb.id = b.id
   where a.status = 'ativo' and b.status = 'ativo' and a.periodo && b.periodo
     and not (ta.so_teste and tb.so_teste);
  if v_reais is not null then
    raise exception '0176 parou: contratos ativos com períodos sobrepostos em conta real — o Daniel decide cada caso: %', v_reais;
  end if;

  loop
    select a.id into v_id
      from public.contratos a
      join public.contratos b on b.property_id = a.property_id and b.id <> a.id
     where a.status = 'ativo' and b.status = 'ativo' and a.periodo && b.periodo
       and (a.created_at, a.id) < (b.created_at, b.id)
     order by a.created_at, a.id
     limit 1;
    exit when v_id is null;
    insert into public._bkp_0176_contratos_encerrados (id, status, encerrado_em)
      select id, status, encerrado_em from public.contratos where id = v_id
      on conflict (id) do nothing;
    update public.contratos set status = 'encerrado_sem_renovacao', encerrado_em = coalesce(encerrado_em, now()) where id = v_id;
    raise notice '0176: contrato de teste % encerrado (sobreposto a um mais novo no mesmo imóvel)', v_id;
  end loop;
end;
$$;

-- 3. A regra: dois contratos ativos (assinando, aguardando pagamento ou em vigência) do mesmo imóvel não se sobrepõem.
--    Sequenciais continuam valendo: o próximo pode começar no dia seguinte ao fim do anterior.
do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'contratos_periodo_sem_sobreposicao') then
    alter table public.contratos
      add constraint contratos_periodo_sem_sobreposicao
      exclude using gist (property_id with =, periodo with &&) where (status = 'ativo');
  end if;
end;
$$;
