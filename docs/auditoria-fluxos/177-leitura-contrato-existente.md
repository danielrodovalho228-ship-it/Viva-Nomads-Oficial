# Auditoria 177 — a falha de leitura do contrato existente não vira "não existe" (e não cria outro)

`registrarContrato` lia `contratos` por `lead_id` com `maybeSingle()` sem olhar o `error`: a falha do banco chegava como
`data = null`, a ação concluía "ainda não existe contrato" e seguia para criar um — podendo duplicar o contrato.

Agora confere o erro antes: "Não foi possível conferir o contrato agora. Tente de novo." — nada é criado sem ter lido.

Teste: `src/lib/data/achado177-leitura-contrato-existente.test.ts` (falha sem a correção). Sem migração.

Resta no padrão: um ponto em `actions.ts` (a leitura do motivo da estadia no perfil, de baixo risco), para a próxima rodada.
