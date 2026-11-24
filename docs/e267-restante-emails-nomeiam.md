# E267 (restante) — todo e-mail nomeia pessoa, imóvel e fato no corpo

O residual do cron já entrou (PR #1784). Este PR fecha o que restava.

## Inventário

Varri todas as chamadas `notify({` em `src/`, sem contar os testes: são 78 pontos de envio, e 19 saíam sem `body`, ou seja, com a frase genérica do modelo.

| Ponto de envio | Evento | Situação | O que muda |
|---|---|---|---|
| `src/lib/data/actions.ts` (sendMessage) | `new_message` | Corpo genérico: "você recebeu uma nova mensagem" | Corrigido. Diz quem escreveu e o imóvel da conversa. |
| `src/lib/atendimento/servidor.ts` (avisarProprietarioManutencao) | `manutencao_nova` (nova e lembrete) | Corpo genérico: "no seu imóvel" | Corrigido. Diz o imóvel, a urgência e o prazo; no lembrete, "ainda espera a sua resposta". |
| `src/app/api/cron/checkin-lembretes/route.ts` | `checkin_lembrete` | Corpo genérico: "a entrada no imóvel do seu contrato" | Corrigido. Diz o imóvel, a data e o horário; o morador lê "a sua entrada", o dono lê "a entrada do morador". |
| `src/lib/comparador-airbnb/comparacao-servidor.ts` | `preco_justo_acima` | Corpo genérico: "seu anúncio" | Corrigido. Diz o imóvel, o total na Viva, o valor no Airbnb e o teto para o selo. |
| `src/lib/atendimento/servidor.ts` (avisarUsuario) | `chamado_aberto` / `_respondido` / `_resolvido` | Sem imóvel; o corpo dizia só "seu chamado" | Corrigido. Diz o número e o assunto do chamado. |
| `src/lib/data/pedidos-admin.ts` | `pedido_confirmar_telefone` | Já nomeia a pessoa e o fato ("seu pedido de moradia…"). Não há imóvel: é um pedido para a cidade. | Fica como está. |
| `src/lib/parceiros/*` | `parceria_recusada`, `parceria_convite`, `parceria_recebida`, `parceiro_selo_nota_removido` | Já nomeiam a pessoa e o fato. O objeto é a conta de parceiro, não há imóvel. | Fica como está. |
| Internos | `documento_recebido` (4), `parceria_equipe` | Vão só para a equipe. | Fora do escopo. |
| Sem e-mail | `pedidos-compat.ts` (`pedido_compativel`, só push) e `respostas/servidor.ts` (`new_message` sem e-mail) | Não mandam e-mail. | Fora do escopo. |
| Rota de teste | `src/app/api/test-lead/route.ts` | — | Fora do escopo. |
| Já corrigido | `internet-medida-servidor.ts` | Já espalha o corpo residual. | — |

## Como ficou

- Os construtores puros estão em `src/lib/notifications/corpo-e267-restante.ts`. O catálogo de e-mails (`catalogo-emails.ts`) mostra os mesmos corpos.
- O corpo entra cru nas duas versões do e-mail, HTML e texto. Por isso o texto do usuário passa por `seguro()`, que tira links e os caracteres `< > " &`.
- Os assuntos continuam os da régua `assuntos.ts`. Este PR não muda nenhum assunto.

## Teste

`node --test src/lib/notifications/corpo-e267-restante.test.ts`

- **Na main:** falha, porque o módulo não existe e os pontos de envio não passam `body`.
- **Neste PR:** 7 de 7 passam.
