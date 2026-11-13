# E828 — o nome do nível muda de superfície para superfície

**Achado:** o cartão mostra a pílula "Essencial"; a página do anúncio põe "Pronto para Morar" sobre a foto e diz "Nível Essencial" na seção própria; a home nunca explica que Essencial é um NÍVEL.
**Desenho aprovado (05–06/11, E626):** o nível é a palavra em pílula própria com cor (Essencial · Conforto · Premium); "Pronto para Morar" é outro selo.

## Correção
1. **Componente único** `src/components/niveis/pilula-nivel.tsx` (`PilulaNivel` + `COR_NIVEL`, liga o E777): o leitor de tela e o `title` dizem "Nível X". Usado em:
   - cartão (`selos-foto.tsx`, mesmo `data-testid="card-nivel"`);
   - página do anúncio, seção do nível (`nivel-imovel.tsx`): "Nível" + a pílula (o texto lido segue "Nível Conforto · vistoriado"), e na folha "Como funcionam os níveis";
   - home, seção "O diferencial" (`data-testid="home-niveis"`): "Cada anúncio também mostra o nível do imóvel, numa pílula própria", com as três pílulas e o critério de cada uma (`CRITERIO_NIVEL`).
2. **Foto da página sem "Pronto para Morar"** (`readyToLive={false}`): a MESMA linha do E811 (#3779), para este PR valer sozinho; o texto segue nos destaques.

## Testes
- `node --test src/lib/e828-nome-nivel.test.ts` — main: pass 0 / fail 1 (componente inexistente); branch: pass 4 / fail 0.
- Escopados (e828 + e626 + niveis + home-imagens + frases-proibidas + components + busca + anuncio): todos verdes. tsc limpo; consistência OK.
- Lab (build da branch):
  - t920 + t784 + t217: verdes; t296 cenário 0 verde (rodada 1: 9 passed, 1 failed, 4 não rodaram pelo modo serial).
  - t296 0 + 2–5 (rodada 2): 0, 2 (página do anúncio: "Nível Conforto", "Nível Premium · vistoriado", folha) e 3 verdes; 4 falhou; 5 não rodou.
  - Falhas fora do E828: o cenário 1 espera o nível na linha-síntese do cartão (o E416 tirou de lá na main; a pílula `card-nivel` passa). O cenário 4 é a decisão "nivel-queda" no painel do dono, que este PR não toca.

## Asserções alteradas
- `src/lib/e626-selos-cartao.test.ts`: as cores do nível são conferidas na pílula única (o cartão passa a usar `<PilulaNivel>`).

## Dúvidas
- Conflito com o #3779 (E811) só se a linha da galeria divergir; hoje é idêntica (`readyToLive={false}` + o mesmo comentário).
- t296 cenário 1 (síntese com nível) está desatualizado desde o E416; não mexi nele por ser de outro item.

## Fechamento do lote (suíte completa)
A 1ª rodada da suíte completa pegou duas regras da casa, corrigidas no commit seguinte:
- `estilo-padrao.test.ts`: o `mt-0.5` da pílula na home estava fora da régua de espaçamento e saiu.
- `cobranca/regra.test.ts` (varredura dos nomes de planos antigos): um comentário da home citava a palavra do nível que também era nome de plano antigo. O comentário foi reescrito; o texto da tela vem de `ROTULO_NIVEL`.
Depois: `npm test` → 7331 testes, 7330 pass, 0 fail.
