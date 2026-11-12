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
