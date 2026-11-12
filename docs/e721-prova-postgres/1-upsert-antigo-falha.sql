-- Caminho do PR #3703 hoje: o upsert do supabase-js vira INSERT ... ON CONFLICT DO UPDATE SET com as 4 colunas.
set role authenticated; set request.jwt.claim.sub = '11111111-1111-4111-8111-111111111111';
insert into public.conversas_adiadas (user_id, conversation_id, adiada_em, ate)
values ('11111111-1111-4111-8111-111111111111', 'cccccccc-cccc-4ccc-8ccc-cccccccccccc', now(), now() + interval '1 day')
on conflict (user_id, conversation_id) do update set user_id = excluded.user_id, conversation_id = excluded.conversation_id, adiada_em = excluded.adiada_em, ate = excluded.ate;
