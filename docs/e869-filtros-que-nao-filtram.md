# E869: a busca não exibe filtro que não filtra

Foto da main: `27dbdf1`. Origem: Phoenix RELATORIO-020, A-92 e A-97 (12/11/2026).

## Defeitos

1. **Parâmetros desconhecidos no link** (`?pets=1`, `?trabalho=1`, `?garagem=1`, `?comod=maquina`). O efeito que escreve a URL parte de `window.location.search` e nunca removia o que a busca não lê. O link compartilhado continuava com esses parâmetros e mostrava os 15 imóveis, como se o filtro estivesse aplicado.
   - Os nossos próprios links tinham o mesmo problema: os e-mails do E205-B e a página de anúncio pausado mandam para `/buscar?cidade=…`, que a busca nunca leu.
2. **Interruptores impossíveis no "Mais filtros".** "Aceita negociação · 0" e "Emite nota fiscal · 0" apareciam desativados mesmo sem nenhum anúncio do catálogo com esse recurso.

## Correção

- **`src/lib/busca/link-da-busca.ts`:** a busca passa a ter uma lista das chaves que ela lê. O que não está na lista sai da URL e é nomeado num aviso acima da lista (`busca-aviso-link`): "Este link tinha filtros que a busca não reconhece (…). Eles foram ignorados…".
  - Comodidade inexistente sai de `comod`, e as válidas ficam.
  - `cidade` é lido como `local`.
  - Parâmetros de rastreio de campanha (`utm_*`, `gclid`, `fbclid`) ficam na URL.
- **`interruptorSemAnuncio` (`facetas.ts`):** Gestor, Negociação, Preço justo e Nota fiscal não aparecem quando nenhum anúncio do catálogo tem o recurso (contagem feita sem os outros filtros).
  - O que só zera na combinação atual continua desativado, pela regra do E42.
  - O interruptor ligado aparece sempre, para poder ser desligado.

## Testes

- **Unitário:** `node --test src/lib/busca/e869-filtros-que-nao-filtram.test.ts`.
  - main: falha, porque o módulo não existe.
  - branch: 6 pass.
- **Escopo** (busca, estilo, componentes da busca): **304 pass / 0 fail**. tsc limpo.
- **E2E:** `tests/e2e/specs/t1620-e869-filtros-que-nao-filtram.spec.ts`, a 1280 e a 390 px.

| Base | t1620 |
|---|---|
| main `27dbdf1` | **2 failed**: "aviso do link": nenhum aviso para `?pets=1&trabalho=1&garagem=1&comod=maquina` |
| branch | **2 passed** (6.5m) |

Na main, o spec para no primeiro passo (o link). Por isso, a parte dos interruptores só é medida na branch.
