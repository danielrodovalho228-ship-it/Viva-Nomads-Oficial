# E753: uma velocidade só por anúncio, nunca afirmada como medida

## Evidência

- **Phoenix RELATORIO-004 (C2), reconfirmado no RELATORIO-013 (12/11):** o `ube-002` dizia "Internet fibra 200 Mbps" nas comodidades e "Internet 100 Mbps" no Espaço de trabalho.
- **RELATORIO-011:** cada anúncio deve ter uma fonte única de velocidade, e a velocidade só declarada nunca pode ser afirmada como medida.

## Conferência prévia

O PR antigo do E753 (#3555, mergeado) tratou **outra** contradição: tirou o "Wi-Fi" da lista "Não tem".

Na main `27dbdf1`, o `src/lib/properties.ts` **ainda** tinha as duas velocidades no `ube-002`. Os 15 anúncios de exemplo escreviam a velocidade como texto livre ("Internet fibra 300 Mbps") nas comodidades, no espaço de trabalho e nos grupos. Esses textos saem na página como item de lista, sem rótulo, como se fossem fato.

## Causa

O app já tem a fonte única da velocidade:
- o campo `internetMbps`, usado pelo editor dos anúncios reais;
- a função `textoInternet` (`src/lib/internet-medida.ts`), com esta regra:
  - medição válida → "Internet medida no imóvel: …";
  - só o campo → "Internet informada pelo proprietário: N Mbps (não medida)".

Os anúncios de exemplo contornavam essa fonte com o número no texto livre.

## Correção

| Onde | Antes | Depois |
|---|---|---|
| `src/lib/properties.ts` (15 exemplos) | "Internet fibra 300 Mbps" e "Internet 100 Mbps" em `amenities`, `workFeatures` e `amenityGroups` | O texto vira "Internet fibra" ou "Internet", sem número, e a velocidade vai **uma vez** para `internetMbps`. A página passa a mostrar "Internet informada pelo proprietário: N Mbps (não medida)" |
| `ube-002` | 200 Mbps (comodidades) × 100 Mbps (trabalho) | **100 Mbps**, fibra: a menor das duas, para não prometer além do que o anúncio afirmava |

Os anúncios reais não mudam: eles já usam o campo, pelo editor.

**Efeito na busca:** com o filtro de internet ligado, os exemplos passam a entrar na linha "Mais N com internet informada, mas não medida". É o certo: a velocidade deles é declarada, não medida.

## Provas

### Unitário

`node --test src/lib/e753-velocidade-unica.test.ts`
- **main: 3 fail**. Há velocidade no texto livre, falta o campo único e o `ube-002` tem dois números.
- **branch: 5 pass**.

Escopo maior (lib, níveis, anúncio, busca, pedidos, componentes do imóvel): **2746 pass / 0 fail**.

### E2E

`tests/e2e/specs/t1615-e753-velocidade-unica.spec.ts` abre a página pública dos 15 exemplos e verifica três coisas:
- nenhuma velocidade (N Mbps) aparece fora da linha de internet;
- a linha mostra um número só;
- quando há velocidade, ela vem rotulada "(não medida)" ou "medida no imóvel".

Resultado no lab (main × branch): ver o PR.

## Asserções alteradas

Mudaram só os dados de teste; as asserções continuam as mesmas.
- **`src/lib/niveis/nivel-exemplo.test.ts`** (E754 e E620): para simular "anúncio sem velocidade", os testes trocavam só o texto. Agora também zeram o campo (`internetMbps: undefined`).
- **`src/lib/busca/facetas.test.ts`** (E40): o teste conta um único anúncio com velocidade informada (o de 400 Mbps). Agora zera o campo dos demais exemplos dentro desse teste.
