-- Conta criada com Google ganha senha por "Esqueci minha senha": mesma conta,
-- mesmo perfil, sem duplicar. Espelha o que o Auth do Supabase faz no banco:
-- cadastro OAuth = INSERT em auth.users (+ identidade google); redefinir senha =
-- UPDATE da senha NO MESMO usuário. (E-mail único entre usuários: índice
-- users_email_partial_key do Auth, conferido em produção — a base de teste tem
-- e-mails repetidos de propósito, então não dá para criá-lo aqui.)
reset role;
alter table auth.users add column if not exists encrypted_password text;
alter table auth.users add column if not exists raw_app_meta_data jsonb default '{}'::jsonb;
create table if not exists auth.identities (id uuid primary key default gen_random_uuid(), user_id uuid references auth.users(id) on delete cascade, provider text, email text);

insert into auth.users (id, email, raw_user_meta_data, raw_app_meta_data)
values ('6e000000-0000-0000-0000-00000000000a', 'google@t.com', '{"full_name":"Gabi Google","role":"tenant"}', '{"provider":"google","providers":["google"]}');
insert into auth.identities (user_id, provider, email) values ('6e000000-0000-0000-0000-00000000000a', 'google', 'google@t.com');

select v('GOOGLE→SENHA','cadastro com Google cria UM perfil','select count(*)::text from profiles where id=''6e000000-0000-0000-0000-00000000000a''','1');
select v('GOOGLE→SENHA','…ainda sem senha','select (encrypted_password is null)::text from auth.users where id=''6e000000-0000-0000-0000-00000000000a''','true');

-- "Esqueci minha senha" → nova senha: o Auth só atualiza o usuário existente.
select t('GOOGLE→SENHA','definir a senha na conta do Google','passa',$q$update auth.users set encrypted_password = 'hash-da-nova-senha' where id='6e000000-0000-0000-0000-00000000000a'$q$);
select v('GOOGLE→SENHA','…continua UM perfil, com o mesmo id','select count(*)::text from profiles where id=''6e000000-0000-0000-0000-00000000000a''','1');
select v('GOOGLE→SENHA','…e nenhum perfil novo com esse e-mail','select count(*)::text from profiles where lower(email)=''google@t.com''','1');
select v('GOOGLE→SENHA','…a identidade Google segue ligada à mesma conta','select count(*)::text from auth.identities where user_id=''6e000000-0000-0000-0000-00000000000a'' and provider=''google''','1');
select v('GOOGLE→SENHA','nenhum gatilho de UPDATE em auth.users mexe em perfis','select count(*)::text from pg_trigger where tgrelid=''auth.users''::regclass and not tgisinternal and (tgtype & 16) <> 0','0');
