-- 0064 — compatibilidade real.
reset role;
alter table public.pedidos_moradia alter column pets set default false;
insert into public.pedidos_moradia (id, inquilino_id, cidade, uf, data_inicio, prazo_meses, orcamento_mensal, qtd_ocupantes, motivo, status, expira_em, pets) values
 ('bbbbbb64-0000-0000-0000-000000000002','22222222-2222-2222-2222-222222222222','Uberlândia','MG', current_date + 28, 4, 3000, 2, 'outro','ativo', now() + interval '30 days', true);

set role service_role;
-- Teste real: A (R$ 2.900 + R$ 200 de consumo, 3 vagas, livre desde antes) é compatível.
select v('NOVO@0064','A é compatível ("Uberlandia" = "Uberlândia", total 3.100 ≤ 3.300)','select situacao from compatibilidade_pedidos(''bbbbbb64-0000-0000-0000-000000000001'') where imovel_id=''a6400000-0000-0000-0000-00000000000a''','compativel');
select v('NOVO@0064','A: nota alta (preço, folga, home office, selo, data)','select (nota >= 80)::text from compatibilidade_pedidos(''bbbbbb64-0000-0000-0000-000000000001'') where imovel_id=''a6400000-0000-0000-0000-00000000000a''','true');
select v('NOVO@0064','B (R$ 4.800) NÃO é compatível — vai para "Demais"','select situacao from compatibilidade_pedidos(''bbbbbb64-0000-0000-0000-000000000001'') where imovel_id=''a6400000-0000-0000-0000-00000000000b''','demais');
select v('NOVO@0064','compatíveis = só A e G (B, C, D, E, F não geram e-mail)','select string_agg(titulo, '' | '' order by titulo) from compatibilidade_pedidos(''bbbbbb64-0000-0000-0000-000000000001'') where situacao=''compativel''','A — Apto 2 quartos | G — aceita pet');
-- Bordas.
select v('NOVO@0064','max_guests nulo = não compatível','select situacao from compatibilidade_pedidos(''bbbbbb64-0000-0000-0000-000000000001'') where imovel_id=''a6400000-0000-0000-0000-00000000000c''','demais');
select v('NOVO@0064','total com condomínio e consumo (3.400) = quase, com o motivo','select situacao || '' / '' || motivo from compatibilidade_pedidos(''bbbbbb64-0000-0000-0000-000000000001'') where imovel_id=''a6400000-0000-0000-0000-00000000000d''','quase / R$ 400 acima do orçamento');
select v('NOVO@0064','disponível só 10 dias depois da entrada = quase','select situacao || '' / '' || motivo from compatibilidade_pedidos(''bbbbbb64-0000-0000-0000-000000000001'') where imovel_id=''a6400000-0000-0000-0000-00000000000e''','quase / começa 10 dias depois');
select v('NOVO@0064','contrato ativo no período = não compatível','select situacao from compatibilidade_pedidos(''bbbbbb64-0000-0000-0000-000000000001'') where imovel_id=''a6400000-0000-0000-0000-00000000000f''','demais');
select v('NOVO@0064','consumo "real" não entra no total (G = 2.800)','select situacao || '' / '' || total_mensal::int from compatibilidade_pedidos(''bbbbbb64-0000-0000-0000-000000000001'') where imovel_id=''a6400000-0000-0000-0000-000000000010''','compativel / 2800');
select v('NOVO@0064','outra cidade não entra','select count(*)::text from compatibilidade_pedidos(''bbbbbb64-0000-0000-0000-000000000001'') where imovel_id=''a6400000-0000-0000-0000-000000000011''','0');
select v('NOVO@0064','documento não aprovado não entra','select count(*)::text from compatibilidade_pedidos(''bbbbbb64-0000-0000-0000-000000000001'') where imovel_id=''a6400000-0000-0000-0000-000000000012''','0');
select v('NOVO@0064','pedido com pet: A (não aceita pet) sai','select situacao from compatibilidade_pedidos(''bbbbbb64-0000-0000-0000-000000000002'') where imovel_id=''a6400000-0000-0000-0000-00000000000a''','demais');
select v('NOVO@0064','pedido com pet: G (aceita pet) segue compatível','select situacao from compatibilidade_pedidos(''bbbbbb64-0000-0000-0000-000000000002'') where imovel_id=''a6400000-0000-0000-0000-000000000010''','compativel');
select v('NOVO@0064','faixa: A aceita média duração (4 meses)','select situacao from compatibilidade_pedidos(''bbbbbb64-0000-0000-0000-000000000001'', ''a6400000-0000-0000-0000-00000000000a'')','compativel');
select v('NOVO@0064','visão por imóvel (anúncio publicado depois) acha o pedido','select count(*)::text from compatibilidade_pedidos(null, ''a6400000-0000-0000-0000-00000000000a'') where situacao=''compativel''','1');
select t('NOVO@0064','métricas do admin','passa',$q$select public.admin_metricas_pedidos(30)$q$);
reset role;
update public.properties set faixas_aceitas = '{temporada}' where id = 'a6400000-0000-0000-0000-00000000000a';
set role service_role;
select v('NOVO@0064','faixa: anúncio só de temporada não serve para 4 meses','select situacao from compatibilidade_pedidos(''bbbbbb64-0000-0000-0000-000000000001'', ''a6400000-0000-0000-0000-00000000000a'')','demais');
reset role;

-- Acesso: só o servidor.
set role authenticated; select set_config('request.jwt.claims','{"sub":"11111111-1111-1111-1111-111111111111"}',false);
select t('ATAQUE@0064','usuário chama a função de compatibilidade','falha',$q$select * from compatibilidade_pedidos()$q$);
select t('ATAQUE@0064','usuário lê os avisos','falha',$q$select * from pedido_avisos$q$);
select t('ATAQUE@0064','usuário grava aviso','falha',$q$insert into pedido_avisos(pedido_id,dono_id,canal) values ('bbbbbb64-0000-0000-0000-000000000001','11111111-1111-1111-1111-111111111111','email')$q$);
reset role; set role service_role;
select t('NOVO@0064','servidor grava aviso','passa',$q$insert into pedido_avisos(pedido_id,dono_id,imovel_id,nota,canal,enviado_em) values ('bbbbbb64-0000-0000-0000-000000000001','11111111-1111-1111-1111-111111111111','a6400000-0000-0000-0000-00000000000a',90,'email',now())$q$);
select t('ATAQUE@0064','segundo aviso do mesmo pedido ao mesmo dono','falha',$q$insert into pedido_avisos(pedido_id,dono_id,canal) values ('bbbbbb64-0000-0000-0000-000000000001','11111111-1111-1111-1111-111111111111','email')$q$);
reset role;
update public.properties set status = 'draft' where id::text like 'a6400000%';
