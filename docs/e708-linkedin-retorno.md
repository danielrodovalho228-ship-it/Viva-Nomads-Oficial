# E708 — rotas de retorno do LinkedIn apontavam para a página antiga (L-106)

**Defeito:** o E66 moveu a lista de vínculos (inclusive a linha do LinkedIn e o aviso `?linkedin=…`) de `/dashboard/conta/privacidade` para `/dashboard/conta/seguranca`. As rotas do fluxo continuaram voltando para Privacidade, onde a linha e o aviso não existem.

**Correção (sem migração):** fonte única `ROTA_CONTA_LINKEDIN` (`src/lib/linkedin/rotas.ts`) = `/dashboard/conta/seguranca`, usada por `/api/conta/linkedin/conectar`, `/api/conta/linkedin/retorno` (incluindo o `next` do login) e pelo aviso push `linkedin_vencendo` do cron.

**Varredura:** no código do fluxo do LinkedIn (`api/conta/linkedin`, `api/cron/linkedin`, `lib/linkedin`) não resta nenhuma referência à rota antiga (guarda no teste). Fora do fluxo, `/dashboard/conta/privacidade` continua sendo uma página válida e é referenciada de propósito (menu da Conta, "Seus dados", ocultar o chat da Viva); não foram tocadas.

**Specs de lab:** `t323` e `t351` deixam de contornar o retorno (anotação L-56) e passam a exigir que a volta caia em Segurança.

Teste: `src/lib/linkedin/e708-rotas-de-retorno.test.ts` (visto vermelho antes). Sem prova ao vivo.
