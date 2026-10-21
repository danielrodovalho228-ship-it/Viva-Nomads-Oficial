-- Rollback da 0201: volta o /conferir e a numeração ao estado da 0182/0074 e tira o registro de documentos.
-- ATENÇÃO: apaga documentos_registro (com os registros de versões, PRV/CND/PRT/ENC) e o fechamento das conferências.
begin;
set local lock_timeout = '5s';
drop trigger if exists contratos_registro on public.contratos;
drop trigger if exists parceiro_pedidos_registro on public.parceiro_pedidos;
drop trigger if exists documentos_fiscais_anulacao_registro on public.documentos_fiscais;
drop trigger if exists conferencias_fechamento_imutavel on public.conferencias;
drop trigger if exists conferencia_itens_fechada on public.conferencia_itens;
drop trigger if exists conferencia_respostas_fechada on public.conferencia_respostas;
drop trigger if exists conferencia_laudos_fechada on public.conferencia_laudos;
drop function if exists public.registrar_contrato_novo();
drop function if exists public.registrar_pedido_novo();
drop function if exists public.documentos_fiscais_anulacao_registro();
drop function if exists public.conferencias_fechamento_imutavel();
drop function if exists public.conferencia_fechada_trava();
drop function if exists public.fechar_conferencia(uuid, text, text, text[]);
drop function if exists public.registrar_documento(text, text, text, text, uuid, text, text, uuid[], boolean, uuid, boolean, int);
drop function if exists public.alguma_parte_teste(uuid[]);
drop table if exists public.conferencia_correcoes;
drop table if exists public.documentos_registro;
drop function if exists public.documentos_registro_imutavel();
drop function if exists public.conferencia_correcoes_imutavel();
alter table public.conferencias drop constraint if exists conferencias_fechamento_hash;
alter table public.conferencias drop constraint if exists conferencias_fechamento_motivo;
alter table public.conferencias drop constraint if exists conferencias_fechamento_completo;
alter table public.conferencias drop column if exists fechada_em;
alter table public.conferencias drop column if exists fechamento_hash;
alter table public.conferencias drop column if exists fechamento_motivo;
alter table public.conferencias drop column if exists sem_resposta;

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
revoke all on function public.proximo_numero_documento(text) from public, anon, authenticated;
grant execute on function public.proximo_numero_documento(text) to service_role;

-- 5) Conferência pública: o número do contrato no formato da plataforma (VN-CT-11281A61) e o motivo da anulação.
drop function if exists public.conferir_documento(text);
create function public.conferir_documento(p_codigo text)
returns table (numero text, tipo text, valor numeric, emitido_em timestamptz, periodo_inicio date, periodo_fim date,
               locador text, locatario text, anulado_em timestamptz, anulado_motivo text, contrato text)
language sql
stable
security definer
set search_path = public
as $$
  select d.numero, d.tipo, d.valor, d.criado_em, d.periodo_inicio, d.periodo_fim,
         public.iniciais(d.locador_nome), public.iniciais(d.locatario_nome), d.anulado_em, d.anulado_motivo,
         case when d.contrato_id is null then null else 'VN-CT-' || upper(left(d.contrato_id::text, 8)) end
  from public.documentos_fiscais d
  where p_codigo ~ '^[0-9a-f]{32}$' and d.codigo_verificacao = p_codigo
$$;
revoke all on function public.conferir_documento(text) from public;
grant execute on function public.conferir_documento(text) to anon, authenticated, service_role;

delete from supabase_migrations.schema_migrations where version = '20261021000201';
commit;
