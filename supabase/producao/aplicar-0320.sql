-- Viva Nomads — aplicar 0320 (E662: instrução única de saída). Idempotente.
-- Aplicada pela Action quando o PR é mesclado. Rollback: supabase/producao/rollback/0320_rollback.sql.
begin;
set local lock_timeout = '5s';

alter table public.imovel_instrucoes_chegada
  add column if not exists instrucao_saida text check (instrucao_saida is null or char_length(instrucao_saida) <= 1500);

alter table public.contratos
  add column if not exists instrucao_saida text check (instrucao_saida is null or char_length(instrucao_saida) <= 1500);

comment on column public.imovel_instrucoes_chegada.instrucao_saida is
  'E662: instrução única de saída (check-out) escrita pelo dono. Privada; o morador a recebe pelo servidor, junto das instruções da estadia.';
comment on column public.contratos.instrucao_saida is
  'E662: cópia da instrução de saída na 1ª assinatura (congelada). Null = contrato anterior à coluna ou sem texto: vale a do imóvel.';

insert into supabase_migrations.schema_migrations (version, name, statements, created_by)
select '20261107000320', '0320_instrucao_saida_e662', array['-- conteúdo em supabase/migrations/0320_instrucao_saida_e662.sql'], 'danielrodovalho228@gmail.com'
where not exists (select 1 from supabase_migrations.schema_migrations where version = '20261107000320');

commit;
