# Achado 167 — documento fiscal, conferência de documento e resposta a pedido: falha de leitura virava "não encontrado/disponível"

**Fluxo:** baixar o documento fiscal (`/api/documentos/[id]`); conferir documento do imóvel (`/api/documentos/conferir`); proprietário respondendo a um pedido de moradia (`src/lib/data/pedidos-actions.ts`).
**Defeito:** leituras sem olhar o `error`: 404 "Documento não encontrado.", 404 "Imóvel não encontrado.", e "Pedido não está mais disponível." / "Selecione um imóvel seu." com o banco falhando (o dono podia desistir de um pedido válido).
**Correção:** as rotas respondem 503 com "Não foi possível … agora. Tente de novo." e as ações dizem a mesma frase; 404/"indisponível" só quando a leitura funcionou e não há registro.
**Teste:** `src/lib/data/achado167-documento-pedido-leitura.test.ts`.
