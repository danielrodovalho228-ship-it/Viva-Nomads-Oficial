# Varredura de erros — rodada 32 (achados 149–152)

Padrão: leitura que falha não pode virar "não encontrado". Cada ponto agora lê o `error`
e devolve "Não foi possível ler … agora. Tente de novo." ANTES do "não encontrado".

| # | Arquivo | Tabela | Antes |
|---|---------|--------|-------|
| 149 | `src/lib/data/estadia-actions.ts` | contratos | falha de leitura → "Contrato não encontrado." |
| 150 | `src/lib/data/servicos-morador-actions.ts` | servicos_pedidos | → "Pedido não encontrado." |
| 151 | `src/lib/data/manutencao-actions.ts` | service_orders | → "Solicitação não encontrada." |
| 152 | `src/lib/parceiros/painel-actions.ts` | parceiro_galeria | → "Foto não encontrada." |

Teste: `src/lib/data/achado149-152-leitura-fluxos.test.ts` (escrito primeiro, visto vermelho 0/4, agora 4/4).

Restam fora desta rodada: `vistoria/actions.ts` (4, VISTORIA_ATIVA desligada), `agentes-actions.ts` (1),
`vistoria/laudo-actions.ts` (1), segundo ponto de `emitidos-actions`.
