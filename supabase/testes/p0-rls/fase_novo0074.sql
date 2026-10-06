-- 0074 — documentos fiscais: retrato na emissão, partes só veem os seus, conferência
-- pública sem CPF, numeração sem buraco, exclusão de conta não trava nem apaga.
reset role;
set role service_role; select set_config('request.jwt.claims','{"role":"service_role"}',false);
select v('NOVO@0074','numeração: 1º recibo do ano','select public.proximo_numero_documento(''recibo_aluguel'') = ''REC-'' || extract(year from now() at time zone ''America/Sao_Paulo'')::int || ''-000001''','true');
select v('NOVO@0074','…o 2º segue sem buraco','select right(public.proximo_numero_documento(''recibo_aluguel''), 6)','000002');
select t('ATAQUE@0074','tipo fora da lista não vira INF','falha',$q$select public.proximo_numero_documento('nota_fiscal')$q$);
select t('NOVO@0074','servidor emite recibo do contrato X (com retrato)','passa',$q$insert into documentos_fiscais(id,tipo,numero,ano,contrato_id,pagamento_id,owner_id,tenant_id,locador_nome,locador_doc,locatario_nome,locatario_doc,imovel_endereco,contrato_ref,periodo_inicio,periodo_fim,valor,hash,pdf_path) values ('f7400000-0000-0000-0000-000000000001','recibo_aluguel','REC-T-1',2026,'d7400000-0000-0000-0000-000000000001','a7400000-0000-0000-0000-000000000001','11111111-1111-1111-1111-111111111111','22222222-2222-2222-2222-222222222222','Dono Um','123.456.789-00','Inq Dois','987.654.321-00','Rua Secreta 123, Uberlândia','d7400000','2026-10-01','2026-10-31',3000,repeat('a',64),'x/rec1.pdf')$q$);
select t('NOVO@0074','servidor emite recibo do contrato Y','passa',$q$insert into documentos_fiscais(id,tipo,numero,ano,contrato_id,pagamento_id,owner_id,tenant_id,locador_nome,locatario_nome,locatario_doc,imovel_endereco,valor,hash,pdf_path) values ('f7400000-0000-0000-0000-000000000002','recibo_aluguel','REC-T-2',2026,'d7400000-0000-0000-0000-000000000002','a7400000-0000-0000-0000-000000000002','77777775-0000-0000-0000-000000000000','77777774-0000-0000-0000-000000000000','Dono Setenta Cinco','Inquilina Setenta Quatro','111.222.333-44','Rua Y 1, Uberlândia',2400,repeat('b',64),'x/rec2.pdf')$q$);
select t('NOVO@0074','servidor emite termo de devolução da caução (Y)','passa',$q$insert into documentos_fiscais(id,tipo,numero,ano,contrato_id,acerto_id,owner_id,tenant_id,locador_nome,locatario_nome,imovel_endereco,valor,hash,pdf_path) values ('f7400000-0000-0000-0000-000000000003','termo_devolucao_caucao','DEV-T-1',2026,'d7400000-0000-0000-0000-000000000002','e7400000-0000-0000-0000-000000000001','77777775-0000-0000-0000-000000000000','77777774-0000-0000-0000-000000000000','Dono Setenta Cinco','Inquilina Setenta Quatro','Rua Y 1, Uberlândia',2400,repeat('c',64),'x/dev1.pdf')$q$);
select t('NOVO@0074','informe anual sem contrato (inquilino 2222)','passa',$q$insert into documentos_fiscais(tipo,numero,ano,tenant_id,locatario_nome,valor,hash,pdf_path) values ('informe_anual','INF-T-1',2026,'22222222-2222-2222-2222-222222222222','Inq Dois',36000,repeat('d',64),'x/inf1.pdf')$q$);
select t('ATAQUE@0074','2º informe do mesmo inquilino no mesmo ano','falha',$q$insert into documentos_fiscais(tipo,numero,ano,tenant_id,locatario_nome,valor,hash,pdf_path) values ('informe_anual','INF-T-2',2026,'22222222-2222-2222-2222-222222222222','Inq Dois',1,repeat('d',64),'x/inf2.pdf')$q$);
select t('ATAQUE@0074','recibo sem contrato','falha',$q$insert into documentos_fiscais(tipo,numero,ano,pagamento_id,owner_id,tenant_id,locador_nome,locatario_nome,imovel_endereco,valor,hash,pdf_path) values ('recibo_aluguel','REC-T-9',2026,'a7400000-0000-0000-0000-000000000003','11111111-1111-1111-1111-111111111111','22222222-2222-2222-2222-222222222222','A','B','C',1,repeat('e',64),'x')$q$);
select t('ATAQUE@0074','recibo sem pagamento','falha',$q$insert into documentos_fiscais(tipo,numero,ano,contrato_id,owner_id,tenant_id,locador_nome,locatario_nome,imovel_endereco,valor,hash,pdf_path) values ('recibo_aluguel','REC-T-9',2026,'d7400000-0000-0000-0000-000000000001','11111111-1111-1111-1111-111111111111','22222222-2222-2222-2222-222222222222','A','B','C',1,repeat('e',64),'x')$q$);
select t('ATAQUE@0074','recibo sem retrato do locador','falha',$q$insert into documentos_fiscais(tipo,numero,ano,contrato_id,pagamento_id,owner_id,tenant_id,locatario_nome,imovel_endereco,valor,hash,pdf_path) values ('recibo_aluguel','REC-T-9',2026,'d7400000-0000-0000-0000-000000000001','a7400000-0000-0000-0000-000000000003','11111111-1111-1111-1111-111111111111','22222222-2222-2222-2222-222222222222','B','C',1,repeat('e',64),'x')$q$);
select t('ATAQUE@0074','2º recibo do mesmo pagamento','falha',$q$insert into documentos_fiscais(tipo,numero,ano,contrato_id,pagamento_id,owner_id,tenant_id,locador_nome,locatario_nome,imovel_endereco,valor,hash,pdf_path) values ('recibo_aluguel','REC-T-9',2026,'d7400000-0000-0000-0000-000000000001','a7400000-0000-0000-0000-000000000001','11111111-1111-1111-1111-111111111111','22222222-2222-2222-2222-222222222222','A','B','C',1,repeat('e',64),'x')$q$);
select t('ATAQUE@0074','código de verificação vindo do app (curto)','falha',$q$insert into documentos_fiscais(tipo,numero,ano,contrato_id,pagamento_id,owner_id,tenant_id,locador_nome,locatario_nome,imovel_endereco,valor,hash,pdf_path,codigo_verificacao) values ('recibo_aluguel','REC-T-9',2026,'d7400000-0000-0000-0000-000000000001','a7400000-0000-0000-0000-000000000003','11111111-1111-1111-1111-111111111111','22222222-2222-2222-2222-222222222222','A','B','C',1,repeat('e',64),'x','0001')$q$);
select t('ATAQUE@0074','documento emitido não muda de valor','falha',$q$update documentos_fiscais set valor = 1 where id = 'f7400000-0000-0000-0000-000000000001'$q$);
select t('NOVO@0074','…mas registra o envio','passa',$q$update documentos_fiscais set enviado_em = now() where id = 'f7400000-0000-0000-0000-000000000001'$q$);
reset role;
select v('NOVO@0074','código: 32 hex aleatórios, todos diferentes','select (count(*) = count(distinct codigo_verificacao) and bool_and(codigo_verificacao ~ ''^[0-9a-f]{32}$''))::text from documentos_fiscais','true');

-- Partes só veem os seus.
set role authenticated; select set_config('request.jwt.claims','{"sub":"22222222-2222-2222-2222-222222222222"}',false);
select v('NOVO@0074','inquilino de X vê o recibo e o informe dele','select count(*)::text from documentos_fiscais','2');
select v('ATAQUE@0074','inquilino de X não lê documento do contrato Y','select count(*)::text from documentos_fiscais where contrato_id = ''d7400000-0000-0000-0000-000000000002''','0');
select t('ATAQUE@0074','inquilino grava documento pela API','falha',$q$insert into documentos_fiscais(tipo,numero,ano,tenant_id,locatario_nome,valor,hash,pdf_path) values ('informe_anual','INF-X',2025,'22222222-2222-2222-2222-222222222222','x',1,repeat('d',64),'x')$q$);
select t('ATAQUE@0074','inquilino apaga documento','falha',$q$delete from documentos_fiscais$q$);
select t('ATAQUE@0074','inquilino gera número','falha',$q$select public.proximo_numero_documento('recibo_aluguel')$q$);
select t('ATAQUE@0074','dono grava email_contador direto pela API','falha',$q$update profiles set email_contador = 'contador@x.com' where id = '22222222-2222-2222-2222-222222222222'$q$);
reset role;
set role authenticated; select set_config('request.jwt.claims','{"sub":"11111111-1111-1111-1111-111111111111"}',false);
select v('NOVO@0074','dono de X vê só o recibo de X','select string_agg(numero, '','') from documentos_fiscais','REC-T-1');
reset role;
set role authenticated; select set_config('request.jwt.claims','{"sub":"33333333-3333-3333-3333-333333333333"}',false);
select v('ATAQUE@0074','estranho não vê nada','select count(*)::text from documentos_fiscais','0');
reset role;
set role authenticated; select set_config('request.jwt.claims','{"sub":"44444444-4444-4444-4444-444444444444"}',false);
select v('NOVO@0074','admin vê todos','select count(*)::text from documentos_fiscais','4');
reset role;

-- Anônimo: não lê a tabela; a conferência pública não devolve CPF nem nome inteiro.
set role anon; select set_config('request.jwt.claims','{}',false);
select t('ATAQUE@0074','anônimo lê documentos_fiscais','falha',$q$select count(*) from documentos_fiscais$q$);
select t('ATAQUE@0074','anônimo gera número','falha',$q$select public.proximo_numero_documento('recibo_aluguel')$q$);
select t('ATAQUE@0074','anônimo lê o contador','falha',$q$select count(*) from documentos_fiscais_contador$q$);
reset role;
select set_config('teste.codigo_x', (select codigo_verificacao from documentos_fiscais where id='f7400000-0000-0000-0000-000000000001'), false);
set role anon; select set_config('request.jwt.claims','{}',false);
select v('NOVO@0074','conferência pública acha pelo código','select numero || '' '' || locador || '' / '' || locatario from public.conferir_documento(current_setting(''teste.codigo_x''))','REC-T-1 D. U. / I. D.');
select v('ATAQUE@0074','…e não devolve CPF, e-mail nem endereço','select (to_jsonb(c)::text !~ ''[0-9]{3}\.[0-9]{3}\.[0-9]{3}-[0-9]{2}|@|Rua'')::text from public.conferir_documento(current_setting(''teste.codigo_x'')) c','true');
select v('ATAQUE@0074','código errado/curto não acha nada','select count(*)::text from public.conferir_documento(''0001'')','0');
reset role;

-- Conta com histórico de contrato é ANONIMIZADA (caminho real dos dois "Excluir conta"):
-- o documento guarda o retrato da emissão, não o perfil atual.
select t('NOVO@0074','anonimizar a inquilina de Y (com recibo) não falha','passa',$q$select public.anonimizar_conta('77777774-0000-0000-0000-000000000000')$q$);
update public.profiles set full_name = 'Nome Novo', cpf = null where id = '77777774-0000-0000-0000-000000000000';
select v('NOVO@0074','…o recibo mantém o nome e o CPF da emissão','select locatario_nome || '' · '' || locatario_doc from documentos_fiscais where id = ''f7400000-0000-0000-0000-000000000002''','Inquilina Setenta Quatro · 111.222.333-44');
-- Exclusão de fato (ex.: pelo admin): a cascata apaga contrato/pagamento/acerto; o documento fica e nada trava.
select t('NOVO@0074','excluir a conta da inquilina de Y (contrato em cascata) não falha','passa',$q$delete from auth.users where id = '77777774-0000-0000-0000-000000000000'$q$);
select t('NOVO@0074','excluir a conta do dono de Y (imóvel em cascata) não falha','passa',$q$delete from auth.users where id = '77777775-0000-0000-0000-000000000000'$q$);
select v('NOVO@0074','os 2 documentos de Y continuam guardados, sem ligações','select count(*)::text from documentos_fiscais where id in (''f7400000-0000-0000-0000-000000000002'',''f7400000-0000-0000-0000-000000000003'') and contrato_id is null and owner_id is null and tenant_id is null and pagamento_id is null and acerto_id is null','2');
select v('NOVO@0074','…com o retrato da emissão intacto','select locatario_nome || '' · '' || locatario_doc from documentos_fiscais where id = ''f7400000-0000-0000-0000-000000000002''','Inquilina Setenta Quatro · 111.222.333-44');
select set_config('teste.codigo_y', (select codigo_verificacao from documentos_fiscais where id='f7400000-0000-0000-0000-000000000002'), false);
set role anon; select set_config('request.jwt.claims','{}',false);
select v('NOVO@0074','…e a conferência pública continua funcionando','select locatario from public.conferir_documento(current_setting(''teste.codigo_y''))','I. S. Q.');
reset role;

-- Bucket, encargos, NFS-e, TRUNCATE.
select v('NOVO@0074','bucket "documentos" é privado','select (not public)::text from storage.buckets where id=''documentos''','true');
select v('NOVO@0074','nenhuma política em storage.objects menciona o bucket','select count(*)::text from pg_policies where schemaname=''storage'' and tablename=''objects'' and (coalesce(qual,'''') || coalesce(with_check,'''')) ilike ''%documentos%''','0');
select v('NOVO@0074','encargos do pagamento: lista vazia por padrão','select encargos::text from pagamentos_bloco where id=''a7400000-0000-0000-0000-000000000003''','[]');
select v('NOVO@0074','invoices ganha o número da NFS-e (se a tabela existe)','select (to_regclass(''public.invoices'') is null or exists (select 1 from information_schema.columns where table_name=''invoices'' and column_name=''numero''))::text','true');
select v('NOVO@0074','anon/authenticated sem TRUNCATE em nenhuma tabela','select count(*)::text from information_schema.table_privileges where table_schema=''public'' and privilege_type=''TRUNCATE'' and grantee in (''anon'',''authenticated'')','0');
delete from public.documentos_fiscais where numero like '%-T-%';
delete from public.pagamentos_bloco where contrato_id = 'd7400000-0000-0000-0000-000000000001';
delete from public.contrato_blocos where contrato_id = 'd7400000-0000-0000-0000-000000000001';
delete from public.contratos where id = 'd7400000-0000-0000-0000-000000000001';
-- registrado_por: excluir quem registrou um acerto não trava; o acerto fica sem o autor.
reset role;
insert into auth.users (id, email, raw_user_meta_data) values ('77777776-0000-0000-0000-000000000000','dono76@t.com','{"role":"owner","full_name":"Dono 76"}');
insert into public.caucao_acertos (id, contrato_id, tipo, caucao_total, valor_devolvido, status, registrado_por) values
 ('e7400000-0000-0000-0000-000000000009','dddddddd-0000-0000-0000-000000000001','devolucao_integral',3000,3000,'devolvida_integral','77777776-0000-0000-0000-000000000000');
select t('NOVO@0074','excluir quem registrou um acerto de caução não falha','passa',$q$delete from auth.users where id = '77777776-0000-0000-0000-000000000000'$q$);
select v('NOVO@0074','…o acerto fica, sem o autor','select (registrado_por is null)::text from caucao_acertos where id = ''e7400000-0000-0000-0000-000000000009''','true');
delete from public.caucao_acertos where id = 'e7400000-0000-0000-0000-000000000009';
