-- ─────────────────────────────────────────────────────────────────────────────
-- 0070 — auditoria de segurança do banco (avisos do Supabase). Idempotente.
--
-- O Supabase dá EXECUTE a anon/authenticated em toda função nova do schema
-- public (privilégio padrão) — por isso um `revoke ... from public` sozinho
-- não tirava o acesso. Aqui:
--
--  1. Rotinas que ALTERAM dados e são do servidor/cron saem da API:
--     avancar_ciclo_blocos, expira_pedidos_moradia. O app passa a chamá-las
--     pelo servidor (service_role); a pg_cron roda como postgres.
--  2. Funções de GATILHO saem da API. O Postgres não confere EXECUTE quando o
--     gatilho dispara — eles continuam funcionando (testado no harness).
--     recalc_listing_quality NÃO é gatilho: é chamada DE DENTRO do gatilho de
--     fotos, como o dono logado; perde só o anon.
--     coordenada_aproximada idem (gatilho da 0066): continua chamável.
--  3. owner_response_metrics: vira security_invoker (respeita a RLS de
--     service_orders) e sai do alcance do anônimo. Nenhuma tela usa.
--  4. pedidos_publicos (mural): segue pública para leitura; escrita revogada.
--     Colunas conferidas: sem id/nome/contato do inquilino (só "verificado"),
--     e `apresentacao` já passa pelo bloqueio de contato da 0057.
--  5. search_path fixo nas funções apontadas pelo aviso.
-- Funções com trava por dentro (property_private_details, property_coordenadas,
-- pedido_inquilino, primeiros_nomes, pode_ver_contrato, tem_relacao_pedido_com,
-- pedido_ativo) ficam como estão.
-- ─────────────────────────────────────────────────────────────────────────────

do $$
declare
  f text;
begin
  -- 1. rotinas do servidor/cron
  foreach f in array array['public.avancar_ciclo_blocos()', 'public.expira_pedidos_moradia()'] loop
    if to_regprocedure(f) is not null then
      execute format('revoke execute on function %s from public, anon, authenticated', f);
      execute format('grant execute on function %s to service_role', f);
    end if;
  end loop;

  -- 2. funções de gatilho
  foreach f in array array[
    'public.handle_new_user()', 'public.avaliacao_valida()', 'public.contrato_blocos_regras()',
    'public.fundador_vagas()', 'public.vistoria_filho_selado()', 'public.trg_recalc_listing_quality()',
    'public.enforce_min_photos()', 'public.trava_vistoria_selada()', 'public.set_pedido_expira_em()'
  ] loop
    if to_regprocedure(f) is not null then
      execute format('revoke execute on function %s from public, anon, authenticated', f);
    end if;
  end loop;

  -- recalc_listing_quality: chamada pelo gatilho de fotos como o dono → só tira o anon.
  if to_regprocedure('public.recalc_listing_quality(uuid)') is not null then
    revoke execute on function public.recalc_listing_quality(uuid) from public, anon;
    grant execute on function public.recalc_listing_quality(uuid) to authenticated, service_role;
  end if;

  -- 5. search_path fixo
  foreach f in array array[
    'public.next_document_number(doc_type, integer)', 'public.recalc_listing_quality(uuid)',
    'public.trg_recalc_listing_quality()', 'public.enforce_min_photos()', 'public.trava_vistoria_selada()',
    'public.set_pedido_expira_em()', 'public.coordenada_aproximada(uuid, double precision, double precision)'
  ] loop
    if to_regprocedure(f) is not null then
      execute format('alter function %s set search_path = public', f);
    end if;
  end loop;
end
$$;

-- 3. owner_response_metrics: respeita a RLS de quem lê; anônimo fora.
do $$
begin
  if to_regclass('public.owner_response_metrics') is not null then
    alter view public.owner_response_metrics set (security_invoker = on);
    revoke all on public.owner_response_metrics from anon;
    revoke insert, update, delete, truncate, references, trigger on public.owner_response_metrics from authenticated;
  end if;

  -- 4. pedidos_publicos: só leitura.
  if to_regclass('public.pedidos_publicos') is not null then
    revoke insert, update, delete, truncate, references, trigger on public.pedidos_publicos from anon, authenticated;
  end if;
end
$$;

-- Conferência (rodar depois):
--   select has_function_privilege('anon', 'public.avancar_ciclo_blocos()', 'execute');              -- false
--   select has_function_privilege('authenticated', 'public.expira_pedidos_moradia()', 'execute');   -- false
--   select has_table_privilege('anon', 'public.owner_response_metrics', 'select');                  -- false
--   select reloptions from pg_class where relname = 'owner_response_metrics';                        -- {security_invoker=on}
