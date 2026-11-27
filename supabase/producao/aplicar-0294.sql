-- Viva Nomads — aplicar 0294 (E574: o proprietário PJ declara se emite nota fiscal da locação; motivo de denúncia
-- "Não emitiu a nota fiscal declarada"). Idempotente. Aplicada pela Action quando o PR é mesclado.
-- Rollback: supabase/producao/rollback/0294_rollback.sql.
begin;
set local lock_timeout = '5s';

alter table public.profiles add column if not exists emite_nota_locacao boolean;
alter table public.profiles drop constraint if exists profiles_emite_nota_locacao_so_pj;
alter table public.profiles add constraint profiles_emite_nota_locacao_so_pj check (person_type = 'pj' or emite_nota_locacao is null);

alter table public.denuncias_anuncio drop constraint if exists denuncias_anuncio_motivo_check;
alter table public.denuncias_anuncio add constraint denuncias_anuncio_motivo_check
  check (motivo in ('fotos_falsas', 'imovel_nao_existe', 'pagamento_fora', 'conteudo_improprio', 'nota_nao_emitida', 'outro'));

insert into supabase_migrations.schema_migrations (version, name, statements, created_by)
select '20261105000294', '0294_dono_emite_nota_locacao', array['-- conteúdo em supabase/migrations/0294_dono_emite_nota_locacao.sql'], 'danielrodovalho228@gmail.com'
where not exists (select 1 from supabase_migrations.schema_migrations where version = '20261105000294');
commit;
