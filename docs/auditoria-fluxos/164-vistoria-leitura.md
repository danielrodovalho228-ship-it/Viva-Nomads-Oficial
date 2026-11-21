# Achado 164 — vistoria: falha de leitura virava "não encontrado" (e o PDF do laudo, 404)

**Fluxo:** admin credenciando/descredenciando avaliador e abrindo avaliação de teste; abrir laudo de nova versão; dono/avaliador baixando o PDF do laudo (`src/lib/vistoria/actions.ts`, `laudo-actions.ts`, `laudo-servidor.ts`, `src/app/api/vistoria/laudo/[id]/route.ts`).
**Defeito:** as leituras não olhavam o `error`: "Credenciamento não encontrado.", "O avaliador precisa estar em teste.", "Imóvel não encontrado.", "A avaliação de teste é só em imóvel de conta de teste.", "Pedido não encontrado."; o PDF respondia 404 "Não encontrado." quando a leitura ou o download falhava.
**Correção:** cada leitura destrincha o erro e diz "Não foi possível ler … agora. Tente de novo."; a avaliação de teste agrupa as três leituras antes das regras; o PDF responde 503 em falha de leitura/download e 404 só quando o laudo de fato não existe.
**Teste:** `src/lib/vistoria/achado164-vistoria-leitura.test.ts`.
