-- Rollback da 0180: devolve o enviado_em antigo, tira as falhas de envio da fila e as duas colunas.
begin;
update public.documentos_fiscais d set enviado_em = b.enviado_em
  from public._bkp_0180_enviado_em b where b.id = d.id and d.enviado_em is null;
delete from public.documentos_falhas where etapa = 'envio';
alter table public.documentos_falhas drop constraint if exists documentos_falhas_etapa;
alter table public.documentos_falhas drop column if exists etapa;
alter table public.documentos_fiscais drop constraint if exists documentos_fiscais_envio_lista;
alter table public.documentos_fiscais drop column if exists envio;
drop table if exists public._bkp_0180_enviado_em;
delete from supabase_migrations.schema_migrations where version = '20261019000180';
commit;
