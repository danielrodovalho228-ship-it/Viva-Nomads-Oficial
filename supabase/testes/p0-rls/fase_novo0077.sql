-- 0077 — mural de pedidos sem SECURITY DEFINER na view; mesmo resultado para o site.
reset role;
insert into public.pedidos_moradia (id, inquilino_id, cidade, uf, data_inicio, prazo_meses, orcamento_mensal, qtd_ocupantes, motivo, status, expira_em) values
 ('bbbbbb77-0000-0000-0000-000000000001','22222222-2222-2222-2222-222222222222','Uberlândia','MG', current_date + 20, 3, 2500, 1, 'outro','ativo', now() + interval '30 days'),
 ('bbbbbb77-0000-0000-0000-000000000002','22222222-2222-2222-2222-222222222222','Uberlândia','MG', current_date + 20, 3, 2500, 1, 'outro','ativo', now() - interval '1 day');
select v('NOVO@0077','a view é security_invoker','select (coalesce(reloptions, ''{}'') @> array[''security_invoker=on''])::text from pg_class where oid=''public.pedidos_publicos''::regclass','true');
set role anon; select set_config('request.jwt.claims','{}',false);
select v('NOVO@0077','anônimo vê o pedido ativo no mural','select count(*)::text from pedidos_publicos where id=''bbbbbb77-0000-0000-0000-000000000001''','1');
select v('NOVO@0077','…e não vê o expirado','select count(*)::text from pedidos_publicos where id=''bbbbbb77-0000-0000-0000-000000000002''','0');
select t('ATAQUE@0077','anônimo lê a tabela pedidos_moradia direto','passa',$q$select count(*) from pedidos_moradia$q$);
select v('ATAQUE@0077','…e não vê pedido de ninguém','select count(*)::text from pedidos_moradia where id::text like ''bbbbbb77%''','0');
select t('ATAQUE@0077','anônimo escreve na view','falha',$q$update pedidos_publicos set cidade='x'$q$);
reset role;
set role authenticated; select set_config('request.jwt.claims','{"sub":"11111111-1111-1111-1111-111111111111"}',false);
select v('NOVO@0077','proprietário logado vê o mural','select count(*)::text from pedidos_publicos where id=''bbbbbb77-0000-0000-0000-000000000001''','1');
reset role;
select v('NOVO@0077','sem coluna de identidade do inquilino','select count(*)::text from information_schema.columns where table_schema=''public'' and table_name=''pedidos_publicos'' and column_name in (''inquilino_id'',''full_name'',''email'',''phone'')','0');
delete from pedidos_moradia where id::text like 'bbbbbb77%';
