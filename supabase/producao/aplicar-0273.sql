-- Viva Nomads — aplicar 0273 (QA: visitas da inquilino2, uma presencial passada e uma por vídeo futura). Idempotente.
-- Aplicada pela Action quando o PR é mesclado. Rollback: supabase/producao/rollback/0273_rollback.sql.
begin;
set local lock_timeout = '5s';

do $$
declare
  v_dono uuid;
  v_morador uuid;
  c_imovel constant uuid := 'a0259000-0000-4000-8000-000000000001';
  c_passada constant uuid := 'a0273000-0000-4000-8000-000000000001';
  c_futura constant uuid := 'a0273000-0000-4000-8000-000000000002';
  c_futura_hora constant timestamptz := '2026-11-06 17:00:00+00';
  -- O mesmo texto que o servidor usa na chave da véspera (PostgREST devolve o timestamptz assim, em UTC).
  c_futura_txt constant text := '2026-11-06T17:00:00+00:00';
begin
  -- Contas de teste por e-mail E is_teste: em qualquer outra base, nada acontece.
  select id into v_dono from public.profiles where lower(email) = 'proprietario1@vivanomads.com.br' and is_teste;
  select id into v_morador from public.profiles where lower(email) = 'inquilino2@vivanomads.com.br' and is_teste;
  if v_dono is null or v_morador is null then
    raise notice '0273: contas de teste proprietario1/inquilino2 ausentes ou não marcadas como teste; nada a fazer';
    return;
  end if;
  if not exists (select 1 from public.properties where id = c_imovel and owner_id = v_dono and status = 'active') then
    raise notice '0273: o anúncio de teste da prova de publicação (0259) não está ativo do proprietario1; nada a fazer';
    return;
  end if;

  -- (1) Visita PRESENCIAL CONFIRMADA que já passou (30/10, 10h de Brasília): a prova do "Horário passou".
  if not exists (select 1 from public.visitas_video where id = c_passada)
     and not exists (select 1 from public.visitas_video where tenant_id = v_morador and property_id = c_imovel
                       and modalidade = 'presencial' and status in ('pedido', 'confirmado', 'remarcar')) then
    insert into public.visitas_video (id, property_id, owner_id, tenant_id, modalidade, horarios, motivo, status,
                                      horario_confirmado, link_chamada, criado_em, atualizado_em)
    values (c_passada, c_imovel, v_dono, v_morador, 'presencial', array['2026-10-30 13:00:00+00']::timestamptz[],
            'Trabalho remoto', 'confirmado', '2026-10-30 13:00:00+00', null, '2026-10-28 15:00:00+00', '2026-10-28 18:00:00+00');
  end if;

  -- (2) Visita por VÍDEO CONFIRMADA no futuro (06/11, 14h de Brasília), com link de chamada: o estado futuro e o
  -- "Entrar na chamada" dos dois lados (E290).
  if not exists (select 1 from public.visitas_video where id = c_futura)
     and not exists (select 1 from public.visitas_video where tenant_id = v_morador and property_id = c_imovel
                       and modalidade = 'video' and status in ('pedido', 'confirmado', 'remarcar')) then
    insert into public.visitas_video (id, property_id, owner_id, tenant_id, modalidade, horarios, motivo, status,
                                      horario_confirmado, link_chamada, criado_em, atualizado_em)
    values (c_futura, c_imovel, v_dono, v_morador, 'video',
            array['2026-11-06 17:00:00+00', '2026-11-06 20:00:00+00']::timestamptz[],
            'Trabalho remoto', 'confirmado', c_futura_hora, 'https://meet.google.com/qa-viva-e290', now(), now());
  end if;

  -- Massa não manda e-mail: a véspera da visita futura (cron de automações, 24 h antes) fica marcada como já enviada
  -- para os dois lados. A visita passada não tem aviso (a véspera só olha horário futuro; a expiração, só "pedido").
  insert into public.automacoes_envios (chave, tipo, usuario_id)
  select 'visita_vespera:' || c_futura || ':' || u || ':' || c_futura_txt, 'visita_vespera', u
    from unnest(array[v_morador, v_dono]) as u
   where exists (select 1 from public.visitas_video where id = c_futura)
     and not exists (select 1 from public.automacoes_envios e
                      where e.chave = 'visita_vespera:' || c_futura || ':' || u || ':' || c_futura_txt);
end
$$;

insert into supabase_migrations.schema_migrations (version, name, statements, created_by)
select '20261031000273', '0273_qa_visitas_inquilino2', array['-- conteúdo em supabase/migrations/0273_qa_visitas_inquilino2.sql'], 'danielrodovalho228@gmail.com'
where not exists (select 1 from supabase_migrations.schema_migrations where version = '20261031000273');
commit;
