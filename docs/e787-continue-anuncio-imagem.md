# E787 — "Continue seu anúncio" com a área da imagem vazia
O E501 já cobria imagem que falha (onError) e rascunho sem foto (espaço desenhado). Faltava a imagem que NÃO falha nem pinta (pendura/resposta vazia): a área ficava cinza.
Correção em `foto-inicio-dono.tsx`: onLoad com largura 0 = falha; prazo de 8 s (`PRAZO_FOTO_MS`) sem pintar = plano B (espaço desenhado no rascunho; coluna única nas demais). Foto que carrega cancela o prazo.
Teste: `src/components/painel/e787-continue-anuncio-imagem.test.ts` (+ E501 segue verde). Painel do morador/observadora usa o mesmo componente. Sem prova ao vivo (QA).

## Causa encontrada (10/11, leitura do banco, sem o site)
Lucas (morador de teste) tem um rascunho cuja capa é uma foto REAL no bucket (`property_photos`, arquivo existe), mas **todas as fotos da pasta dele têm 1.784 bytes** (webp de massa de teste, 25/10): uma imagem de cor única. O cartão carrega a imagem sem erro e mostra um retângulo chapado — é o "retângulo verde sólido" do relato. O E501/E308 só tratavam arquivo ausente ou quebrado.
Correção: a capa do "Continue seu anúncio" só considera arquivos do bucket com pelo menos 4 KB (`TAMANHO_MINIMO_FOTO_REAL_BYTES`, `src/lib/fotos-anuncio.ts`); abaixo disso cai na próxima foto de verdade ou no espaço desenhado ("A foto principal aparece aqui"). A regra é só da capa (`arquivosDoDono(..., { soFotosReais: true })` em `dashboard/page.tsx`); o editor e Meus imóveis não mudam. Junto fica o prazo de 8 s do commit anterior (imagem que não pinta).
Teste: `src/lib/minimizacao/e787-capa-foto-real.test.ts` (5) + E308/E426/painel: 25 pass / 0 fail; `tsc` limpo.
Evidência que falta (para a QA, se ainda ver o retângulo): a URL da imagem do cartão; se o arquivo tiver ≥ 4 KB e for chapado, o limite precisa subir. Sem prova ao vivo.
