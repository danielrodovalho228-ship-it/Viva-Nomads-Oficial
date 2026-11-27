# E766 — reprova de 11/11: "nenhuma exibição de backup no admin em produção"

## Causa
O resumo (`ResumoBackup`, em `/admin`) e o cartão (`CartaoBackup`, em `/admin/sistema#backup`) já existiam desde o #3573. Os dois, porém, eram **escondidos do admin observador da QA** (`profiles.qa_admin`, decisão QA-LOGIN-B v2), e a prova ao vivo usa essa conta. Para ela:
- `/admin` ficava sem a seção de backup;
- `/admin/sistema#backup` era um `div` vazio, sem a palavra "backup". `/admin/backups` redireciona para lá, então a âncora apontava para nada.

Os dados existem em produção (leitura de 12/11):
- `backups_execucoes` tem 25 cópias, a última OK em 11/11 14:34 UTC;
- e 6 testes de restauração, o último OK em 08/11 22:34 UTC.

## Correção
- `/admin`: o resumo aparece para **todo admin**, inclusive o observador.
- `/admin/sistema#backup`: o observador vê o **resumo** de estado: "Em dia"/"Atenção", "Última cópia OK em …", "Último teste de restauração OK em …" e o porquê quando falha. É só leitura e não tem o link "Ver detalhes", que apontaria para a própria seção.
- O **cartão completo** (tamanhos, pasta do Drive, guia de restauração) continua só do admin pleno. O guarda da QA-LOGIN-B v2 (`{observador ? null : <CartaoBackup />}`) não mudou.

## Provas
- **Teste de unidade:** `src/lib/backup/e766-observador-ve-backup.test.ts`. Antes: 3 falhas. Depois: 336 aprovados e 0 falhas, junto com `src/lib/backup`, `src/lib/qa` e `src/lib/admin`.
- **E2E no lab:** o t596 entra como observador pela porta de QA, com 2FA, e confere o resumo em `/admin` e em `#backup`. O t242 confere o cartão do admin. Resultado: 14/14.

## Dúvidas
- A regra QA-LOGIN-B v2 dizia "observador: nunca … backup". Li isso como nenhuma **ação** e nenhum detalhe operacional. O **estado** (datas e verde/vermelho) não tem dado de usuário e é exatamente o que a prova ao vivo precisa ver. Se a regra for "nem o estado", a prova do E766 precisa ser feita com uma conta admin plena.
