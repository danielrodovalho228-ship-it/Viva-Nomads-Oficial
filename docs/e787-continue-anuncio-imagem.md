# E787 — "Continue seu anúncio" com a área da imagem vazia
O E501 já cobria imagem que falha (onError) e rascunho sem foto (espaço desenhado). Faltava a imagem que NÃO falha nem pinta (pendura/resposta vazia): a área ficava cinza.
Correção em `foto-inicio-dono.tsx`: onLoad com largura 0 = falha; prazo de 8 s (`PRAZO_FOTO_MS`) sem pintar = plano B (espaço desenhado no rascunho; coluna única nas demais). Foto que carrega cancela o prazo.
Teste: `src/components/painel/e787-continue-anuncio-imagem.test.ts` (+ E501 segue verde). Painel do morador/observadora usa o mesmo componente. Sem prova ao vivo (QA).
