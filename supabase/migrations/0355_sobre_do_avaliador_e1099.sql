-- E1099 parte 2 (ORDEM-DUET-458 §2 / 460 §1): o "Sobre" do perfil público do avaliador credenciado. Campo de texto livre,
-- OPCIONAL, escrito pelo próprio avaliador na área dele (/dashboard/parceiro/avaliacao); a secção "Sobre" do perfil
-- público só aparece com texto. Até 600 caracteres. Só acrescenta a coluna: nenhuma função muda, nenhum dado muda.
-- Rollback: supabase/producao/rollback/0355_rollback.sql

alter table public.avaliadores_credenciamento
  add column if not exists sobre text
  constraint avaliadores_credenciamento_sobre_tamanho check (sobre is null or char_length(sobre) <= 600);
