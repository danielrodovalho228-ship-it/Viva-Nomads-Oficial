# E697 — fotos repetidas dentro da galeria do anúncio de exemplo (ube-015)

**Causa:** `galleryFor("ube-015", 10)` CICLAVA as 2 fotos reais (ambiente/cozinha) para encher 10 posições — grade de 5 quadros com 2 fotos únicas e foto 4 = foto 2. O mesmo vale para qualquer exemplo com menos fotos reais do que `n`.

**Correção (sem migração):**
1. `galleryFor` não cicla mais: devolve só as fotos **distintas** que existem, até `n`, com a capa primeiro.
2. `fotosUnicas` (`lib/media.ts`) e a `PropertyGallery` deduplicam por endereço na exibição (mosaico, carrossel e lightbox leem a lista única) — vale também para anúncio real que chegue com repetidas. Com 2 a 4 fotos o mosaico já usa o layout "principal + coluna".
3. Guarda: cada exemplo em `PROPERTY_PHOTOS` tem arquivos **distintos por conteúdo** (SHA-256), não só por endereço.

**Dúvida:** o ube-015 tem hoje só 2 fotos distintas (sala/cozinha). Fotos novas do imóvel (arquivos reais) não podem ser criadas por esta pista; quando existirem, basta somar em `PROPERTY_PHOTOS["ube-015"]`. Por ora a galeria mostra 2 fotos, sem repetir.

Testes: `src/lib/e697-fotos-unicas.test.ts`. Sem prova ao vivo.
