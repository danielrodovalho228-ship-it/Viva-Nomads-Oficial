-- 0193 — Contas de QA marcadas como teste (Prompt 36, item 1). Mesmo padrão da 0135.
-- Cinco contas de QA ainda estavam como reais: saem dos números "Real" do admin, os e-mails delas passam a cair na
-- caixa de teste, o parceiro delas sai da busca pública (a página abre por link, com noindex) e os pedidos e
-- contratos delas passam para o recorte "Teste". Da próxima vez, o admin marca pela tela (/admin/usuarios).
update public.profiles
   set is_teste = true
 where not is_teste
   and lower(split_part(email, '@', 1)) in ('proprietario2', 'proprietario3cnpj', 'inquilino2', 'proprietario-qa', 'teste-qa-2026');
