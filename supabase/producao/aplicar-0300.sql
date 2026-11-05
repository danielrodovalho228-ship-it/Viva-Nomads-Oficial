-- Viva Nomads — aplicar 0300 (E509: pausa sempre com motivo, também no INSERT). Idempotente.
-- Aplicada pela Action quando o PR é mesclado. Rollback: supabase/producao/rollback/0300_rollback.sql.
begin;
set local lock_timeout = '5s';

-- O gatilho de coerência da pausa (0223) só rodava no UPDATE: anúncio INSERIDO já pausado ficava sem motivo, e a tela
-- (Meus imóveis) lê motivo vazio como pausa da Viva — selo sem menu, ao lado dos pausados pelo dono com "Reativar".
-- Foi o caso dos 3 anúncios da massa da prova do E289 (0268), do dono de teste.

-- 1. A mesma regra no INSERT: pausado sem motivo vira pausa da Viva ('admin'), como no UPDATE (função da 0223).
drop trigger if exists trg_properties_pausa_coerente on public.properties;
create trigger trg_properties_pausa_coerente before insert or update of status on public.properties
  for each row execute function public.properties_pausa_coerente();

-- 2. Os 3 anúncios da massa do E289 (0268): pausados pelo próprio dono de teste na prova — motivo 'dono', como os
--    outros pausados dele. Só estes ids, só se ainda estiverem pausados e sem motivo.
update public.properties
   set pausa_motivo = 'dono', pausado_em = coalesce(pausado_em, now())
 where status = 'paused' and pausa_motivo is null and id in (
   'a0268a00-0000-4000-8000-000000000001',
   'a0268b00-0000-4000-8000-000000000001',
   'a0268c00-0000-4000-8000-000000000001');

-- Conferência (somente leitura):
--   select pausa_motivo, count(*) from public.properties where status = 'paused' group by 1;  -- nenhum null
--   select tgname, tgtype from pg_trigger where tgname = 'trg_properties_pausa_coerente';

insert into supabase_migrations.schema_migrations (version, name, statements, created_by)
select '20261105000300', '0300_pausa_motivo_no_insert_e509', array['-- conteúdo em supabase/migrations/0300_pausa_motivo_no_insert_e509.sql'], 'danielrodovalho228@gmail.com'
where not exists (select 1 from supabase_migrations.schema_migrations where version = '20261105000300');
commit;
