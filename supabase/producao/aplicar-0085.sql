-- Viva Nomads — aplicar 0085 (Executar agora: colunas do disparo em agentes_ordens). Sem NOTICE.
-- Rollback: supabase/producao/rollback/0085_rollback.sql
begin;
do $$
begin
  if not exists (select 1 from information_schema.columns
                  where table_schema = 'public' and table_name = 'agentes_ordens' and column_name = 'disparada_em') then
    alter table public.agentes_ordens
      add column disparada_em timestamptz,
      add column sessao_url text check (sessao_url is null or sessao_url like 'https://claude.ai/%'),
      add column disparo_erro text check (disparo_erro is null or char_length(disparo_erro) <= 300);
  end if;
end;
$$;

insert into supabase_migrations.schema_migrations (version, name, statements, created_by)
select '20261007000085', '0085_ordens_executar_agora',
       array['-- conteúdo em supabase/migrations/0085_ordens_executar_agora.sql'], 'danielrodovalho228@gmail.com'
 where not exists (select 1 from supabase_migrations.schema_migrations where version = '20261007000085');
commit;

-- Conferência (esperado: 3 colunas)
select column_name, data_type from information_schema.columns
 where table_schema = 'public' and table_name = 'agentes_ordens' and column_name in ('disparada_em', 'sessao_url', 'disparo_erro') order by 1;
