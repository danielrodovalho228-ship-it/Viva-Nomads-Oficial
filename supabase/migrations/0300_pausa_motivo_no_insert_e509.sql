-- Viva Nomads — 0300 (E509): "Pausado" com o mesmo comportamento em todos os cartões. Idempotente.
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
