-- 0079 — o banco aceita o plano Gestor; os outros continuam; valor inventado não entra.
reset role;
select v('NOVO@0079','enum tem os 4 planos na ordem','select string_agg(enumlabel, '','' order by enumsortorder) from pg_enum where enumtypid=''public.plan_type''::regtype','free,essential,pro,gestor');
select t('NOVO@0079','servidor grava assinatura Gestor','passa',$q$insert into subscriptions (owner_id, plan, status) values ('11111111-1111-1111-1111-111111111111','gestor','active')$q$);
select t('NOVO@0079','Essencial continua aceito','passa',$q$insert into subscriptions (owner_id, plan, status) values ('11111111-1111-1111-1111-111111111111','essential','pending')$q$);
select t('ATAQUE@0079','plano inventado','falha',$q$insert into subscriptions (owner_id, plan, status) values ('11111111-1111-1111-1111-111111111111','vip','active')$q$);
set role authenticated; select set_config('request.jwt.claims','{"sub":"11111111-1111-1111-1111-111111111111"}',false);
select t('ATAQUE@0079','dono se dá o Gestor sozinho','falha',$q$insert into subscriptions (owner_id, plan, status) values ('11111111-1111-1111-1111-111111111111','gestor','active')$q$);
update subscriptions set plan='gestor' where plan='essential';  -- a RLS não deixa o dono mexer (0057)
reset role;
select v('ATAQUE@0079','dono troca a própria assinatura para Gestor: nada muda','select count(*)::text from subscriptions where plan=''gestor''','1');
delete from subscriptions where owner_id='11111111-1111-1111-1111-111111111111';
