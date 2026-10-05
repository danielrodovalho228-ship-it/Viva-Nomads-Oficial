-- Antes da 0071: sem histórico de assinatura e sem livro de recebimentos.
reset role;
alter table public.contratos add column if not exists owner_plan text;
select v('ANTES@0071','sem histórico de assinaturas','select (to_regclass(''public.assinatura_eventos'') is null)::text','true');
-- Uma assinatura que já existia antes do histórico começar.
insert into public.subscriptions (id, owner_id, plan, status) values
 ('5ab00000-0000-0000-0000-000000000001','11111111-1111-1111-1111-111111111111','pro','active');
