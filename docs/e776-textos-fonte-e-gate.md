# E776 — textos-fonte únicos + gate de frases proibidas no CI

## Fontes únicas (`src/config/textos-regulados.ts`)
- **Contato (E445):** `CONTATO_NUNCA_TROCADO` → `FRASE_CONVERSA_CHAT`, `PASSO_CONVERSE_TEXTO`, `DIFERENCIAL_CHAT`, `NOTA_CONTATO_MENSAGENS`, `NOTA_VISITA_DONO`. `src/config/conversa-chat.ts` só reexporta (os nomes antigos seguem valendo para quem importa).
- **Caução:** `CAUCAO_FRASE` (fonte em `src/lib/faixas.ts`, reexportada): "paga direto ao proprietário — a Viva não recebe nem segura esse dinheiro".
- **Taxas:** `TEXTO_REGRA_UNICA` (fonte em `src/lib/cobranca/regra.ts`, reexportada).

## O gate (`src/lib/frases-proibidas.ts` + `src/lib/frases-proibidas.test.ts`)
O CI varre `src/` (fora comentários) e falha se reaparecer: (1) contato "só depois do aceite"; (2) caução "em poupança"; (3) taxa cobrada do morador. Cada regra tem exemplos que devem e que não devem ser pegos.

## Corrigido nesta entrega
`messages-client` (estado vazio), `visitas/page` (subtítulo do dono), `conversa-chat` (3 frases; home, como-funciona e anúncio herdam), comentário de `checkin.ts`, rótulo "Caução na poupança" → "Caução (devolvida no fim)" em reembolsos.

## Fora do gate, de forma explícita (`FORA_DO_GATE`)
O fluxo de **parceiros** (serviços): a liberação do contato do parceiro depois do aceite é regra própria, já implementada em `src/lib/parceiros/pedido-actions.ts` (L2-B item 16); o texto descreve o que o código faz. Se a coordenação decidir que parceiros também nunca trocam contato, é mudança de comportamento (não só de texto) e o prefixo sai da lista.

## Dependência
Este PR parte do #3579 (E752), que já tirou "poupança" de `CAUCAO_FRASE`, do guia da Caução e do resumo do atendimento. Depois do merge do #3579, trocar a base para `main`.

## Inventário das superfícies (feito enquanto o #3579 não mescla)
| Superfície | Varrida pelo gate? | Achados |
|---|---|---|
| `src/` (fora testes e `FORA_DO_GATE`) | sim, desde o início | 0 |
| `supabase/` (seeds, SQL, templates), `public/`, `scripts/` | **sim, a partir deste commit** | 0 |
| `tests/`, `docs/` | não, de propósito (guardam as formulações ruins como exemplo e descrevem as regras) | só os próprios exemplos |
| fluxo de parceiros | fora, justificado em `FORA_DO_GATE` | — |
Resultado: nenhuma frase proibida viva fora de `src/`. O gate agora cobre também essas raízes.
