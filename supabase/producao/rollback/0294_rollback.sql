-- Rollback da 0294 (E574). Denúncias com o motivo novo viram 'outro' antes de o check antigo voltar.
begin;
set local lock_timeout = '5s';
update public.denuncias_anuncio set motivo = 'outro' where motivo = 'nota_nao_emitida';
alter table public.denuncias_anuncio drop constraint if exists denuncias_anuncio_motivo_check;
alter table public.denuncias_anuncio add constraint denuncias_anuncio_motivo_check
  check (motivo in ('fotos_falsas', 'imovel_nao_existe', 'pagamento_fora', 'conteudo_improprio', 'outro'));
alter table public.profiles drop constraint if exists profiles_emite_nota_locacao_so_pj;
alter table public.profiles drop column if exists emite_nota_locacao;
delete from supabase_migrations.schema_migrations where version = '20261105000294';
commit;
