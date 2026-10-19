-- Viva Nomads — 0179: envio do recibo por destinatário + falha de envio na fila (complemento do recibo, 19/10). Idempotente.
-- Rollback: supabase/producao/rollback/0179_rollback.sql.
-- Aplicada pela Action quando o PR é mesclado (o merge é a aprovação do Daniel).
begin;
set local lock_timeout = '5s';

-- Resultado do envio por destinatário: [{ papel: locador|locatario, status: enviado|erro|simulado, resend_id, erro, em }].
-- Nunca o endereço de e-mail. As partes já leem documentos_fiscais pelo RLS de antes (só o próprio documento).
alter table public.documentos_fiscais add column if not exists envio jsonb not null default '[]'::jsonb;
alter table public.documentos_fiscais drop constraint if exists documentos_fiscais_envio_lista;
alter table public.documentos_fiscais add constraint documentos_fiscais_envio_lista check (jsonb_typeof(envio) = 'array');

-- A fila separa a falha de EMISSÃO ("Emitir de novo") da falha de ENVIO ("Reenviar e-mail", sem documento novo).
alter table public.documentos_falhas add column if not exists etapa text not null default 'emissao';
alter table public.documentos_falhas drop constraint if exists documentos_falhas_etapa;
alter table public.documentos_falhas add constraint documentos_falhas_etapa check (etapa in ('emissao', 'envio'));

-- Documentos emitidos antes deste registro: enviado_em foi gravado sem confirmação do Resend (o código contava a
-- recusa como envio). Guarda o valor antigo para o rollback, limpa enviado_em e põe cada um na fila como falha de
-- envio, para o admin usar "Reenviar e-mail" (em 19/10: REC-2026-000004 e REC-2026-000005).
create table if not exists public._bkp_0179_enviado_em (id uuid primary key, enviado_em timestamptz);
alter table public._bkp_0179_enviado_em enable row level security;
revoke all on public._bkp_0179_enviado_em from anon, authenticated;
insert into public._bkp_0179_enviado_em (id, enviado_em)
select d.id, d.enviado_em from public.documentos_fiscais d
 where d.envio = '[]'::jsonb and d.enviado_em is not null
on conflict (id) do nothing;
update public.documentos_fiscais d set enviado_em = null
 where d.envio = '[]'::jsonb and d.enviado_em is not null;
insert into public.documentos_falhas (pagamento_id, acerto_id, documento_id, motivo, etapa)
select d.pagamento_id, d.acerto_id, d.id, 'e-mail não confirmado: emitido antes do registro de envio', 'envio'
  from public.documentos_fiscais d
 where d.envio = '[]'::jsonb and d.anulado_em is null and d.enviado_em is null
   and (d.pagamento_id is not null or d.acerto_id is not null)
   and not exists (
     select 1 from public.documentos_falhas f
      where f.resolvido_em is null
        and (f.pagamento_id = d.pagamento_id or f.acerto_id = d.acerto_id)
   );

insert into supabase_migrations.schema_migrations (version, name, statements, created_by)
select '20261019000179', '0179_documentos_envio',
       array['-- conteúdo em supabase/migrations/0179_documentos_envio.sql'], 'danielrodovalho228@gmail.com'
 where not exists (select 1 from supabase_migrations.schema_migrations where version = '20261019000179');
commit;
