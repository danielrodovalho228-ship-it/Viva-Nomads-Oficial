-- Viva Nomads — aplicar 0086 (cartão da Luana). Sem NOTICE. Rollback: supabase/producao/rollback/0086_rollback.sql
begin;
update public.agentes
   set cargo = 'Marketing e SEO de conteúdo',
       rotina_texto = 'Segundas 07:47 Brasília · SEO de conteúdo na 1ª segunda do mês',
       briefing = 'Marketing e SEO de conteúdo. Toda segunda: calendário de posts, roteiros e custos. Na 1ª segunda do mês: posição no Google em "imóvel mobiliado Uberlândia" e afins, concorrentes (QuintoAndar, OLX, ZAP), melhorias de texto e pautas para o site. Nunca publica sem aprovação do Daniel.'
 where slug = 'luana';

insert into supabase_migrations.schema_migrations (version, name, statements, created_by)
select '20261007000086', '0086_agente_luana_seo',
       array['-- conteúdo em supabase/migrations/0086_agente_luana_seo.sql'], 'danielrodovalho228@gmail.com'
 where not exists (select 1 from supabase_migrations.schema_migrations where version = '20261007000086');
commit;

-- Conferência
select slug, cargo, rotina_texto from public.agentes where slug = 'luana';
