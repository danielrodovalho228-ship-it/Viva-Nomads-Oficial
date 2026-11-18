-- Rollback da 0328: volta as datas das estadias-semente do E689 ao desenho da 0327 (relativas ao mesmo ALVO; só ids a0327…).
begin;
do $$
declare
  v_agora timestamp := now() at time zone 'America/Sao_Paulo';
  v_alvo date := (now() at time zone 'America/Sao_Paulo')::date + case when (now() at time zone 'America/Sao_Paulo')::time >= time '09:30' then 1 else 0 end;
begin
  update public.contrato_blocos set inicio = v_alvo - 30, fim = v_alvo + 29 where id = 'a0327b00-0000-4000-8000-000000000021';
  update public.contrato_blocos set inicio = v_alvo - 23, fim = v_alvo + 6 where id = 'a0327c00-0000-4000-8000-000000000021';
  update public.contratos set periodo = daterange(v_alvo - 30, v_alvo + 30, '[)') where id = 'a0327b00-0000-4000-8000-000000000011' and status = 'ativo';
  update public.contratos set periodo = daterange(v_alvo - 23, v_alvo + 7, '[)') where id = 'a0327c00-0000-4000-8000-000000000011' and status = 'ativo';
  update public.pagamentos_bloco set data_pagamento = v_alvo - 24 where bloco_id = 'a0327c00-0000-4000-8000-000000000021' and observacao = 'Massa de teste E689';
end $$;
delete from supabase_migrations.schema_migrations where version = '20261107000328';
commit;
