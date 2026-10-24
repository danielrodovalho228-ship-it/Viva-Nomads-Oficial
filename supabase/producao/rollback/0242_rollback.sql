-- Viva Nomads — rollback da 0242: tira os tokens de captura, os links do celular e as colunas de origem/prazo das provas.
-- Idempotente. As fotos das provas (foto_path) ficam; sem a origem, todas voltam a contar como antes da regra. Sugestões
-- 'confirmada_sem_foto' voltam a 'sugerida' (o dono confirma de novo).
begin;
set local lock_timeout = '5s';
drop table if exists public.prova_capturas;
drop table if exists public.prova_links_celular;
update public.deteccao_sugestoes set status = 'sugerida', decidida_em = null where status = 'confirmada_sem_foto';
alter table public.deteccao_sugestoes drop constraint if exists deteccao_sugestoes_status_check;
alter table public.deteccao_sugestoes add constraint deteccao_sugestoes_status_check check (status in ('sugerida', 'aceita', 'descartada'));
alter table public.nivel_itens drop constraint if exists nivel_itens_foto_com_origem;
alter table public.nivel_itens drop constraint if exists nivel_itens_camera_sem_prazo;
drop index if exists public.nivel_itens_foto_hash_idx;
drop index if exists public.nivel_itens_refazer_idx;
alter table public.nivel_itens
  drop column if exists foto_origem,
  drop column if exists foto_capturada_em,
  drop column if exists foto_hash,
  drop column if exists refazer_ate,
  drop column if exists vencida_avisada_em;
delete from supabase_migrations.schema_migrations where version = '20261024000242';
commit;
