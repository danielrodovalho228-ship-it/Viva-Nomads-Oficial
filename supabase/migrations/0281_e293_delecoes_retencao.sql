-- 0281 — E293: as deleções da auditoria de retenção (relatório do PR #1759, §5 P5 e P6), aprovadas pelo Daniel em
-- 01/11/2026 (registro na lista-master, linha do E293). Só o que o relatório listou; o merge deste PR é a aprovação.
--   P6a medição de internet do MORADOR: sai depois de processada (o sinal ao dono sai na hora da medição; margem de 1 dia);
--   P6b medição de internet do DONO: fica só a última medição VÁLIDA de cada imóvel e ponto (as anteriores saem);
--   P6c tempos_deslocamento e proximidades_cep com mais de 30 dias; linhas da Mapbox em proximidades_cep (não podem ser guardadas);
--   P5  verificação CAF VENCIDA (valid_until no passado): o detalhe do fornecedor sai de caf_result; fica o veredito
--       (traffic_light, valid_until e caf_result só com light/simulado/eliminado_em).
-- NÃO entram (não são deleção ou dependem de outra decisão): P4 (Google Places, opção a/b), coluna caf_transacao_id,
-- destinos refeitos pelo OSM e os prazos do item 13.
-- Cada linha que sai vai para o LIVRO (eliminacoes_registro, motivo 'decisao'). Roda uma vez no aplicar e todo dia às
-- 04h17 UTC pelo pg_cron. Idempotente. Rollback: supabase/producao/rollback/0281_rollback.sql (tira a rotina; o que saiu não volta).

create or replace function public.e293_limpeza_retencao()
returns table (item text, linhas integer)
language plpgsql
security definer
set search_path = public
as $$
declare
  n integer;
begin
  -- P6a: medição do morador processada.
  with saiu as (
    delete from public.internet_medicoes
     where papel = 'morador' and medido_em < now() - interval '1 day'
    returning id
  ), livro as (
    insert into public.eliminacoes_registro (origem, ref_id, tipo, motivo, modo)
    select 'public.internet_medicoes', id::text, 'internet_medicoes/morador', 'decisao', 'apagado' from saiu
    returning 1
  ) select count(*) into n from livro;
  item := 'internet_medicoes/morador'; linhas := n; return next;

  -- P6b: do dono, só a última medição válida de cada imóvel e ponto.
  with ultima as (
    select property_id, coalesce(ponto, '') as ponto, max(medido_em) as em
      from public.internet_medicoes
     where papel = 'dono' and validada
     group by 1, 2
  ), saiu as (
    delete from public.internet_medicoes m
     using ultima u
     where m.papel = 'dono' and m.property_id = u.property_id and coalesce(m.ponto, '') = u.ponto and m.medido_em < u.em
    returning m.id
  ), livro as (
    insert into public.eliminacoes_registro (origem, ref_id, tipo, motivo, modo)
    select 'public.internet_medicoes', id::text, 'internet_medicoes/dono', 'decisao', 'apagado' from saiu
    returning 1
  ) select count(*) into n from livro;
  item := 'internet_medicoes/dono'; linhas := n; return next;

  -- P6c: tempos de deslocamento com mais de 30 dias.
  with saiu as (
    delete from public.tempos_deslocamento where calculado_em < now() - interval '30 days'
    returning property_id, destino_chave, modo
  ), livro as (
    insert into public.eliminacoes_registro (origem, ref_id, tipo, motivo, modo)
    select 'public.tempos_deslocamento', left(property_id::text || ':' || destino_chave || ':' || modo, 300), 'tempos_deslocamento', 'decisao', 'apagado' from saiu
    returning 1
  ) select count(*) into n from livro;
  item := 'tempos_deslocamento'; linhas := n; return next;

  -- P6c: vizinhança com mais de 30 dias ou da Mapbox.
  with saiu as (
    delete from public.proximidades_cep where atualizado_em < now() - interval '30 days' or fonte = 'mapbox'
    returning cep
  ), livro as (
    insert into public.eliminacoes_registro (origem, ref_id, tipo, motivo, modo)
    select 'public.proximidades_cep', cep, 'proximidades_cep', 'decisao', 'apagado' from saiu
    returning 1
  ) select count(*) into n from livro;
  item := 'proximidades_cep'; linhas := n; return next;

  -- P5: CAF vencida — fica só o veredito.
  with saiu as (
    update public.tenant_verifications
       set caf_result = jsonb_strip_nulls(jsonb_build_object('light', caf_result -> 'light', 'simulado', caf_result -> 'simulado', 'eliminado_em', now()))
     where valid_until < now() and caf_result is not null and not (caf_result ? 'eliminado_em')
    returning id
  ), livro as (
    insert into public.eliminacoes_registro (origem, ref_id, tipo, motivo, modo)
    select 'public.tenant_verifications', id::text, 'tenant_verifications/caf_result', 'decisao', 'anonimizado' from saiu
    returning 1
  ) select count(*) into n from livro;
  item := 'tenant_verifications/caf_result'; linhas := n; return next;
end;
$$;

revoke all on function public.e293_limpeza_retencao() from public, anon, authenticated;

do $$
begin
  create extension if not exists pg_cron;
  perform cron.unschedule('e293-limpeza-retencao') where exists (select 1 from cron.job where jobname = 'e293-limpeza-retencao');
  perform cron.schedule('e293-limpeza-retencao', '17 4 * * *', 'select public.e293_limpeza_retencao();');
end;
$$;

-- Primeira rodada, no aplicar.
select * from public.e293_limpeza_retencao();
