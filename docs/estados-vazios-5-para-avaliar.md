# Erros e estados vazios, rodada 5: "Para avaliar" não diz "nada" quando a leitura falha

Foto da main: `27dbdf1`.

## Defeito

Em `/dashboard/avaliacoes`, as abas "Recebidas" e "Feitas" já liam com `exigir` (achado nº 9). A aba "Para avaliar" (`avaliacoesParaFazer` em `src/lib/data/avaliacoes-painel.ts`) chamava `getMinhasLocacoes()` e `getMeusContratos()` sem esse parâmetro. Assim, uma falha do banco virava lista vazia e a tela mostrava "Nada para avaliar agora — Quando uma estadia termina, você tem 14 dias para avaliar a outra parte". Quem estava dentro desses 14 dias via que não tinha nada a fazer e podia perder a janela.

## Correção

As duas leituras agora usam `{ exigir: true }`. Na falha, a leitura lança um erro e o painel mostra "Não conseguimos abrir esta tela", com "Tentar de novo", como já acontece nas outras abas e nas listas de Propostas, Visitas e Locações (achados nº 6 e 7). Quando não há mesmo nada a avaliar, a tela continua igual.

## Teste

`node --test src/lib/data/avaliacoes-para-avaliar-falha.test.ts`:
- **main:** 1 fail ("'Para avaliar' lê estadias e contratos com exigir").
- **branch:** 3 pass.

Testes do escopo (avaliações, listas com falha, estados vazios, abas): **34 pass / 0 fail**.

## Levantamento desta rodada (estados vazios dos fluxos logados)

- Os 30 `EmptyState` das telas logadas fora do admin já têm texto próprio da tela e um próximo passo. Nenhum tem cara de modelo pronto. O placeholder "Em construção" existe, mas nenhuma rota o usa.
- As listas principais leem com `exigir`.
- Restaram dois casos em que a falha da leitura vira um "zero" que mente:
  1. **"Para avaliar"**: corrigido neste PR.
  2. **Carteira:** em `/dashboard/carteira`, `imoveisAtivosDoDono()` devolve 0 quando dá erro. A tela então diz "Abre com N imóveis ativos — Você tem 0 imóveis ativos" para quem tem imóveis. Vai em um PR separado.
