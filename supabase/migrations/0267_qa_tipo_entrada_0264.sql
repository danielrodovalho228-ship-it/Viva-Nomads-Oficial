-- 0267 — L-79 (Pista C, 30/10): os dois rascunhos de QA da 0264 ("[TESTE QA] Publicável 0264 A" e "… B", do
-- proprietario1, is_teste) ganham no rascunho a resposta do Passo 6 (draft_data.tipoEntrada = 'porteiro'), que o
-- assistente lê (formDeRascunho). A 0264 só gravava a coluna tipo_entrada e privacidade.tipoAcesso, e o Passo 10
-- acusava "Tipo de entrada". O arquivo da 0264 também passou a gravar o campo (bases novas e laboratório).
-- Só os dois ids fixos, só rascunho, só dono de teste, só se o campo ainda faltar. Idempotente.
-- Desfazer: supabase/producao/rollback/0267_rollback.sql.
update public.properties p
   set draft_data = coalesce(p.draft_data, '{}'::jsonb) || jsonb_build_object('tipoEntrada', 'porteiro')
 where p.id in ('a0264a00-0000-4000-8000-000000000001', 'a0264b00-0000-4000-8000-000000000001')
   and p.status::text = 'draft'
   and not coalesce(p.draft_data ? 'tipoEntrada', false)
   and exists (select 1 from public.profiles d where d.id = p.owner_id and d.is_teste);
