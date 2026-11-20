# E751 — motivo falso "Foto tremida ou sem foco" em imagem sólida

Achado (Phoenix, RELATORIO-003, B4): uma imagem sólida de teste (200×200) foi corretamente avisada (foto pequena), mas também recebeu "Foto tremida ou sem foco", falso para um arquivo sem tremor.

Causa: "tremida" vem só da nitidez (variância do laplaciano < 40); uma imagem de uma cor só tem laplaciano 0, então sempre parecia "sem foco".

Correção (`src/lib/fotos/qualidade.ts`, sem migração): a análise ganha `contraste` (desvio-padrão da luminância, `contrasteCinza`, calculado em `processar.ts`). Imagem com contraste abaixo de 4 é **lisa**: não recebe "tremida"; recebe o motivo que a análise sustenta, "Imagem de uma cor só, sem o cômodo." Foto com conteúdo e pouca nitidez continua "tremida"; análise antiga (sem `contraste`) segue a regra de antes. Os avisos continuam só orientando, nunca bloqueando.

Teste: `src/lib/fotos/qualidade.test.ts` (caso E751).
