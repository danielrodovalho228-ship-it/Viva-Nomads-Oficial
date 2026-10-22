# Resiliência da Viva Nomads — o desenho aprovado

Objetivo: se o Supabase, a conta ou um erro nosso apagar dados, a Viva Nomads **volta**, com um tempo conhecido, e
alguém além do Code sabe fazer isso. Passo a passo de restauração: [RESTAURACAO.md](RESTAURACAO.md).

## As peças

| Peça | O que é | Situação |
|---|---|---|
| 1 | **Supabase Pro**: backups diários do próprio Supabase e mais folga de recursos | **Feita** (19/10) |
| 2 | **Cópia noturna cifrada no Google Drive do Daniel**: banco inteiro + todos os arquivos do Storage, fora do Supabase | **Neste PR** (Resiliência 2) |
| 3 | **Teste de restauração automático toda semana**: cópia sem teste não é garantia | **Neste PR** (Resiliência 2) |
| 4–6 | Demais peças do desenho | Em espera (cada uma vem no seu próprio prompt, quando aprovada) |
| 7 | **2º dono**: outra pessoa com acesso ao cofre (as duas senhas da cópia) e a este passo a passo | Em espera |

## Peças 2 e 3 (este PR)

**Cópia noturna** — Action `Backup noturno` (`.github/workflows/backup-noturno.yml`), 03:15 de Brasília, ou à mão:

1. `pg_dump` 17 (formato custom, sem dono nem privilégios) dos schemas `public`, `auth`, `storage` e
   `supabase_migrations` → `banco/diario/AAAA-MM-DD_HHMM.dump`;
2. todos os buckets do Storage, lidos pelo protocolo S3 com uma chave só do Storage → `storage/atual/`; o que foi
   apagado ou trocado vai para `storage/removidos/AAAA-MM-DD/` (30 dias);
3. manifesto `manifestos/AAAA-MM-DD.json`: tamanho e SHA-256 do dump, linhas por tabela (lidas do próprio dump),
   objetos por bucket, migrações e o resultado das 5 consultas-chave. **Nenhum dado pessoal** (o teste confere);
4. retenção: 14 diárias, 8 semanais (domingo) e 3 mensais (dia 1), regra pura `quaisFicam` em
   `src/lib/backup/retencao.ts`;
5. resultado em `public.backups_execucoes` (migração 0191), que alimenta o cartão do `/admin`.

**Teste de restauração** — Action `Teste de restauração` (`.github/workflows/drill-restauracao.yml`), domingo 09:00
UTC, ou à mão: baixa e decifra o dump mais recente, confere o SHA-256, restaura num Postgres 17 limpo dentro do job
(cronometrado: é o nosso RTO) e roda `scripts/drill/conferir.ts`: migrações = repositório, linhas por tabela =
manifesto, 5 consultas-chave (um contrato com assinaturas e pagamentos, uma conferência com respostas, um imóvel com
fotos, um perfil, uma proposta) e 20 objetos sorteados do Storage baixados, decifrados e comparados com o Supabase.

**Alarme** — falha; dump com menos da metade do anterior; objetos do Storage −20% de uma noite para a outra. Vai
e-mail ao Daniel (Resend, remetente único; destinatário = quem tem "recebe avisos do CEO" no `/admin`) e o cartão
**Backup e recuperação** do `/admin` fica vermelho. Vermelho também se a última cópia tiver mais de 36 h ou o último
teste mais de 8 dias. O motivo nunca leva dado.

### Decisões (e por quê)

- **Drive pessoal com OAuth do próprio Daniel, não "service account"**: a service account não tem cota no Drive de
  uma conta Gmail comum ("Service Accounts do not have storage quota"). O envio usa o **rclone** com um token
  autorizado uma vez pelo Daniel.
- **Escopo `drive.file`**: o rclone só vê e mexe no que ele mesmo criou, nunca no resto do Drive.
- **Cifrado antes de sair**: remoto `crypt` do rclone (conteúdo **e** nomes) com `BACKUP_SENHA_1` e
  `BACKUP_SENHA_2`. No Drive só aparecem arquivos ilegíveis. **Sem as senhas, a cópia não volta.**
- **Storage pelo S3 do Supabase** com chave só do Storage: menos poder que a service_role (que passa por cima de todo
  o RLS). Endpoint `https://esezeutgtycekfosxplk.supabase.co/storage/v1/s3`, região `us-east-1` (não é segredo).
- **Sincronização por tamanho + data do servidor, sem `--checksum`**: o crypt não guarda hash, e com `--checksum` o
  rclone cai para "só tamanho" — um arquivo trocado por outro do mesmo tamanho não seria copiado (o ensaio prova o
  caso). A amostra semanal ainda compara o conteúdo byte a byte.
- **Contagens lidas do próprio dump**: o manifesto descreve exatamente o que está no arquivo, sem corrida com quem
  grava no banco durante a cópia; o teste de restauração exige o mesmo número no restaurado.
- **Segredos**: só em `env:` das Actions, nunca em `echo`; o `rclone.conf` é temporário (permissão 600) e apagado no
  fim, mesmo com falha; o log do rclone vai para um arquivo privado (pode ter nome de arquivo de usuário) e nunca é
  impresso; dos erros do Postgres sai só a primeira linha, sem URL.

### Testes

- Unitários (`npm test`): `src/lib/backup/backup.test.ts` (retenção 14/8/12 com virada de mês e de ano, manifesto sem
  e-mail/CPF/telefone/nome de arquivo, formato dos alarmes, cartão, conferência) e `src/lib/backup/workflows.test.ts`
  (quando as Actions rodam e que nenhum segredo vai para o log).
- **Ensaio do pipeline** no PR (`.github/workflows/backup-ensaio.yml` → `scripts/backup/ensaio.sh`): Postgres 17 de
  teste + MinIO + remoto **local** do rclone no lugar do Drive, com o crypt de verdade e senhas geradas na hora. Roda
  a cópia (2×), prova que o "Drive" só tem nomes e conteúdo cifrados e que a retenção podou, roda o teste de
  restauração e dois casos de falha de propósito (dump corrompido; cifra adulterada) → vermelho e alarme montado,
  sem enviar e-mail.
- E2E do cartão: `tests/e2e/specs/t242-backup-admin.spec.ts` (laboratório, 390 e 1280 px).

### Espaço

Hoje uma cópia completa tem cerca de 70 MB (banco ~33 MB + arquivos ~35 MB). Com a retenção cabe com folga nos 15 GB
grátis do Google. O cartão do `/admin` mostra o total usado na pasta e, acima de 10 GB, sugere avaliar o Google One.

## Passo do Daniel (uma vez, depois do merge)

Detalhado em [RESTAURACAO.md › Parte A](RESTAURACAO.md#parte-a--ligar-a-cópia-uma-vez-só-depois-que-o-pr-for-mesclado).
Resumo, em ~20 minutos:

1. **Google Cloud**: projeto "viva-nomads-backup", Google Drive API ativada, tela de consentimento *Externo*
   "Viva Nomads Backup", **publicada em "Em produção"** (em "Teste" o token expira em 7 dias), ID do cliente OAuth
   *App para computador*.
2. **PowerShell**: `winget install Rclone.Rclone`; `rclone config` (remoto `drive`, scope `drive.file`, auto config);
   `rclone mkdir drive:VivaNomads-Backup`; `rclone config show drive` → o bloco vai para o segredo `RCLONE_DRIVE_CONF`.
3. **Supabase**: chave de acesso S3 (*Project Settings › Storage › S3 Connection*).
4. **GitHub** (*Settings › Environments › backup-producao*): `RCLONE_DRIVE_CONF`, `BACKUP_SENHA_1`, `BACKUP_SENHA_2`
   (**guardar no cofre antes**), `SUPABASE_S3_ACCESS_KEY_ID`, `SUPABASE_S3_SECRET_ACCESS_KEY`, `RESEND_API_KEY`
   (`SUPABASE_DB_URL` já existe; `AVISO_DANIEL_EMAIL` é opcional).
5. **Rodar**: *Actions › Backup noturno › Run workflow*; depois *Teste de restauração › Run workflow*.
6. **Conferir**: no Drive, `VivaNomads-Backup` com nomes ilegíveis; o cartão do `/admin` verde nos dois.

**Pronto quando**: 1ª cópia real no Drive; 1º teste de restauração verde, com a duração anotada; cartão do admin
verde. O Muse confere os três e registra as peças 2 e 3 como feitas.
