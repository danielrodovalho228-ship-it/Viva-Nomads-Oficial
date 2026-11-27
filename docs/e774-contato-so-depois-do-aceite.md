# E774 — "contato só depois do aceite" (família do E764)
Regra E445: contato nunca é trocado no chat; emergência pelo telefone da Viva.
1. Home, passo 2 "Converse": já usa `PASSO_CONVERSE_TEXTO` (fonte única, E776, "…nunca são trocados"). Nada a mudar na main.
2. /pedidos/novo: `avisoConfirmacao` (src/lib/pedidos/confirmacao.ts) dizia "Seu contato continua escondido até você aceitar uma resposta". Agora: "Seu contato nunca é trocado: a conversa fica no chat da Viva." (sem a palavra "telefone", que a chave de SMS desligada proíbe).
Teste: `confirmacao.test.ts` (141 pass / 0 fail no escopo) + spec t165 ajustada.
Fora do escopo, a decidir: parceiros ("Contato e endereço só depois do aceite", `CONTATO_APOS_ACEITE`, `selos-confianca.tsx`) é outra regra (liberação ao parceiro, L2-B item 16) e não foi tocada.

## Parceiros (decisão do chat principal, 10/11: entra na família E764/E774)
"Contato e endereço só depois do aceite" em Parceiros também sugere revelação após o aceite, contra a regra E445 (contato nunca é trocado, em nenhuma fase). Corrigidas: `parceiros/[slug]/page.tsx`, `parceiros/buscar/page.tsx`, `selos-confianca.tsx`, `parceiros-texto.ts` (e a resposta do chat da Viva `CONTATO_NO_ACEITE`, que dizia que o contato "só é liberado ao parceiro depois que aceita"), mais a página de fotógrafos pela fonte única `CONTATO_PELA_VIVA` (`src/lib/parceiros/regras.ts`). O **endereço** do imóvel continua chegando ao parceiro só após o aceite (isso não é contato).
Teste: `src/lib/parceiros/e774-contato-parceiros.test.ts` (3).
**Fora de escopo, a decidir:** o servidor ainda lê o contato da outra parte depois do aceite (`pedido-actions.ts`, L2-B 16) e `contatoLiberado` (fotógrafos, `lib/fotografos/regras.ts`). Os textos agora seguem a regra; se o comportamento do servidor também deve mudar, é decisão de produto separada.
