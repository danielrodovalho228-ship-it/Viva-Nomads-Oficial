# E691 — a assinatura do laudo fica visível ao avaliador e ao dono

O servidor já emitia o laudo assinado (E648: `assinaturaDoLaudo`, colunas `assinado_por/assinado_em/assinatura_hash/assinatura_termo`) e o
painel do avaliador já tem onde assinar (caixa "assino" em "Revisar e enviar o laudo", `enviarLaudo`). Faltava MOSTRAR o resultado:
- painel do avaliador (`/dashboard/parceiro/avaliacao/[pedido]`) e laudo do dono (`LaudoDono`): "Assinado pelo avaliador em dd/mm/aaaa · laudo VIS-… · registro `abcd1234…ef567890`" (hash completo no `title`).
- `textoAssinatura` (`telas-laudo.ts`): sem hash válido (64 hex) ou sem data, não mostra nada (não inventa).
Atrás de `VISTORIA_ATIVA` (as duas telas só existem com a chave ligada). Sem migração. Teste: `e691-assinatura-visivel.test.ts` (escrito antes, visto vermelho).
Reconciliação completa com o E682 e o E687 em `docs/e682-escolha-do-avaliador.md`.
