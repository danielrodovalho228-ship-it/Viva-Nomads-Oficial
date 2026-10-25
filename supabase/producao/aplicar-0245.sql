-- Viva Nomads — aplicar 0245 (dados de teste do roteiro de QA logado, ordem ee7d27b8 item 4). Idempotente.
-- Aplicada pela Action quando o PR é mesclado (o merge é a aprovação do Daniel).
-- Rollback: supabase/producao/rollback/0245_rollback.sql.
begin;
set local lock_timeout = '5s';

do $$
declare
  v_dono uuid;
begin
  select p.id into v_dono from public.profiles p
   where lower(p.email) = 'proprietario1@vivanomads.com.br' and p.is_teste;
  if v_dono is null then
    raise notice '0245: proprietario1 ausente ou não marcado como teste; nada a fazer';
    return;
  end if;

  update public.properties
     set status = 'active', pausa_motivo = null,
         limpeza_estadia = '{"porMes": 2, "inclui": "Limpeza geral e troca de roupa de cama", "valorMes": 180}'::jsonb
   where id = 'ddf86c66-a214-463d-8563-66a5204010b5' and owner_id = v_dono;

  update public.properties
     set status = 'active', pausa_motivo = null, limpeza_estadia = null
   where id = '9f18c108-ce4e-4b2c-b731-606ade99370d' and owner_id = v_dono;
end;
$$;

-- Conferência (somente leitura):
--   select id, status, limpeza_estadia from public.properties
--    where id in ('ddf86c66-a214-463d-8563-66a5204010b5','9f18c108-ce4e-4b2c-b731-606ade99370d');  -- 2 ativos; 1 com pacote

insert into supabase_migrations.schema_migrations (version, name, statements, created_by)
select '20261024000245', '0245_dados_qa_roteiro',
       array['-- conteúdo em supabase/migrations/0245_dados_qa_roteiro.sql'], 'danielrodovalho228@gmail.com'
 where not exists (select 1 from supabase_migrations.schema_migrations where version = '20261024000245');
commit;
