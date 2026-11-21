# Auditoria 175 — a falha de leitura não vira "não encontrado" (reserva, documento emitido, agente)

Padrão da varredura de erros e estados vazios: uma ação lê um registro com `maybeSingle()` sem olhar o `error`; a falha
do banco chega como `data = null` e a pessoa lê "… não encontrado", concluindo que o registro não existe.

| Ação | Antes | Agora |
|---|---|---|
| `solicitarReserva` (reservas-actions) | "Imóvel não encontrado." | "Não foi possível ler o imóvel agora. Tente de novo." |
| `reenviarEmitido` (emitidos-actions, admin) | "Documento não encontrado." | "Não foi possível ler o documento agora. Tente de novo." |
| ordem ao agente (agentes-actions, admin) | "Agente não encontrado." | "Não foi possível ler o agente agora. Tente de novo." |

"Não encontrado" só aparece quando a leitura deu certo e o registro não existe.

Teste: `src/lib/data/achado175-leitura-reserva-emitido-agente.test.ts` (3; falha sem a correção). Sem migração.

Restam no padrão (próximas rodadas): `painel-actions` (galeria) e dois pontos em `actions.ts`.
