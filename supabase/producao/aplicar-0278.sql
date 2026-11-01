-- Viva Nomads — aplicar 0278 (E399-B: massa de QA do selo "Preço justo"; só anúncios de teste). Idempotente.
-- Aplicada pela Action quando o PR é mesclado (depois da 0277). Rollback: supabase/producao/rollback/0278_rollback.sql.
begin;
set local lock_timeout = '5s';

do $$
declare
  v_dono uuid;
begin
  select id into v_dono from public.profiles where lower(email) = 'proprietario1@vivanomads.com.br' and is_teste;
  if v_dono is null then
    raise notice '0278: conta de teste proprietario1 ausente ou não marcada como teste; nada a fazer';
    return;
  end if;
  update public.properties set airbnb_monthly_price = 3300
   where id = 'a0263000-0000-4000-8000-000000000001' and owner_id = v_dono and title = '[TESTE QA] Proativo E264 A';
  update public.properties set airbnb_monthly_price = 3350
   where id = 'a0263000-0000-4000-8000-000000000002' and owner_id = v_dono and title = '[TESTE QA] Proativo E264 B';
end
$$;

insert into supabase_migrations.schema_migrations (version, name, statements, created_by)
select '20261101000278', '0278_qa_massa_preco_justo', array['-- conteúdo em supabase/migrations/0278_qa_massa_preco_justo.sql'], 'danielrodovalho228@gmail.com'
where not exists (select 1 from supabase_migrations.schema_migrations where version = '20261101000278');
commit;
