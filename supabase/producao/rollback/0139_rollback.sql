-- Rollback da 0139: volta o texto e o status anteriores (0014 + 0015). Só use se o Daniel mandar.
begin;
update public.servicos_adicionais
   set descricao = 'Chaveiro, encanador, elétrica e mais. A plataforma intermedeia e roteia o pagamento ao prestador; não executa o serviço.',
       status = 'ativo'
 where id = 'assistencia_24h';
update public.servicos_adicionais
   set descricao = 'Manutenção preventiva e corretiva do imóvel. A plataforma intermedeia e roteia o pagamento ao prestador; não executa o serviço.'
 where id = 'plano_manutencao';
delete from supabase_migrations.schema_migrations where version = '20261016000139';
commit;
