-- Rollback da 0153: tira as propostas, as versões e o cartão na conversa. As mensagens continuam (só perdem o link).
begin;
drop trigger if exists messages_proposta_so_servidor on public.messages;
drop function if exists public.messages_proposta_so_servidor();
drop index if exists public.idx_messages_proposta_id;
alter table public.messages drop column if exists proposta_id;
drop table if exists public.proposta_versoes;
drop table if exists public.propostas;
-- O contador de documentos continua fechado (correção de segurança; não volta a ficar legível).
delete from supabase_migrations.schema_migrations where version = '20261017000153';
commit;
