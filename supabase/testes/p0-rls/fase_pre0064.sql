-- Antes da 0064: estado de produção para a compatibilidade (colunas reais do
-- pedido, contratos/blocos, bloqueios, chave_cidade) e o envio "para todos".
reset role;
create or replace function public.chave_cidade(t text) returns text language sql immutable set search_path = public as $$
  select btrim(regexp_replace(lower(translate(coalesce(t, ''),
    'áàâãäéèêëíìîïóòôõöúùûüçñÁÀÂÃÄÉÈÊËÍÌÎÏÓÒÔÕÖÚÙÛÜÇÑ',
    'aaaaaeeeeiiiiooooouuuucnaaaaaeeeeiiiiooooouuuucn')), '\s+', ' ', 'g'));
$$;
alter table public.pedidos_moradia
  add column if not exists uf text, add column if not exists data_inicio date,
  add column if not exists prazo_meses int, add column if not exists orcamento_mensal numeric(12,2),
  add column if not exists qtd_ocupantes int, add column if not exists motivo text,
  add column if not exists apresentacao text, add column if not exists expira_em timestamptz,
  add column if not exists removido_motivo text;
alter table public.contrato_blocos
  add column if not exists inicio date, add column if not exists fim date;
alter table public.respostas_pedido add column if not exists criado_em timestamptz not null default now();
create table if not exists public.property_blocks (
  id uuid primary key default gen_random_uuid(), property_id uuid references public.properties(id) on delete cascade,
  inicio date, fim date, created_at timestamptz default now()
);
create or replace view public.pedidos_publicos as
 select p.id, p.cidade, p.uf, p.data_inicio, p.prazo_meses, p.orcamento_mensal, p.qtd_ocupantes, p.motivo,
        p.apresentacao, p.status, p.criado_em, p.expira_em,
        coalesce(pf.verification_progress, 0) >= 100 as inquilino_verificado
   from public.pedidos_moradia p join public.profiles pf on pf.id = p.inquilino_id
  where p.status = 'ativo' and p.expira_em > now();

-- Cenário do teste real (datas relativas a hoje: entrada = hoje + 28).
update public.properties set status = 'draft' where status = 'active';
insert into public.properties (id, owner_id, title, city, state, status, monthly_price, condo_fee, utilities_mode, utilities_estimate,
  max_guests, min_period_days, max_period_days, available_from, pets_allowed, children_allowed, faixas_aceitas, tag_home_office, ready_to_live_badge) values
 ('a6400000-0000-0000-0000-00000000000a','11111111-1111-1111-1111-111111111111','A — Apto 2 quartos','Uberlândia','MG','active',2900,0,'fixed',200, 3,30,180, current_date + 11, false, true, '{temporada,media_estadia}', true, true),
 ('a6400000-0000-0000-0000-00000000000b','55555555-5555-5555-5555-555555555555','B — Casa grande','Uberlândia','MG','active',4800,0,'fixed',0,   5,30,180, current_date, true, true, '{}', false, false),
 ('a6400000-0000-0000-0000-00000000000c','55555555-5555-5555-5555-555555555555','C — sem capacidade','Uberlândia','MG','active',2500,0,'fixed',0, null,30,180, null, true, true, '{}', false, false),
 ('a6400000-0000-0000-0000-00000000000d','55555555-5555-5555-5555-555555555555','D — condomínio e consumo','Uberlândia','MG','active',2700,300,'fixed',400, 2,30,180, null, true, true, '{}', false, false),
 ('a6400000-0000-0000-0000-00000000000e','55555555-5555-5555-5555-555555555555','E — livre depois','Uberlândia','MG','active',2800,0,'fixed',0, 2,30,180, current_date + 38, true, true, '{}', false, false),
 ('a6400000-0000-0000-0000-00000000000f','55555555-5555-5555-5555-555555555555','F — com contrato','Uberlândia','MG','active',2800,0,'fixed',0, 2,30,180, null, true, true, '{}', false, false),
 ('a6400000-0000-0000-0000-000000000010','55555555-5555-5555-5555-555555555555','G — aceita pet','Uberlândia','MG','active',2800,0,'real',999, 2,30,180, null, true, true, '{}', false, false),
 ('a6400000-0000-0000-0000-000000000011','55555555-5555-5555-5555-555555555555','H — outra cidade','Araguari','MG','active',2800,0,'fixed',0, 2,30,180, null, true, true, '{}', false, false),
 ('a6400000-0000-0000-0000-000000000012','55555555-5555-5555-5555-555555555555','I — sem documento','Uberlândia','MG','active',2800,0,'fixed',0, 2,30,180, null, true, true, '{}', false, false);
insert into public.qualification_checklists (owner_id, property_id, document_status)
select owner_id, id, 'approved' from public.properties where id::text like 'a6400000%' and id <> 'a6400000-0000-0000-0000-000000000012';
insert into public.contratos (id, property_id, tenant_id, status, aluguel_mensal) values
 ('dddddd64-0000-0000-0000-000000000001','a6400000-0000-0000-0000-00000000000f','33333333-3333-3333-3333-333333333333','ativo',2800);
insert into public.contrato_blocos (contrato_id, numero_bloco, inicio, fim, valor, caucao, status) values
 ('dddddd64-0000-0000-0000-000000000001',1, current_date, current_date + 59, 5600, 2800, 'ativo');
insert into public.pedidos_moradia (id, inquilino_id, cidade, uf, data_inicio, prazo_meses, orcamento_mensal, qtd_ocupantes, motivo, status, expira_em) values
 ('bbbbbb64-0000-0000-0000-000000000001','22222222-2222-2222-2222-222222222222','Uberlandia','MG', current_date + 28, 4, 3000, 2, 'trabalho_remoto','ativo', now() + interval '30 days');

set role service_role;
select v('ANTES@0064','"para todos": os 2 donos da cidade recebem o e-mail (inclusive o do imóvel B, R$ 4.800)','select count(*)::text from pedido_owner_recipients(''Uberlândia'')','2');
reset role;
