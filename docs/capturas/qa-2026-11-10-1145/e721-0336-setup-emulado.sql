create role anon nologin; create role authenticated nologin; create role service_role nologin bypassrls;
create schema auth; grant usage on schema auth to authenticated, anon;
create function auth.uid() returns uuid language sql stable as $$ select nullif(current_setting('request.jwt.claim.sub', true),'')::uuid $$;
grant usage on schema public to authenticated, anon;
create table public.profiles(id uuid primary key);
create table public.messages(id uuid primary key default gen_random_uuid(), conversation_id uuid, sender_id uuid, receiver_id uuid);
grant select on public.messages to authenticated;
insert into public.profiles values ('11111111-1111-1111-1111-111111111111'),('22222222-2222-2222-2222-222222222222');
insert into public.messages(conversation_id,sender_id,receiver_id) values ('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa','11111111-1111-1111-1111-111111111111','22222222-2222-2222-2222-222222222222');
