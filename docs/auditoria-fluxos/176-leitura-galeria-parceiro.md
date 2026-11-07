# Auditoria 176 — a falha de leitura da foto da galeria não vira "Foto não encontrada"

`removerFotoGaleria` (painel do parceiro) lia a foto com `maybeSingle()` sem olhar o `error`: a falha do banco chegava como
`data = null` e o parceiro lia "Foto não encontrada.", concluindo que a foto já não existia.

Agora a ação confere o erro antes: "Não foi possível ler a foto agora. Tente de novo." — e nada é apagado sem ler.
"Foto não encontrada" só aparece quando a leitura deu certo e a foto não existe.

Teste: `src/lib/parceiros/achado176-leitura-galeria.test.ts` (falha sem a correção). Sem migração.

Restam no padrão: dois pontos em `actions.ts` (próxima rodada, um por PR).
