-- Viva Nomads — aplicar 0082 (agente Renato). Sem NOTICE. Reaplicar é seguro.
begin;
insert into public.agentes (slug, nome, cargo, esquadrao, rotina_texto, trigger_id, status, ordem, briefing)
values ('renato', 'Renato', 'Engenheiro', 'tecnologia', 'Todo dia 06:57 Brasília', 'trig_01RFS85WLF1FsNhXB8zzEdbq', 'ativo', 17,
        'Engenheiro. Pega as ordens do Daniel e o pacote do Otávio, corrige com testes e abre um PR por dia. Nunca mescla nem aplica migração.')
on conflict (slug) do nothing;

insert into supabase_migrations.schema_migrations (version, name, statements, created_by)
select '20261007000082', '0082_agente_renato',
       array['-- conteúdo em supabase/migrations/0082_agente_renato.sql'], 'danielrodovalho228@gmail.com'
 where not exists (select 1 from supabase_migrations.schema_migrations where version = '20261007000082');
commit;

-- Conferência
select slug, status, ordem, trigger_id from public.agentes where slug = 'renato';
select version, name from supabase_migrations.schema_migrations where version = '20261007000082';
