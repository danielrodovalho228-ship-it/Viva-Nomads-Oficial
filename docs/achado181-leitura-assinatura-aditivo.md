# Achado 181 — assinatura do aditivo: leitura que falha não vira outra resposta

Mesma família do E675 (contrato). Em `estadia-actions.ts`:
- `assinarAditivo` lia `contrato_aditivo_codigos` sem olhar o `error`: a falha virava "Peça o código por e-mail e digite os
  6 números para assinar." mesmo com o código pedido. Agora responde "Não foi possível conferir o código agora. Tente de
  novo." antes de conferir.
- `pedirCodigoAditivo` lia `contrato_aditivo_assinaturas` ("já assinou?") sem olhar o `error`: a falha deixava quem já
  assinou pedir e receber outro código. Agora para antes de gerar o código.

Teste: `src/lib/data/achado181-leitura-assinatura-aditivo.test.ts` (escrito antes, visto vermelho). Sem migração, sem
chave, sem prova ao vivo.
