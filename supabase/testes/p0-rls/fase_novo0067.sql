-- 0067 — eventos anônimos + gastos de marketing.
set role anon; select set_config('request.jwt.claims','{}',false);
select t('ATAQUE@0067','anônimo grava evento direto','falha',$q$insert into eventos(tipo) values ('busca')$q$);
select t('ATAQUE@0067','anônimo lê eventos','falha',$q$select count(*) from eventos$q$);
select t('ATAQUE@0067','anônimo lê gastos','falha',$q$select count(*) from gastos_marketing$q$);
reset role;

set role authenticated; select set_config('request.jwt.claims','{"sub":"11111111-1111-1111-1111-111111111111"}',false);
select t('ATAQUE@0067','logado grava evento direto','falha',$q$insert into eventos(tipo) values ('busca')$q$);
select t('ATAQUE@0067','logado lê eventos','falha',$q$select count(*) from eventos$q$);
select t('ATAQUE@0067','não-admin grava gasto','falha',$q$insert into gastos_marketing(mes,canal,valor) values ('2026-09-01','google',100)$q$);
select v('ATAQUE@0067','não-admin não vê gastos','select count(*)::text from gastos_marketing','0');
select t('ATAQUE@0067','logado roda a limpeza','falha',$q$select limpar_eventos_antigos()$q$);
reset role;

set role service_role;
select t('NOVO@0067','servidor grava evento','passa',$q$insert into eventos(tipo,sessao,plataforma,origem_source) values ('ver_anuncio','abc','android','instagram')$q$);
select t('ATAQUE@0067','tipo fora da lista','falha',$q$insert into eventos(tipo) values ('apagar_tudo')$q$);
select t('ATAQUE@0067','plataforma fora da lista','falha',$q$insert into eventos(tipo,plataforma) values ('busca','windows')$q$);
select t('ATAQUE@0067','texto longo em campo curto (PII)','falha',$q$insert into eventos(tipo,origem_campaign) values ('busca',repeat('x',121))$q$);
select t('NOVO@0067','evento de 19 meses atrás','passa',$q$insert into eventos(tipo,criado_em) values ('busca',now() - interval '19 months')$q$);
select v('NOVO@0067','limpeza apaga só o que passou de 18 meses','select limpar_eventos_antigos()::text','1');
select v('NOVO@0067','…o recente fica','select count(*)::text from eventos','1');
reset role;

set role authenticated; select set_config('request.jwt.claims','{"sub":"44444444-4444-4444-4444-444444444444"}',false);
select t('NOVO@0067','admin lança gasto','passa',$q$insert into gastos_marketing(mes,canal,valor,observacao) values ('2026-09-01','instagram',350.50,'impulsionamento')$q$);
select v('NOVO@0067','…criado_por é o admin','select criado_por::text from gastos_marketing limit 1','44444444-4444-4444-4444-444444444444');
select t('ATAQUE@0067','gasto negativo','falha',$q$insert into gastos_marketing(mes,canal,valor) values ('2026-09-01','google',-1)$q$);
select t('ATAQUE@0067','mês fora do dia 1','falha',$q$insert into gastos_marketing(mes,canal,valor) values ('2026-09-15','google',10)$q$);
select t('ATAQUE@0067','canal fora da lista','falha',$q$insert into gastos_marketing(mes,canal,valor) values ('2026-09-01','tiktok',10)$q$);
select t('ATAQUE@0067','admin também não lê eventos direto (só por função)','falha',$q$select count(*) from eventos$q$);
select t('NOVO@0067','admin apaga gasto','passa',$q$delete from gastos_marketing where canal='instagram'$q$);
reset role;
