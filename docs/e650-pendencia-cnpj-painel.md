# E650 — pendência do CNPJ no painel do parceiro (varredura do escopo)

**Defeito:** `faltaDe` (painel-actions.ts) só passava `tipoPessoa` a quem ainda não tinha publicado; o parceiro PF
legado já publicado saía da busca (E648) sem o painel explicar nem pedir o CNPJ.

**Correção (PR #3013):** `faltaParaPublicar` ganhou `jaPublicou`. O tipo de pessoa vai sempre; a pendência
`PENDENCIA_CNPJ` vale para todo parceiro com `tipo_pessoa ≠ pj`. Só a pergunta da nota fiscal continua sem tirar do ar
quem já publicou. Com a página publicada, a tela mostra `parceiro-pendencia-cnpj-publicado`.

## Varredura dos consumidores (nada mais fica escondido atrás de "não publicado")
| Lugar | Situação |
|---|---|
| painel-parceiro.tsx, aviso "Falta para publicar" | rascunho e pausado já mostravam o CNPJ; publicado agora tem o aviso próprio |
| painel-parceiro.tsx, suspenso | tela de suspensão própria; fora do escopo |
| `tipo_pessoa` nulo | cai na regra (≠ pj): mostra a pendência |
| automacao/acoes.ts, pedido-actions.ts, automacao/servidor.ts | já recusam quem não é PJ; a recusa do aceite diz "apresente o seu CNPJ" |
| admin/parceiros/fichas.tsx | já mostra "Sem CNPJ" |
| painel-parceiro.tsx, aba Dados ("Pessoa física (CPF)") | superfície do E649 (#3015, Pista A); não tocada aqui |

Teste: `src/lib/parceiros/e650-pendencia-cnpj-painel.test.ts` (6) + `fiscal.test.ts` atualizado.
Escopo: `node --test src/lib/parceiros/*.test.ts` 164/164; regressão E648 (vistoria, automação, notificações, fiscal,
atendimento, parceiros) 801/801.

**Coordenação com o E649:** os dois PRs usam o mesmo `import` de `regras` em painel-parceiro.tsx; o conflito de
linha aparece quando o #3015 entrar e se resolve mesclando a `main` aqui. O testid deste PR é distinto do dele.
