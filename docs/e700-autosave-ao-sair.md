# E700 — Declarações do passo 10 chegam ao servidor mesmo se a pessoa sai logo

**Relato (QA Allinne, 07/11):** o checklist de publicação não atualiza depois das declarações (Passo 10 e `/dashboard/imoveis`).

**O que verifiquei:** no próprio Passo 10 o checklist já é derivado do estado local (`qualificado` ← `declaracoes`), então muda na hora. Quem lê o rascunho GRAVADO é a lista de imóveis (`prontidaoDosImoveis` → `qualificacaoDoRascunho` ← `draft_data.declaracoesPasso10`).

**Causa:** o autosave do rascunho espera 2 s (debounce) e a limpeza do efeito (`on = false; clearTimeout`) cancelava o salvamento pendente. Marcar uma declaração e sair da página antes de 2 s (por exemplo, "Meus imóveis") perdia a mudança: o servidor ficava com o rascunho velho e o checklist da lista seguia desatualizado até a próxima edição.

**Correção (sem migração; só `page.tsx`):** o salvamento pendente de uma EDIÇÃO real fica guardado (`gravacaoPendenteRef`); ao sair da página, ele é gravado na hora (uma vez; a pendência é limpa quando o timer normal dispara). Abrir o rascunho sem editar continua não gravando nada (E516).

**Teste:** `e700-autosave-ao-sair.test.ts` (guarda de código; visto vermelho antes). `tsc` e `eslint` limpos.

**Não reproduzido ao vivo.** Se a QA ainda vir o checklist velho depois disto, preciso do passo a passo e do horário (pode ser o cache de navegação da lista).
