-- Viva Nomads — aplicar 0271 (QA: visita de avaliação de teste agendada para amanhã, prova ao vivo do lembrete da
-- vistoria do E289). Idempotente. Aplicada pela Action quando o PR é mesclado. Rollback: supabase/producao/rollback/0271_rollback.sql.
begin;
set local lock_timeout = '5s';

do $$
declare
  v_dono uuid;
  v_morador uuid;
  v_avaliador uuid;
  v_valor numeric;
  v_dia date;
  -- O anúncio de teste PAUSADO "[TESTE QA NÍVEL] Essencial" do proprietario1 (fora da busca), sem pedido aberto.
  c_imovel constant uuid := '8a39c131-0c53-4f35-b2ea-1e7d7e3d2614';
  c_pedido constant uuid := 'a0271000-0000-4000-8000-000000000001';
begin
  -- Só contas de teste (e-mail E is_teste): em qualquer outra base, nada acontece.
  select id into v_dono from public.profiles where lower(email) = 'proprietario1@vivanomads.com.br' and is_teste;
  select id into v_morador from public.profiles where lower(email) = 'cadastro1@vivanomads.com.br' and is_teste;
  if v_dono is null or v_morador is null then
    raise notice '0271: contas de teste ausentes ou não marcadas como teste; nada a fazer';
    return;
  end if;
  if not exists (select 1 from public.properties where id = c_imovel and owner_id = v_dono and title like '[TESTE QA%' and status = 'paused') then
    raise notice '0271: anúncio [TESTE QA NÍVEL] Essencial ausente, de outro dono ou fora de pausa; nada a fazer';
    return;
  end if;
  -- O avaliador credenciado de teste UDI-002 (avaliador1@), ativo ou em teste.
  select id into v_avaliador from public.avaliadores_credenciamento where numero_credenciado = 'UDI-002' and status in ('ativo', 'em_teste');
  if v_avaliador is null then
    raise notice '0271: avaliador de teste UDI-002 ausente ou não credenciado; nada a fazer';
    return;
  end if;
  if exists (select 1 from public.vistoria_pedidos where id = c_pedido)
     or exists (select 1 from public.vistoria_pedidos where property_id = c_imovel and status in ('pedido', 'designado', 'agendado')) then
    raise notice '0271: a massa já existe ou o anúncio tem pedido aberto; nada a fazer';
    return;
  end if;
  select valor into v_valor from public.vistoria_precos where cidade = 'Uberlândia' and porte = 'q1_2' order by vigente_desde desc limit 1;

  -- A visita fica no dia SEGUINTE ao da aplicação (10:00 em Brasília). Aplicada depois das 21:00 de Brasília, vai para
  -- o outro dia: assim a rodada horária de "amanhã" sempre acontece antes da meia-noite que a tornaria "hoje".
  v_dia := ((now() at time zone 'America/Sao_Paulo') + interval '3 hours')::date + 1;

  -- Visita AGENDADA, imóvel ocupado com a concordância da moradora: a rotina da avaliação (de hora em hora, 0215) manda
  -- o lembrete da véspera (vistoria_lembrete) ao dono, ao avaliador e à moradora, com o imóvel e a data e hora.
  insert into public.vistoria_pedidos (id, property_id, owner_id, cidade, tipo, porte, valor_tabela, status, avaliador_id,
                                       designado_em, agendado_para, ocupado, morador_id, concordancia_pedida_em, concordancia_em, teste)
  values (c_pedido, c_imovel, v_dono, 'Uberlândia', 'inicial', 'q1_2', coalesce(v_valor, 0), 'agendado', v_avaliador,
          now() - interval '1 day', (v_dia + time '10:00') at time zone 'America/Sao_Paulo', true, v_morador,
          now() - interval '1 day', now() - interval '1 day', true);
end
$$;

insert into supabase_migrations.schema_migrations (version, name, statements, created_by)
select '20261031000271', '0271_qa_massa_vistoria_e289', array['-- conteúdo em supabase/migrations/0271_qa_massa_vistoria_e289.sql'], 'danielrodovalho228@gmail.com'
where not exists (select 1 from supabase_migrations.schema_migrations where version = '20261031000271');
commit;
