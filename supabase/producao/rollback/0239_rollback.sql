-- Viva Nomads — rollback da 0239: tira as sugestões das fotos (DETECTA-B). Idempotente.
-- Nada do nível depende delas (sugestão nunca contou); o que o dono confirmou já está em nivel_itens / no anúncio.
begin;
set local lock_timeout = '5s';
drop table if exists public.deteccao_sugestoes;
drop table if exists public.deteccao_fotos_analises;
delete from public.ia_chamadas where rota = 'deteccao';
alter table public.ia_chamadas drop constraint if exists ia_chamadas_rota_check;
alter table public.ia_chamadas add constraint ia_chamadas_rota_check check (rota in ('fotos', 'documento', 'matricula'));
delete from supabase_migrations.schema_migrations where version = '20261024000239';
commit;
