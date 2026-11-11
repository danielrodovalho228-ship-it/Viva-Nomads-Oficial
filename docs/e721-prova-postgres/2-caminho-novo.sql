\set ON_ERROR_STOP 1
set role authenticated; set request.jwt.claim.sub = '11111111-1111-4111-8111-111111111111';
\echo '== 1. adiar (update não acha linha -> insert)'
update public.conversas_adiadas set adiada_em = now(), ate = now() + interval '1 day'
 where user_id = '11111111-1111-4111-8111-111111111111' and conversation_id = 'cccccccc-cccc-4ccc-8ccc-cccccccccccc' returning 'update' as via;
insert into public.conversas_adiadas (user_id, conversation_id, adiada_em, ate)
values ('11111111-1111-4111-8111-111111111111', 'cccccccc-cccc-4ccc-8ccc-cccccccccccc', now(), now() + interval '1 day') returning 'insert' as via, ate::date;
\echo '== 2. adiar de novo (update acha a linha)'
update public.conversas_adiadas set adiada_em = now(), ate = now() + interval '7 days'
 where user_id = '11111111-1111-4111-8111-111111111111' and conversation_id = 'cccccccc-cccc-4ccc-8ccc-cccccccccccc' returning 'update' as via, ate::date;
\echo '== 3. retomar'
delete from public.conversas_adiadas where user_id = '11111111-1111-4111-8111-111111111111' and conversation_id = 'cccccccc-cccc-4ccc-8ccc-cccccccccccc' returning 'delete' as via;
\echo '== 4. retomar de novo (nada a apagar, sem erro)'
delete from public.conversas_adiadas where user_id = '11111111-1111-4111-8111-111111111111' and conversation_id = 'cccccccc-cccc-4ccc-8ccc-cccccccccccc' returning 'delete' as via;
\echo '== 5. o outro lado adia a própria visão (independente)'
set request.jwt.claim.sub = '22222222-2222-4222-8222-222222222222';
insert into public.conversas_adiadas (user_id, conversation_id, adiada_em, ate)
values ('22222222-2222-4222-8222-222222222222', 'cccccccc-cccc-4ccc-8ccc-cccccccccccc', now(), now() + interval '3 days') returning 'insert-outro-lado' as via;
select count(*) as linhas_visiveis_para_o_lado_2 from public.conversas_adiadas;
set request.jwt.claim.sub = '11111111-1111-4111-8111-111111111111';
select count(*) as linhas_visiveis_para_o_lado_1 from public.conversas_adiadas;
\set ON_ERROR_STOP 0
\echo '== 6. recusas da RLS'
insert into public.conversas_adiadas (user_id, conversation_id, adiada_em, ate) values ('11111111-1111-4111-8111-111111111111', 'dddddddd-dddd-4ddd-8ddd-dddddddddddd', now(), now() + interval '1 day');
update public.conversas_adiadas set user_id = '11111111-1111-4111-8111-111111111111' where user_id = '22222222-2222-4222-8222-222222222222';
