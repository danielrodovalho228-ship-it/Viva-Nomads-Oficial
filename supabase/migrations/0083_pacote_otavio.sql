-- 0083 — Pacote do Otávio (07/10/2026). Sem NOTICE; reaplicar é seguro.
-- Teste: tests/e2e/specs/t22-pacote-otavio.spec.ts (fala direto com o PostgREST).

-- 1) #29 + #25 — pedidos_publicos_lista() é SECURITY DEFINER e anon podia executar.
--    Só quem está logado usa (getPedidosParaProprietario e responderPedido, em
--    src/lib/data/pedidos-actions.ts); a função já devolve só colunas sem dado
--    pessoal. Então: anon não executa a função nem lê a view. Logado segue igual.
revoke execute on function public.pedidos_publicos_lista() from anon, public;
revoke select on public.pedidos_publicos from anon;

-- 2) #14 — Documento fiscal emitido não se apaga, nem com service_role.
--    No lugar do DELETE, ANULAÇÃO LÓGICA: anulado_em + anulado_motivo, gravados
--    uma vez só (update comum continua barrado pelo documentos_fiscais_imutavel).
--    A conferência pública passa a dizer que o documento foi anulado.
alter table public.documentos_fiscais
  add column if not exists anulado_em timestamptz,
  add column if not exists anulado_motivo text;
do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'documentos_fiscais_anulacao_ck') then
    alter table public.documentos_fiscais add constraint documentos_fiscais_anulacao_ck
      check ((anulado_em is null and anulado_motivo is null)
             or (anulado_em is not null and length(btrim(coalesce(anulado_motivo, ''))) >= 5));
  end if;
end;
$$;

create or replace function public.documentos_fiscais_imutavel()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  if (to_jsonb(new) - array['enviado_em', 'contrato_id', 'pagamento_id', 'acerto_id', 'owner_id', 'tenant_id', 'anulado_em', 'anulado_motivo'])
     is distinct from (to_jsonb(old) - array['enviado_em', 'contrato_id', 'pagamento_id', 'acerto_id', 'owner_id', 'tenant_id', 'anulado_em', 'anulado_motivo'])
     or (new.contrato_id is not null and new.contrato_id is distinct from old.contrato_id)
     or (new.pagamento_id is not null and new.pagamento_id is distinct from old.pagamento_id)
     or (new.acerto_id is not null and new.acerto_id is distinct from old.acerto_id)
     or (new.owner_id is not null and new.owner_id is distinct from old.owner_id)
     or (new.tenant_id is not null and new.tenant_id is distinct from old.tenant_id)
     -- anulação: só de "não anulado" para "anulado", uma vez, e não se desfaz
     or (old.anulado_em is not null and (new.anulado_em, new.anulado_motivo) is distinct from (old.anulado_em, old.anulado_motivo))
  then
    raise exception 'documento emitido não pode ser alterado' using errcode = '42501';
  end if;
  return new;
end;
$$;

create or replace function public.documentos_fiscais_sem_delete()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  raise exception 'documento fiscal não pode ser apagado: anule (anulado_em, anulado_motivo)' using errcode = '42501';
end;
$$;
create or replace trigger documentos_fiscais_sem_delete before delete on public.documentos_fiscais
  for each row execute function public.documentos_fiscais_sem_delete();
create or replace trigger documentos_fiscais_sem_truncate before truncate on public.documentos_fiscais
  for each statement execute function public.documentos_fiscais_sem_delete();
revoke delete, truncate on public.documentos_fiscais from anon, authenticated, service_role;

-- Conferência pública: devolve também anulado_em (o motivo não sai, pode ter dado pessoal).
drop function if exists public.conferir_documento(text);
create function public.conferir_documento(p_codigo text)
returns table (numero text, tipo text, valor numeric, emitido_em timestamptz, periodo_inicio date, periodo_fim date, locador text, locatario text, anulado_em timestamptz)
language sql
stable
security definer
set search_path = public
as $$
  select d.numero, d.tipo, d.valor, d.criado_em, d.periodo_inicio, d.periodo_fim,
         public.iniciais(d.locador_nome), public.iniciais(d.locatario_nome), d.anulado_em
  from public.documentos_fiscais d
  where p_codigo ~ '^[0-9a-f]{32}$' and d.codigo_verificacao = p_codigo
$$;
revoke all on function public.conferir_documento(text) from public;
grant execute on function public.conferir_documento(text) to anon, authenticated, service_role;
