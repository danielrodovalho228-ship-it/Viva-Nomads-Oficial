-- 0328 — QA (E689, correção da 0327): reposiciona as datas das 3 estadias-semente.
--
-- Achado da QA (noite de 07/11): a estadia de saída (VN-CT-A0327C00) aparecia com "saída em 14/11" e "conferência de
-- saída até 16/11", diferente do desenho (saída em ALVO+7 = 15/11).
-- Causa: a 0327 tratou o fim do período (daterange, exclusivo) como o dia da saída, mas o app lê o ÚLTIMO DIA do último
-- bloco (contrato_blocos.fim, inclusivo) como a saída (jornada-mensagens, cron de lembrete e avaliação). Resultado:
--   • saída: o bloco acabava em ALVO+6, a "semana da saída" caía em ALVO-1 (um dia ANTES da rodada) e não disparava;
--   • meio: o bloco tinha 59 dias (< 60), então a mensagem do meio da estadia nem existia.
-- Correção (só dado, só as linhas de ids fixos a0327…, só enquanto o contrato segue ativo e de conta de teste):
--   • chegada: entrada em ALVO (sem mudança de dia; o período é só realinhado);
--   • meio: 60 dias de bloco (ALVO-30 a ALVO+30) → o meio (entrada + 30) cai em ALVO;
--   • saída: último dia do bloco em ALVO+7 → a semana da saída (fim - 7) cai em ALVO.
-- ALVO = o dia da próxima rodada do cron (13:00 UTC): hoje se aplicada antes das 09:30 de Brasília, senão amanhã.
-- Rollback: supabase/producao/rollback/0328_rollback.sql (volta às datas da 0327 relativas ao mesmo ALVO).

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
