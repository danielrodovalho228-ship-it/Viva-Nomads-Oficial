# E802: miniatura de anúncio "caixa cinza" em `/dashboard/imoveis`

Foto da main: `27dbdf1`. Origem: D6 da prova de 12/11 (anúncio ativo "[TESTE QA] Massa Mensagens 08-11", do Paulo).

## O que conferi

1. **O carregamento real da imagem, não só a tag.** O `BrandImage` tem três estados (`data-foto-estado`): "carregando" (fundo cinza pulsando), "pronta" (a foto carregou) e "falhou" ("Foto indisponível", com retentativa direto da origem antes de desistir, E323). A hipótese era o quadro ficar preso em "carregando" quando a foto termina ou falha antes da hidratação, porque o evento do React já teria passado.
   - **No lab** (`t1622`, DONO17 com 2 anúncios ativos e 1 rascunho com foto, a 1280 e a 390 px), abortando a foto pelo otimizador e direto da origem antes da hidratação, toda miniatura terminou em "falhou", com "Foto indisponível". Na carga normal, toda miniatura terminou em "pronta", com `naturalWidth > 0`.
   - **Resultado: 4 passed na main.** A hipótese não se reproduz: o React 19 reaplica `load` e `error` da imagem depois de hidratar.
2. **As fotos do anúncio em produção** (só leitura, SQL):
   - As 8 linhas de `property_photos` apontam para objetos que **existem** no bucket `property-photos`, em `image/webp`.
   - Os arquivos têm **3,9 a 5,7 KB**. As fotos reais dos outros anúncios têm 25 a 240 KB.
   - O rascunho "Imóvel mobiliado com 2 quartos e varanda" tem o mesmo perfil (3,9 a 5,5 KB).
   - Esse tamanho é o de uma imagem lisa, de uma cor, depois da conversão para WebP. É o que os specs e as massas sobem (`tests/e2e/fixtures/exif.ts`: `sharp({ create: { background: cor } })`; `scripts/lab/massa-varredura.mjs`: PNG de cor sólida).
   - **Leitura mais provável:** a "caixa cinza" É a foto da massa de teste, uma imagem de cor única, com o véu `bg-night/20` do `BrandImage` por cima. Não é uma miniatura que deixou de renderizar.
3. **"Rascunhos com placeholder inconsistente (ícone × caixa cinza lisa)".** Rascunho sem foto mostra o `PhotoPlaceholder`, com ícone. Rascunho com foto de teste lisa mostra a própria foto, que parece uma caixa cinza. São dois casos diferentes, e não há placeholder fora de padrão.

## Não confirmado

Não consegui abrir os pixels das 8 fotos: o host do storage está bloqueado nesta sessão, e prova ao vivo no site está fora das guardas. Para fechar, alguém com acesso abre uma das URLs do anúncio. Se for um quadro de cor única, o D6 é dado de teste, não defeito.

## Teste ligado

`tests/e2e/specs/t1622-e802-miniatura-nunca-cinza.spec.ts`, como guarda contra regressão: nenhuma miniatura com foto fica em "carregando". Se falhar, vira "Foto indisponível"; se carregar, fica "pronta", com a imagem de verdade.

| Base | t1622 |
|---|---|
| main (`BrandImage` de `27dbdf1`) | **4 passed** (22.1s) |

Sem mudança em `src/`.
