# E756: composição do total "R$ X em N meses" (retrabalho do reprovado ao vivo em 11/11)

## O que a prova ao vivo mediu
No ube-001, cada superfície usava uma regra:
- o total de **1 mês** do cartão e do detalhe era **R$ 3.960**: só o total do mês, sem as limpezas;
- a conta da própria página somava **R$ 4.660**;
- o total de **6 meses** incluía as limpezas;
- a prévia da revisão do dono incluía a preparação já no 1º mês.

## Reprodução na main (teste determinístico)
`src/lib/e756-composicao-unica.test.ts`, com os três anúncios de exemplo em 1 e 6 meses:

| 1 mês | cartão e detalhe na main | página, conta e prévia do dono |
|---|---|---|
| ube-001 | R$ 3.960 | R$ 4.660 |
| ube-002 | R$ 3.130 | R$ 3.830 |
| ube-003 | R$ 4.100 | R$ 4.800 |

Na main: 5 testes, 0 pass, 5 fail.

## Regra única (a do E777/E254-A, `estadiaDoImovel`)
**Total em N meses = N × total do mês + limpeza de preparação + limpeza de saída, para QUALQUER N ≥ 1.**
- O "/mês" continua sendo o total do mês: mensal, condomínio, contas fixas e a limpeza durante a estadia quando é paga à parte.
- As limpezas únicas entram só no total do período, sempre com a conta aberta.
- A diferença entre anúncios ("ube-002 inclui a limpeza durante a estadia", "ube-003 só o mensal") é de **dado**, não de regra. O ube-002 tem pacote de limpeza mensal, que é custo do mês. O ube-003 tem contas medidas à parte, que não entram em valor fixo. As duas aparecem na lista "Quanto você paga por mês" e na conta.

## Superfícies
- **Cartão da busca** (`property-card`, `estadiaNoCartao`): total da regra única também com 1 mês. Embaixo, "Total da estadia: 2 × R$ 4.100 + limpeza de preparação R$ 450 + limpeza de saída R$ 250".
- **Detalhe**:
  - o cartão lateral (`price-card`) mostra o total de 1 mês pela regra única, sempre com a conta;
  - a barra do celular (`barra-fixa-imovel` / `property-detail`) usa o mesmo total.
- **Prévia do dono (Passo 10)** e **Meus anúncios** (`linhaEstadiaMinima` / `estadiaDoCartaoDoDono`): com 1 mês, a linha também traz total e conta. Antes era só o rótulo "Estadia mínima (1 mês)".
- **Mapa, favoritos, comparar, visão geral e imagem de compartilhamento:** `rotuloPrecoDoImovel`, isto é, o rotuloPreco com o "em N meses" da regra única. Antes era mês × N, sem as limpezas.
- **Lista do dono (`property-row`) e pedidos (`pedidos-client`):** não recebem os valores das limpezas. Passam a mostrar só o total do mês, em vez de um "em N meses" de outra regra.

## Testes
- Novo: `src/lib/e756-composicao-unica.test.ts`, 5 testes. Na main: 0 pass / 5 fail. Neste PR: 5 pass / 0 fail.
- Spec de lab: `tests/e2e/specs/t1603-e756-composicao-total.spec.ts`, ube-001 com 1 e 6 meses, no cartão lateral, na conta e na barra do celular.
- Asserções antigas alteradas: estão na descrição do PR.

## Escopo ampliado (12/11): "a regra diverge entre anúncios"

### O que foi apontado
- O ube-001 soma mensal, condomínio e contas.
- O ube-002 põe a limpeza durante a estadia (2 por mês, R$ 180) dentro do total.
- O ube-003 é só o mensal, com as contas "medidas à parte".

### Diagnóstico
A regra do total do mês já é **uma só**, a `calcularTudoIncluido` de `src/lib/precos.ts`: mensal + condomínio + contas fixas + pacote de limpeza. A diferença entre os anúncios vem do **dado** de cada um:

| Anúncio | Dado | Total do mês |
|---|---|---|
| ube-001 | condomínio R$ 480, contas fixas R$ 280 | R$ 3.960 |
| ube-002 | condomínio R$ 350, contas R$ 200, pacote de limpeza R$ 180 | R$ 3.130 |
| ube-003 | sem condomínio, contas no regime real (medidas) | R$ 4.100 |

O cartão não mostrava o que compõe o "/mês". Por isso a diferença de dado parecia diferença de regra.

### Correção
O cartão da busca ganhou a linha `cartao-mes-composicao`. Ela vem de `composicaoDoMes()` (`src/lib/cartao-estadia.ts`), que usa a mesma fonte do total do mês (`calcularTudoIncluido` + `parcelasDoMes`). Não há lógica nova de soma.

| Anúncio | O que o cartão mostra |
|---|---|
| ube-001 | "Por mês: valor mensal R$ 3.200 + condomínio R$ 480 + contas R$ 280 = R$ 3.960" |
| ube-002 | "Por mês: valor mensal R$ 2.400 + condomínio R$ 350 + contas R$ 200 + limpeza R$ 180 (2 por mês) = R$ 3.130" |
| ube-003 | "Por mês: valor mensal R$ 4.100 · água, luz e gás medidos à parte, fora do total" |

Embaixo continua a linha "Total da estadia: N × total do mês + limpeza de preparação + limpeza de saída", que já vinha da regra única deste PR.

### Testes
- **Unitário:** `src/lib/e756-composicao-unica.test.ts` ganhou os testes 6 e 7. Antes: 5 pass / 2 fail. Depois: 7 pass / 0 fail.
- **Lab:** `t1603` ganhou o caso do cartão da busca, com a composição do mês dos três anúncios e a conta do total.
