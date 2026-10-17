-- Viva Nomads — aplicar 0139 (texto honesto dos serviços adicionais; Assistência 24h "em breve"). Idempotente.
-- Aplicada pela Action quando o PR é mesclado (o merge é a aprovação do Daniel).
-- Rollback: supabase/producao/rollback/0139_rollback.sql.
begin;
set local lock_timeout = '5s';

update public.servicos_adicionais
   set descricao = 'Chaveiro, encanador, elétrica e mais, com prestador parceiro independente. Você contrata e paga direto ao prestador; a Viva não recebe esse valor nem executa o serviço.',
       status = 'em_breve'
 where id = 'assistencia_24h';

update public.servicos_adicionais
   set descricao = 'Manutenção preventiva e corretiva do imóvel, com prestador parceiro independente. Você contrata e paga direto ao prestador; a Viva não recebe esse valor nem executa o serviço.'
 where id = 'plano_manutencao';

insert into supabase_migrations.schema_migrations (version, name, statements, created_by)
select '20261016000139', '0139_servicos_adicionais_texto',
       array['-- conteúdo em supabase/migrations/0139_servicos_adicionais_texto.sql'], 'danielrodovalho228@gmail.com'
 where not exists (select 1 from supabase_migrations.schema_migrations where version = '20261016000139');
commit;
