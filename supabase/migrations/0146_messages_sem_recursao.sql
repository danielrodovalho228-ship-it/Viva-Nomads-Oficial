-- 0146 — Corrige a 0145 em public.messages (P0: enviar mensagem falhava com "infinite recursion detected in policy for relation messages").
-- Causa: a política de INSERT "enviar mensagem" consulta a própria messages (caso "resposta na mesma conversa").
-- Com a SELECT "mensagens das partes" embrulhada em (select auth.uid()) pela 0145, o Postgres passa a ver recursão
-- de política. Volta a SELECT para auth.uid() direto (sem subconsulta): mesmo significado, sem recursão.
-- Idempotente (alter policy). Rollback: supabase/producao/rollback/0146_rollback.sql.
alter policy "mensagens das partes" on public.messages
  using (sender_id = auth.uid() or receiver_id = auth.uid());
