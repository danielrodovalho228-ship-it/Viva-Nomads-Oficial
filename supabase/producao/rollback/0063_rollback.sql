-- ════════════════════════════════════════════════════════════════════════════
-- ROLLBACK da 0063 (dinheiro_regras). ⚠️ Volta a renovação automática e sem
-- teto, os selos zerando na edição e o Fundador sem limite de vagas.
-- Blocos 'pendente_aceite'/'nao_aceito' viram 'agendado'/'encerrado'.
-- ════════════════════════════════════════════════════════════════════════════
begin;
drop trigger if exists trg_contrato_blocos_regras on public.contrato_blocos;
drop function if exists public.contrato_blocos_regras();
update public.contrato_blocos set status = 'agendado' where status = 'pendente_aceite';
update public.contrato_blocos set status = 'encerrado' where status = 'nao_aceito';
alter table public.contrato_blocos drop constraint if exists contrato_blocos_status_check;
alter table public.contrato_blocos add constraint contrato_blocos_status_check
  check (status in ('agendado','ativo','encerrado','renovado','encerrado_sem_renovacao'));
alter table public.contratos drop constraint if exists contratos_prazo_max_180;
create or replace function public.avancar_ciclo_blocos() returns void language plpgsql security definer set search_path = public as $fn$
begin
  update contrato_blocos set status = 'ativo' where status = 'agendado' and inicio <= current_date and fim >= current_date;
  update contrato_blocos b set status = 'renovado', encerrado_em = coalesce(b.encerrado_em, now())
   where b.status in ('agendado','ativo') and b.fim < current_date
     and exists (select 1 from contrato_blocos n where n.contrato_id = b.contrato_id and n.numero_bloco = b.numero_bloco + 1);
  update contrato_blocos b set status = 'encerrado_sem_renovacao', encerrado_em = coalesce(b.encerrado_em, now())
   where b.status in ('agendado','ativo') and b.fim < current_date
     and not exists (select 1 from contrato_blocos n where n.contrato_id = b.contrato_id and n.numero_bloco = b.numero_bloco + 1);
  update contratos c set status = 'encerrado_sem_renovacao', encerrado_em = coalesce(c.encerrado_em, now())
   where c.status = 'ativo'
     and exists (select 1 from contrato_blocos b where b.contrato_id = c.id and b.status = 'encerrado_sem_renovacao')
     and not exists (select 1 from contrato_blocos b where b.contrato_id = c.id and b.status in ('agendado','ativo'));
end $fn$;
drop trigger if exists trg_fundador_vagas on public.profiles;
drop function if exists public.fundador_vagas();
drop function if exists public.marcar_fundador(uuid);
create or replace function public.set_pedido_expira_em() returns trigger language plpgsql as $trg$
begin
  if new.expira_em is null then
    new.expira_em := least((new.data_inicio::timestamptz + interval '15 days'), (coalesce(new.criado_em, now()) + interval '60 days'));
  end if;
  return new;
end $trg$;
-- properties_protege_campos: reaplicar o bloco "2." da 0060.
commit;
