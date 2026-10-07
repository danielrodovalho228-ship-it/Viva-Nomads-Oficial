-- Rollback da 0084. Itens 2 e 6 voltam ao estado da 0083. Item 4 (pg_net em extensions)
-- NÃO volta: recolocar em public reabre o aviso do advisor e não traz benefício.
begin;
-- 2) devolve EXECUTE a anon e as 27 políticas para todos os papéis (role public)
grant execute on function public.is_admin() to anon;
grant execute on function public.pode_ver_contrato(uuid) to anon, public;
grant execute on function public.pedido_ativo(uuid) to anon;
grant execute on function public.pedido_inquilino(uuid) to anon;
alter policy "admin lê auditoria de conta" on public.account_type_audit to public;
alter policy "admin vê eventos" on public.chamado_eventos to public;
alter policy "admin vê macros" on public.chamado_macros to public;
alter policy "dono vê mensagens públicas" on public.chamado_mensagens to public;
alter policy "dono vê os próprios chamados" on public.chamados to public;
alter policy "admin lê contratos" on public.contracts to public;
alter policy "partes veem os próprios documentos" on public.documentos_fiscais to public;
alter policy "admin altera gastos" on public.gastos_marketing to public;
alter policy "admin apaga gastos" on public.gastos_marketing to public;
alter policy "admin grava gastos" on public.gastos_marketing to public;
alter policy "admin lê gastos" on public.gastos_marketing to public;
alter policy "admin lê garantias" on public.guarantees to public;
alter policy "admin lê cotações de seguro" on public.insurance_quotes to public;
alter policy "admin lê leads" on public.leads to public;
alter policy "admin gerencia log" on public.moderacao_log to public;
alter policy "admin lê contas de pagamento" on public.payment_accounts to public;
alter policy "inquilino gerencia seus pedidos" on public.pedidos_moradia to public;
alter policy "admin lê perfis" on public.profiles to public;
alter policy "admin gerencia imóveis" on public.properties to public;
alter policy "admin lê fotos" on public.property_photos to public;
alter policy "admin gerencia checklists" on public.qualification_checklists to public;
alter policy "partes atualizam resposta" on public.respostas_pedido to public;
alter policy "proprietario cria resposta" on public.respostas_pedido to public;
alter policy "proprietario le suas respostas" on public.respostas_pedido to public;
alter policy "admin lê assinaturas" on public.subscriptions to public;
alter policy "admin lê verificações" on public.tenant_verifications to public;
alter policy "admin lê transações" on public.transactions to public;

-- 6) agentes como estavam em 07/10/2026
update public.agentes set cargo = 'SEO', rotina_texto = 'Quartas 03:37 Brasília', esquadrao = 'crescimento',
       briefing = 'SEO. Títulos, descrições, páginas de cidade, buscas e concorrentes.' where slug = 'rafael';
update public.agentes set cargo = 'TI e QA noturno',
       briefing = 'TI e QA noturno. Varre site, banco, avisos de segurança e erros da Vercel; manda achados para a fila de correções.' where slug = 'bruno';

delete from supabase_migrations.schema_migrations where version = '20261007000084';
commit;
