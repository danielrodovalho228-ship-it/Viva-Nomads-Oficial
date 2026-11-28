-- Viva Nomads — rollback da 0371 (E1248): tira os dois índices, as seis regras, as 14 colunas da máquina da devolução e o
-- registo. Nunca roda sozinho. Com ALGUM dado gravado nas colunas novas, FALHA sem mudar nada (a regra aprovada no
-- E1240): apagá-lo calado perderia a hora do aviso, a contestação, a decisão da Central ou o caminho do comprovante.
-- A política e a RLS da tabela não são tocadas (a 0371 também não lhes tocou). O bucket da conferência e os arquivos
-- dele ficam.
begin;
set local lock_timeout = '5s';
do $$
declare
  com_dados int := 0;
begin
  if exists (select 1 from information_schema.columns where table_schema = 'public' and table_name = 'caucao_acertos' and column_name = 'aviso_em') then
    execute 'select count(*)::int from public.caucao_acertos where aviso_em is not null or lembrete_em is not null'
      || ' or confirmacao_via is not null or contestacao_motivo is not null or contestado_em is not null or chamado_id is not null'
      || ' or central_decisao is not null or central_decidido_em is not null or central_decidido_por is not null or central_motivo is not null'
      || ' or comprovante_path is not null or comprovante_pedido_em is not null or comprovante_anexado_em is not null or comprovante_lembrete_em is not null'
      into com_dados;
  end if;
  if com_dados > 0 then
    raise exception '0371 rollback: há % acerto(s) da caução com dados nas colunas da máquina da devolução; nada foi mudado.', com_dados;
  end if;
end $$;
drop index if exists public.caucao_acertos_espera_aviso_idx;
drop index if exists public.caucao_acertos_comprovante_pendente_idx;
alter table public.caucao_acertos
  drop constraint if exists caucao_acertos_confirmacao_via_chk,
  drop constraint if exists caucao_acertos_central_decisao_chk,
  drop constraint if exists caucao_acertos_decisao_e_hora_chk,
  drop constraint if exists caucao_acertos_nao_confirmada_motivo_chk,
  drop constraint if exists caucao_acertos_contestacao_motivo_chk,
  drop constraint if exists caucao_acertos_comprovante_path_chk;
alter table public.caucao_acertos
  drop column if exists aviso_em,
  drop column if exists lembrete_em,
  drop column if exists confirmacao_via,
  drop column if exists contestacao_motivo,
  drop column if exists contestado_em,
  drop column if exists chamado_id,
  drop column if exists central_decisao,
  drop column if exists central_decidido_em,
  drop column if exists central_decidido_por,
  drop column if exists central_motivo,
  drop column if exists comprovante_path,
  drop column if exists comprovante_pedido_em,
  drop column if exists comprovante_anexado_em,
  drop column if exists comprovante_lembrete_em;
delete from supabase_migrations.schema_migrations where version = '20261128000371';
commit;
