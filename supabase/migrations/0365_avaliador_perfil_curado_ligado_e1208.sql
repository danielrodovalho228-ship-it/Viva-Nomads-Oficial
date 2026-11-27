-- 0365 — E1208 (ORDENS-DUET 986 e 989): a linha curada do perfil público do avaliador (avaliadores_perfil_publico,
--   0349) liga-se ao credenciamento do MESMO número.
--   A 0349 criou a linha do Rogério sem credenciamento_id ("até lá fica vazio"), e nada a ligou depois. Quando o número
--   dele passou a existir também em avaliadores_credenciamento, a página pública abriu o ramo do credenciado e a linha
--   curada deixou de entrar (nome, selo e cidade da linha só chegam pela ligação).
--   Só preenche credenciamento_id onde está vazio e o número é o mesmo; nunca liga o mesmo credenciamento a duas linhas
--   (a coluna é unique); não muda nome, cidade, selo nem publicação; não cria nem apaga linhas.
-- Rollback: supabase/producao/rollback/0365_rollback.sql
update public.avaliadores_perfil_publico p
   set credenciamento_id = c.id
  from public.avaliadores_credenciamento c
 where p.credenciamento_id is null
   and c.numero_credenciado = p.numero
   and not exists (select 1 from public.avaliadores_perfil_publico o where o.credenciamento_id = c.id);
