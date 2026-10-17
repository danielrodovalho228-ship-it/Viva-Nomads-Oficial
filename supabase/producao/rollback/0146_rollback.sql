-- Rollback da 0146: volta a SELECT de messages para a forma da 0145. ATENÇÃO: isso reintroduz o erro de recursão
-- no INSERT de messages enquanto a política "enviar mensagem" consultar a própria tabela.
begin;
alter policy "mensagens das partes" on public.messages
  using (sender_id = (select auth.uid()) or receiver_id = (select auth.uid()));
delete from supabase_migrations.schema_migrations where version = '20261017000146';
commit;
