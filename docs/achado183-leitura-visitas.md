# Achado 183 — visitas: leitura que falha não vira "não encontrado"

Em `visitas-video-actions.ts`:
- `pedirVisita` lia o imóvel sem olhar o `error`: a falha virava "Imóvel não encontrado ou indisponível." e a pessoa
  desistia da visita.
- `responderVisita` lia o pedido (`visitas_video`) sem olhar o `error`: a falha virava "Pedido não encontrado." para o dono
  ou o morador que ia aceitar, recusar ou remarcar.

Agora cada leitura com erro responde "Não foi possível ler o imóvel/pedido agora. Tente de novo." antes de qualquer
"não encontrado".

Teste: `src/lib/data/achado183-leitura-visitas.test.ts` (escrito antes, visto vermelho; sem a correção volta a falhar).
Sem migração, sem chave, sem prova ao vivo.
