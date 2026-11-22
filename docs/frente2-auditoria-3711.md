# Frente 2: auditoria do #3711 (asserções de t85, t600 e t862)

O #3711 ("[Faixa D] Laboratório verde", mesclado em 11/11, `0533d3541`) mudou três specs. Para cada um conferi três coisas: quando o comportamento mudou, se havia decisão por trás e se o spec já tinha estado verde (`lab_execucoes`, só rodadas completas).

| Spec | Antes | Agora | Decisão ou regressão | Ação |
|---|---|---|---|---|
| t600 (dono) | `"Ana I."` na lista e no cabeçalho da conversa | `ana.nome` ("Ana Isabela") | **Decisão E427** (`45d611e23`, 02/11): depois do aceite, nome completo e igual em todas as telas (`nomeNaConversa`, papel proprietário). O spec nasceu em 29/10 (`319fb06e9`), antes do E427, com a regra antiga (nome curto). Nunca esteve verde no lab: a primeira rodada completa dele é de 09/11. | **Manter** |
| t600 (moradora) | `"Dalva C."` | `dono.nome` ("Dalva Conversa") (**este PR**) | **Mesma decisão E427** (papel inquilino: nome completo do dono depois do aceite). O #3711 acertou só o lado do dono. Nas três rodadas da main de 12/11 (`02a337e62`, `c1b1b3408`, `4d705dee7`) o t600 ficou com 1 falha e 1 pulo; o modo é serial e o teste 5 nem roda. | **Corrigir o spec** (este PR) |
| t85 (laudo da saída) | arquivo não-PDF de 28 bytes → "Envie o laudo em PDF" | arquivo não-PDF de 4 KB → "Envie o laudo em PDF" (o texto esperado não muda) | **Decisão E669** (`d785fa370`, 07/11; `docs/e669-laudo-conferencia.md`, item 1): tamanho mínimo de laudo de 1 KB (`LAUDO_MIN_BYTES`), conferido antes do tipo. Com 28 bytes a resposta certa passou a ser "pequeno demais". O spec tinha 144 verdes e caiu na primeira rodada completa depois do E669 (09/11). | **Manter** |
| t862 (outra conta) | `status 404` | `status 200 ou 404` + tela "Página não encontrada" + perfil ausente | **Comportamento documentado do Next 16**, não regressão: `node_modules/next/dist/docs/01-app/03-api-reference/03-file-conventions/loading.md`, "Status codes": "Streaming page responses begin with a 200 status code". O painel tem `loading.tsx` desde 04/10 (`58e19542d`); o spec nasceu em 05/11 (`a6ecc5989`) já esperando 404, que nunca podia vir. A proteção que importa continua cobrada: o perfil não aparece para outra conta, e o 404 em streaming leva `noindex`. | **Manter** |

## Reprodução e prova (teste determinístico)
- `tests/laboratorio/t600-nome-apos-aceite.test.ts`, teste 2, novo (lado da moradora). Antes da correção do spec: 1 pass / 1 fail. Depois: 2 pass / 0 fail.
- As três guardas do #3711 (t600, t85, t862) seguem verdes: 4 pass / 0 fail no conjunto.
- O `lab-critico` deste PR roda o t600 de verdade, porque o spec mudou.

## Fora desta frente
Outros specs que ainda esperem o nome curto depois do aceite entram na Frente 3 (verdes → vermelhos), se aparecerem na lista.
