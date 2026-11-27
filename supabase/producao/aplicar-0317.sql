-- Viva Nomads — aplicar 0317 (E661: estrutura do condomínio nas instruções de chegada). Idempotente.
-- Aplicada pela Action quando o PR é mesclado. Rollback: supabase/producao/rollback/0317_rollback.sql.
begin;
set local lock_timeout = '5s';

alter table public.imovel_instrucoes_chegada
  add column if not exists condominio_wifi_rede text check (condominio_wifi_rede is null or char_length(condominio_wifi_rede) <= 100),
  add column if not exists condominio_wifi_senha text check (condominio_wifi_senha is null or char_length(condominio_wifi_senha) <= 100),
  add column if not exists condominio_recepcao text check (condominio_recepcao is null or char_length(condominio_recepcao) <= 500),
  add column if not exists condominio_fechadura text check (condominio_fechadura is null or char_length(condominio_fechadura) <= 500);

comment on column public.imovel_instrucoes_chegada.condominio_fechadura is
  'E661: fechadura/portão/eclusa do condomínio (código, biometria ou chave). Mesma regra das demais instruções: só o dono lê e grava; o morador recebe pelo servidor, liberada 7 dias antes da entrada.';

insert into supabase_migrations.schema_migrations (version, name, statements, created_by)
select '20261107000317', '0317_estrutura_condominio_e661', array['-- conteúdo em supabase/migrations/0317_estrutura_condominio_e661.sql'], 'danielrodovalho228@gmail.com'
where not exists (select 1 from supabase_migrations.schema_migrations where version = '20261107000317');

commit;
