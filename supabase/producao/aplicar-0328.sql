-- Viva Nomads — aplicar 0328 (QA: reposiciona as datas das estadias-semente do E689; corrige o fim do bloco que o app lê como a saída).
-- Idempotente. Aplicada pela Action quando o PR é mesclado. Rollback: supabase/producao/rollback/0328_rollback.sql.
begin;
set local lock_timeout = '5s';

do $$
declare
  v_agora timestamp := now() at time zone 'America/Sao_Paulo';
  v_alvo date;
  c_contrato_c constant uuid := 'a0327a00-0000-4000-8000-000000000011';
  c_contrato_m constant uuid := 'a0327b00-0000-4000-8000-000000000011';
  c_contrato_s constant uuid := 'a0327c00-0000-4000-8000-000000000011';
  c_bloco_c constant uuid := 'a0327a00-0000-4000-8000-000000000021';
  c_bloco_m constant uuid := 'a0327b00-0000-4000-8000-000000000021';
  c_bloco_s constant uuid := 'a0327c00-0000-4000-8000-000000000021';
begin
  if not exists (
    select 1 from public.contratos c
      join public.properties p on p.id = c.property_id
      join public.profiles pr on pr.id = p.owner_id and pr.is_teste
     where c.id in (c_contrato_c, c_contrato_m, c_contrato_s) and c.status = 'ativo'
  ) then
    raise notice '0328: estadias-semente do E689 ausentes, encerradas ou de conta que não é de teste; nada a fazer';
    return;
  end if;
  v_alvo := v_agora::date + case when v_agora::time >= time '09:30' then 1 else 0 end;

  -- Chegada: entrada em ALVO, 30 dias.
  update public.contrato_blocos set inicio = v_alvo, fim = v_alvo + 29 where id = c_bloco_c and contrato_id = c_contrato_c
    and exists (select 1 from public.contratos k where k.id = c_contrato_c and k.status = 'ativo');
  update public.contratos set periodo = daterange(v_alvo, v_alvo + 30, '[)') where id = c_contrato_c and status = 'ativo';
  -- Meio: 60 dias de bloco; o meio (entrada + 30) é ALVO.
  update public.contrato_blocos set inicio = v_alvo - 30, fim = v_alvo + 30 where id = c_bloco_m and contrato_id = c_contrato_m
    and exists (select 1 from public.contratos k where k.id = c_contrato_m and k.status = 'ativo');
  update public.contratos set periodo = daterange(v_alvo - 30, v_alvo + 31, '[)') where id = c_contrato_m and status = 'ativo';
  -- Saída: o último dia do bloco é ALVO+7; a semana da saída (fim - 7) é ALVO.
  update public.contrato_blocos set inicio = v_alvo - 22, fim = v_alvo + 7 where id = c_bloco_s and contrato_id = c_contrato_s
    and exists (select 1 from public.contratos k where k.id = c_contrato_s and k.status = 'ativo');
  update public.contratos set periodo = daterange(v_alvo - 22, v_alvo + 8, '[)') where id = c_contrato_s and status = 'ativo';

  -- Data do 1º pagamento acompanha a entrada de cada bloco (um dia antes), como na 0327.
  update public.pagamentos_bloco set data_pagamento = v_alvo - 1 where bloco_id = c_bloco_c and contrato_id = c_contrato_c and observacao = 'Massa de teste E689';
  update public.pagamentos_bloco set data_pagamento = v_alvo - 31 where bloco_id = c_bloco_m and contrato_id = c_contrato_m and observacao = 'Massa de teste E689';
  update public.pagamentos_bloco set data_pagamento = v_alvo - 23 where bloco_id = c_bloco_s and contrato_id = c_contrato_s and observacao = 'Massa de teste E689';
end $$;

insert into supabase_migrations.schema_migrations (version, name)
select '20261107000328', '0328_qa_estadia_semente_datas_e689'
where not exists (select 1 from supabase_migrations.schema_migrations where version = '20261107000328');

commit;
