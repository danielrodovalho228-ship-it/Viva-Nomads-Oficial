insert into auth.users (id, email, raw_user_meta_data) values
 ('11111111-1111-1111-1111-111111111111','dono@t.com','{"role":"owner","full_name":"Dono"}'),
 ('55555555-5555-5555-5555-555555555555','dono2@t.com','{"role":"owner","full_name":"Dono2"}'),
 ('22222222-2222-2222-2222-222222222222','inq@t.com','{"role":"tenant","full_name":"Inq"}'),
 ('33333333-3333-3333-3333-333333333333','estranho@t.com','{"role":"tenant","full_name":"Estranho"}'),
 ('44444444-4444-4444-4444-444444444444','admin@t.com','{"role":"tenant","full_name":"Admin"}');
update public.profiles set role='admin' where id='44444444-4444-4444-4444-444444444444';
insert into public.properties (id, owner_id, title, city, status, monthly_price, exact_address, responsavel_local_telefone, draft_data, sublease_doc_url) values
 ('aaaaaaa1-0000-0000-0000-000000000001','11111111-1111-1111-1111-111111111111','Ativo 1','Uberlândia','active',3000,'Rua Secreta 123','34999990000','{"street":"Rua Secreta 123"}','doc/sub.pdf'),
 ('aaaaaaa2-0000-0000-0000-000000000002','11111111-1111-1111-1111-111111111111','Rascunho 2','Uberlândia','draft',0,null,null,'{"street":"Rua Rascunho 9"}',null),
 ('aaaaaaa3-0000-0000-0000-000000000003','55555555-5555-5555-5555-555555555555','Ativo Q','Uberlândia','active',2500,'Rua Q 1',null,null,null),
 ('aaaaaaa4-0000-0000-0000-000000000004','11111111-1111-1111-1111-111111111111','Rascunho 4','Uberlândia','draft',0,null,null,'{"street":"Rua Quatro 4"}',null);
insert into public.pedidos_moradia (id, inquilino_id, cidade) values ('bbbbbbb1-0000-0000-0000-000000000001','22222222-2222-2222-2222-222222222222','Uberlândia');
