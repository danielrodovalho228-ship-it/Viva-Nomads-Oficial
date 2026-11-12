# E766 — o /admin mostra o backup saudável

Antes: só a FALHA do backup aparecia (linha de alerta em "Precisa da sua atenção"); o estado bom não tinha prova visual, e `/admin/backup` e `/admin/backups` davam 404.

- Novo resumo "Backup" na inicial do /admin (`src/components/admin/resumo-backup.tsx`): "Última cópia OK em …", "Último teste de restauração OK em …" e o selo Em dia / Atenção (com o porquê quando falha). Lê `backups_execucoes` pela mesma função e pelo mesmo estado (`estadoBackup`) do cartão completo de Sistema; sem dado de usuário. O admin observador da QA não vê (como no cartão de Sistema).
- `/admin/backup` e `/admin/backups` redirecionam para o cartão completo (`/admin/sistema#backup`).
- Teste: `src/lib/backup/e766-resumo-admin.test.ts`. Sem migração.
