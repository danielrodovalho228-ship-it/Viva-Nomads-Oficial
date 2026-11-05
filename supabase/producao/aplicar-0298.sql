-- Viva Nomads — aplicar 0298 (E482: avisos.texto, a prévia da mensagem no sino). Idempotente.
-- Aplicada pela Action quando o PR é mesclado. Rollback: supabase/producao/rollback/0298_rollback.sql.
begin;
set local lock_timeout = '5s';

alter table public.avisos add column if not exists texto text;
do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'avisos_texto_curto' and conrelid = 'public.avisos'::regclass) then
    alter table public.avisos add constraint avisos_texto_curto check (texto is null or char_length(texto) <= 200);
  end if;
end
$$;
comment on column public.avisos.texto is 'E482: linha de texto do aviso (ex.: prévia da mensagem, limpa e filtrada). Gravada só pelo servidor.';

-- Conferência (somente leitura):
--   select column_name, data_type from information_schema.columns where table_schema = 'public' and table_name = 'avisos' and column_name = 'texto';
--   select has_column_privilege('authenticated', 'public.avisos', 'texto', 'UPDATE');  -- false

insert into supabase_migrations.schema_migrations (version, name, statements, created_by)
select '20261105000298', '0298_avisos_texto_e482', array['-- conteúdo em supabase/migrations/0298_avisos_texto_e482.sql'], 'danielrodovalho228@gmail.com'
where not exists (select 1 from supabase_migrations.schema_migrations where version = '20261105000298');
commit;
