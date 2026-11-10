# E774 — "contato só depois do aceite" (família do E764)
Regra E445: contato nunca é trocado no chat; emergência pelo telefone da Viva.
1. Home, passo 2 "Converse": já usa `PASSO_CONVERSE_TEXTO` (fonte única, E776, "…nunca são trocados"). Nada a mudar na main.
2. /pedidos/novo: `avisoConfirmacao` (src/lib/pedidos/confirmacao.ts) dizia "Seu contato continua escondido até você aceitar uma resposta". Agora: "Seu contato nunca é trocado: a conversa fica no chat da Viva." (sem a palavra "telefone", que a chave de SMS desligada proíbe).
Teste: `confirmacao.test.ts` (141 pass / 0 fail no escopo) + spec t165 ajustada.
Fora do escopo, a decidir: parceiros ("Contato e endereço só depois do aceite", `CONTATO_APOS_ACEITE`, `selos-confianca.tsx`) é outra regra (liberação ao parceiro, L2-B item 16) e não foi tocada.
