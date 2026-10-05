-- Antes da 0069: não há visão geral agregada. Alinha cobrancas_fechamento ao
-- que a 0058 já deixou em produção (status/pago_em).
reset role;
alter table public.cobrancas_fechamento add column if not exists status text;
alter table public.cobrancas_fechamento add column if not exists pago_em timestamptz;
-- Colunas que produção já tem (0001/0026/0057) e o estado mínimo do teste não.
alter table public.contratos add column if not exists comissao_valor numeric, add column if not exists lead_id uuid;
alter table public.service_orders add column if not exists priority text default 'media',
  add column if not exists first_response_at timestamptz, add column if not exists resolved_at timestamptz;
alter table public.qualification_checklists add column if not exists document_uploaded_at timestamptz;
select v('ANTES@0069','função de visão geral não existe','select (to_regprocedure(''public.admin_visao_geral(date,date,text)'') is null)::text','true');
-- Dados do período: 2 imóveis em cidades diferentes, candidaturas, pedido e eventos.
insert into public.properties (id, owner_id, title, city, status, monthly_price) values
 ('a6900000-0000-0000-0000-000000000001','11111111-1111-1111-1111-111111111111','VG A','Vilarejo Sessenta e Nove','draft',3000),
 ('a6900000-0000-0000-0000-000000000002','11111111-1111-1111-1111-111111111111','VG B','Outra Sessenta e Nove','draft',2000);
insert into public.leads (id, owner_id, tenant_id, property_id, status, created_at, accepted_at) values
 ('16900000-0000-0000-0000-000000000001','11111111-1111-1111-1111-111111111111','22222222-2222-2222-2222-222222222222','a6900000-0000-0000-0000-000000000001','accepted', now() - interval '3 days', now() - interval '2 days'),
 ('16900000-0000-0000-0000-000000000002','11111111-1111-1111-1111-111111111111','22222222-2222-2222-2222-222222222222','a6900000-0000-0000-0000-000000000002','new', now() - interval '5 days', null),
 ('16900000-0000-0000-0000-000000000003','11111111-1111-1111-1111-111111111111','33333333-3333-3333-3333-333333333333','a6900000-0000-0000-0000-000000000001','new', now() - interval '40 days', null);
set role service_role;
insert into public.eventos (tipo, cidade_chave) values ('busca','vilarejo sessenta e nove'), ('busca','vilarejo sessenta e nove'), ('busca','outra sessenta e nove'), ('ver_anuncio','vilarejo sessenta e nove');
reset role;
