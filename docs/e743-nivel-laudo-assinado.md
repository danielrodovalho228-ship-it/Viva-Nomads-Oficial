# E743 — tela de nível (/nivel do dono) quebra com laudo assinado (achado L-107, Pista C)
**Causa:** `src/components/vistoria/selo-assinatura.tsx` é componente de SERVIDOR e passava `onFocus={(e) => e.currentTarget.select()}` a um `<input>`. Manipulador de evento não atravessa o servidor: com laudo ASSINADO a tela do dono caía em "Não conseguimos abrir esta tela". Sem assinatura o selo não renderiza, por isso só quebrava com o laudo assinado.
**Correção (sem migração):** sem manipulador; o clique seleciona o hash inteiro por CSS (`select-all`). O mesmo selo aparece na tela do avaliador, que fica igual.
**Guarda:** `e743-selo-sem-handler.test.ts` falha se qualquer componente de servidor de `src/components/vistoria` voltar a passar `on*=` a um elemento.
**Para a Pista C:** o `test.fail` do `t1429` (draft #3394) pode sair junto com este PR.
Sem prova ao vivo.
