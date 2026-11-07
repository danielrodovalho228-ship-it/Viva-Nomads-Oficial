# Varredura "leitura que falha não vira não encontrado" — 2ª volta (5 pontos)

Critério: a leitura decide uma RECUSA e, se falha, a pessoa lê a recusa errada (ou a ação segue). Cada ponto agora diz "não foi possível agora, tente de novo".

| Onde | Antes (leitura com erro) | Agora |
| --- | --- | --- |
| `estadia-actions.ts` instruções de chegada | "Só o proprietário edita as instruções." | "Não foi possível conferir o imóvel agora." |
| `estadia-actions.ts` instrução de saída | "Só o proprietário edita a instrução de saída." | idem |
| `estadia-actions.ts` assinar aditivo | seguia como se ainda não tivesse assinado | recusa com "tente de novo" |
| `propostas-actions.ts` enviarProposta | "Escolha um interessado da sua lista." | "Não foi possível ler a candidatura agora." |
| `propostas-actions.ts` aceitar proposta | "Esta candidatura não está mais em andamento." | idem acima |

Teste: `src/lib/data/e689-leitura-falha-varredura-2.test.ts` (visto vermelho antes). `src/lib/data`: 338 ok; `tsc` limpo. Sem migração, chave, e-mail ou prova ao vivo.

Fora desta volta (de propósito): ~115 outras leituras `maybeSingle()` em `*actions*.ts` onde o erro vira "não encontrado". Em `vistoria/actions.ts` (19) e `parceiros/admin-actions.ts` (9) o efeito é só a mensagem; `imovelDaPessoa` (`parceiros/pedido-actions.ts`) devolve booleano e pede mudar a assinatura. Ficam para uma 3ª volta se o Daniel quiser.
