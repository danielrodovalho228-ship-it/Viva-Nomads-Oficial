# Erros e estados vazios, rodada 5 (2º achado): a Carteira não diz "Você tem 0 imóveis ativos" quando a leitura falha

Foto da main: `27dbdf1`. O levantamento desta rodada está em `docs/estados-vazios-5-para-avaliar.md` (PR #3758).

## Defeito

`/dashboard/carteira` conta os imóveis ativos com `imoveisAtivosDoDono()` (`src/lib/data/menu-actions.ts`), que devolvia 0 quando o banco falhava. A tela então dizia a um dono com 3 ou mais imóveis ativos: "Abre com 3 imóveis ativos — Você tem 0 imóveis ativos. Com mais 3, a análise…". Era um número falso, acompanhado do convite para anunciar outro imóvel.

## Correção

`imoveisAtivosDoDono` passou a aceitar `{ exigir }`:
- **A tela da Carteira** pede com `exigir: true`. Quando a leitura falha, a função lança um erro e o painel mostra "Não conseguimos abrir esta tela", com o botão "Tentar de novo".
- **Os contadores do menu** (`contadores-servidor.ts`) seguem sem `exigir` e com `.catch(() => 0)`. Assim, uma falha não derruba a casca.

## Teste

`node --test src/lib/data/carteira-ativos-falha.test.ts`:
- **main:** 2 fail;
- **branch:** 2 pass.

Testes do escopo (contadores, listas com falha, estados vazios, cobrança, carteira e menu): **97 pass / 0 fail**. Testes da carteira e do menu (`link-alvo`, `vazio-carteira-vencimentos`, `menu-painel`): **10 pass / 0 fail**.
