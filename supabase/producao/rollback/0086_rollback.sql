-- Rollback da 0086: cartão da Luana como estava em 07/10/2026.
begin;
update public.agentes set cargo = 'Marketing', rotina_texto = 'Segundas 07:47 Brasília',
       briefing = 'Marketing. Calendário de posts, roteiros e custos. Nunca publica sem aprovação do Daniel.'
 where slug = 'luana';
delete from supabase_migrations.schema_migrations where version = '20261007000086';
commit;
