-- Rollback da 0340: tira a tabela dos links usados. Efeito: links de aviso ainda no prazo voltam a abrir de novo
-- (a tela continua exigindo admin + duas etapas e nada é aprovado pelo link).
begin;
drop table if exists public.aprovacoes_links_usados;
delete from supabase_migrations.schema_migrations where version = '20261111000340';
commit;
