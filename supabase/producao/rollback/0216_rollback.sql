-- Viva Nomads — rollback da 0216 (execução da avaliação do imóvel — Prompt 62-B2). Idempotente. Apaga checklist,
-- medições, laudos, strikes, devoluções e bloqueios (anúncios pausados por bloqueio voltam para a busca); tira 'VIS'
-- do contador. Os registros VIS já emitidos ficam em documentos_registro (imutável); se houver algum, o prefixo
-- continua aceito. O bucket "avaliacao-imovel" fica (apague pelo painel se estiver vazio).
begin;
set local lock_timeout = '5s';
do $volta$
begin
  if to_regclass('public.vistoria_bloqueios') is not null then
    update public.properties p set status = 'active'
      from public.vistoria_bloqueios b
     where b.property_id = p.id and b.resolvido_em is null and b.pausou and p.status::text = 'paused';
  end if;
end $volta$;
drop trigger if exists trg_properties_exige_laudo on public.properties;
drop function if exists public.properties_exige_laudo();
drop function if exists public.vistoria_bloqueio_aberto(uuid);
drop table if exists public.vistoria_bloqueios;
drop table if exists public.vistoria_devolucoes;
drop table if exists public.proprietario_strikes;
drop table if exists public.vistoria_laudos;
drop table if exists public.vistoria_medicoes;
drop table if exists public.vistoria_checklist_fotos;
drop table if exists public.vistoria_checklist;
alter table public.vistoria_pedidos drop constraint if exists vistoria_pedidos_verificacao;
alter table public.vistoria_pedidos drop column if exists visita_concluida_em;
alter table public.vistoria_pedidos drop column if exists laudo_atrasado_em;
alter table public.vistoria_pedidos drop column if exists verificacao_motivo;
alter table public.vistoria_pedidos drop column if exists verificacao_detalhe;
alter table public.vistoria_pedidos drop column if exists verificacao_aberta_por;
alter table public.vistoria_pedidos drop column if exists ruido_respostas;
delete from public.vistoria_fila_admin where tipo in ('laudo_atrasado', 'ressalva_vencida', 'devolucao_vencida', 'seguranca_grave');
alter table public.vistoria_fila_admin drop constraint if exists vistoria_fila_admin_tipo_check;
alter table public.vistoria_fila_admin add constraint vistoria_fila_admin_tipo_check check (
  tipo in ('sem_avaliador', 'avaliacao_teste', 'suspensao_automatica', 'proposta_descredenciamento')
);
do $prefixo$
begin
  if not exists (select 1 from public.documentos_registro where prefixo = 'VIS') then
    alter table public.documentos_registro drop constraint if exists documentos_registro_prefixo_check;
    alter table public.documentos_registro add constraint documentos_registro_prefixo_check check (
      prefixo in ('ORC', 'VN-CT', 'VN-SV', 'REC', 'RPG', 'RSV', 'CND', 'PRT', 'PRV', 'INF', 'ENC', 'CAU', 'DEV', 'REG', 'NFSE')
    );
  end if;
end $prefixo$;
create or replace function public.proximo_numero_documento(p_tipo text)
returns text
language plpgsql
security definer
set search_path = public
as $$
declare
  prefixo text := case p_tipo
    when 'recibo_aluguel' then 'REC'
    when 'comprovante_caucao' then 'CAU'
    when 'termo_devolucao_caucao' then 'DEV'
    when 'informe_anual' then 'INF'
    when 'PRV' then 'PRV'
    when 'CND' then 'CND'
    when 'PRT' then 'PRT'
    when 'ENC' then 'ENC'
    when 'RPG' then 'RPG'
    when 'RSV' then 'RSV'
    when 'REG' then 'REG'
  end;
  a int := extract(year from now() at time zone 'America/Sao_Paulo');
  n int;
begin
  if prefixo is null then
    raise exception 'tipo de documento inválido: %', p_tipo using errcode = '22023';
  end if;
  insert into public.documentos_fiscais_contador (ano, tipo, ultimo) values (a, p_tipo, 1)
  on conflict (ano, tipo) do update set ultimo = documentos_fiscais_contador.ultimo + 1
  returning ultimo into n;
  return prefixo || '-' || a || '-' || lpad(n::text, 6, '0');
end;
$$;
delete from supabase_migrations.schema_migrations where version = '20261023000216';
commit;
