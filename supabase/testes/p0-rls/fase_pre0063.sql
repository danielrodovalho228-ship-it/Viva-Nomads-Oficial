-- Antes da 0063 (estado de produção): colunas reais de blocos/contratos/pedidos
-- e as funções como estão hoje.
reset role;
alter table public.contrato_blocos
  add column if not exists inicio date, add column if not exists fim date,
  add column if not exists meses int, add column if not exists encerrado_em timestamptz;
alter table public.contrato_blocos drop constraint if exists contrato_blocos_status_check;
alter table public.contrato_blocos add constraint contrato_blocos_status_check
  check (status in ('agendado','ativo','encerrado','renovado','encerrado_sem_renovacao'));
alter table public.contratos add column if not exists prazo_total_dias int, add column if not exists encerrado_em timestamptz;
alter table public.pedidos_moradia add column if not exists data_inicio date, add column if not exists expira_em timestamptz;
create or replace function public.avancar_ciclo_blocos() returns void language plpgsql security definer set search_path = public as $fn$
begin
  update contrato_blocos set status = 'ativo' where status = 'agendado' and inicio <= current_date and fim >= current_date;
  update contrato_blocos b set status = 'renovado', encerrado_em = coalesce(b.encerrado_em, now())
   where b.status in ('agendado','ativo') and b.fim < current_date
     and exists (select 1 from contrato_blocos n where n.contrato_id = b.contrato_id and n.numero_bloco = b.numero_bloco + 1);
  update contrato_blocos b set status = 'encerrado_sem_renovacao', encerrado_em = coalesce(b.encerrado_em, now())
   where b.status in ('agendado','ativo') and b.fim < current_date
     and not exists (select 1 from contrato_blocos n where n.contrato_id = b.contrato_id and n.numero_bloco = b.numero_bloco + 1);
end $fn$;
create or replace function public.set_pedido_expira_em() returns trigger language plpgsql as $trg$
begin
  if new.expira_em is null then
    new.expira_em := least((new.data_inicio::timestamptz + interval '15 days'), (coalesce(new.criado_em, now()) + interval '60 days'));
  end if;
  return new;
end $trg$;
drop trigger if exists trg_pedido_expira on public.pedidos_moradia;
create trigger trg_pedido_expira before insert on public.pedidos_moradia for each row execute function public.set_pedido_expira_em();

-- Contrato de 6 meses (R$ 3.000) com 3 blocos de 60 dias — como o registrarContrato gravava.
insert into public.contratos (id, property_id, tenant_id, status, aluguel_mensal, prazo_total_dias) values
 ('dddddd63-0000-0000-0000-000000000001','aaaaaaa1-0000-0000-0000-000000000001','22222222-2222-2222-2222-222222222222','ativo',3000,180);
insert into public.contrato_blocos (id, contrato_id, numero_bloco, inicio, fim, meses, valor, caucao, status) values
 ('b6300000-0000-0000-0000-000000000001','dddddd63-0000-0000-0000-000000000001',1, current_date - 70, current_date - 11, 2, 6000, 3000, 'ativo'),
 ('b6300000-0000-0000-0000-000000000002','dddddd63-0000-0000-0000-000000000001',2, current_date - 10, current_date + 49, 2, 6000, 3000, 'agendado');
select public.avancar_ciclo_blocos();
select v('ANTES@0063','bloco 2 "agendado" sem aceite de ninguém entra em vigor sozinho','select status from contrato_blocos where id=''b6300000-0000-0000-0000-000000000002''','ativo');
select t('ANTES@0063','bloco que estoura 180 dias e 3 aluguéis de caução é aceito','passa',$q$insert into contrato_blocos(contrato_id,numero_bloco,inicio,fim,meses,valor,caucao,status) values ('dddddd63-0000-0000-0000-000000000001',3,current_date+50,current_date+139,3,9000,4500,'agendado')$q$);
delete from public.contrato_blocos where contrato_id = 'dddddd63-0000-0000-0000-000000000001';
delete from public.contratos where id = 'dddddd63-0000-0000-0000-000000000001';
