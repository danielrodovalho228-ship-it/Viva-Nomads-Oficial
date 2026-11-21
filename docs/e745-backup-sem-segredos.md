# E745 — backup noturno e restore falham: segredos do ambiente `backup-producao` vazios (08/11/2026)

## Resumo
A cópia noturna **não está sendo feita** e o restore **nunca foi provado**. A causa NÃO é de código: o passo
"Montar o rclone.conf temporário (600) com o remoto cifrado" (`scripts/backup/montar-rclone.sh`) para de propósito, porque
**cinco dos segredos do ambiente `backup-producao` chegam vazios** ao job. O script está certo (ele mesmo lista o que falta).

## Evidência (logs do GitHub Actions, só leitura)
- **Backup noturno** (`backup-noturno.yml`): as **19 execuções agendadas falharam**, da nº 1 (21/10/2026) à nº 19 (08/11/2026, run 42485195051). Nenhuma passou.
- **Teste de restauração** (`drill-restauracao.yml`): as **3 execuções agendadas falharam** (25/10, 01/11 e 08/11; run 42497108612). Nunca houve restore.
- Nas duas, o passo `montar-rclone.sh` imprime o ambiente com os cinco valores em branco e termina com:
  `Faltam segredos no ambiente backup-producao: RCLONE_DRIVE_CONF BACKUP_SENHA_1 BACKUP_SENHA_2 SUPABASE_S3_ACCESS_KEY_ID SUPABASE_S3_SECRET_ACCESS_KEY`
- No mesmo job, `SUPABASE_DB_URL` chega preenchido (aparece mascarado), então o ambiente é lido; só os outros cinco estão ausentes.
- O alarme também não sai: `RESEND_API_KEY` e `AVISO_DANIEL_EMAIL` chegam vazios (`Alarme do backup NÃO enviado: falta o segredo RESEND_API_KEY`). A falha só aparece no cartão "Backup e recuperação" do `/admin` e no e-mail padrão do GitHub para falhas de Action.

## O que NÃO é a causa
- Nome do remoto, formato do config e ordem dos passos: o script monta `[drive]`, `[cripto]` e `[s3supabase]` corretamente quando os segredos existem e valida o bloco `[drive]` e o tamanho das senhas (20+). Não chega a essa parte.
- Ferramentas: `rclone v1.71.2` e `pg_dump 17.11` instalam normalmente no mesmo job.
- O ensaio de CI (`backup-ensaio.yml`) usa um remoto local e S3 de teste, sem segredos reais: continua válido para testar o código, mas não prova a cópia de verdade.

## O que falta (só o Daniel tem; nada foi inventado nem alterado)
No GitHub › Settings › Environments › **backup-producao** (ou, se preferir, segredos do repositório), cadastrar:

| Segredo | Quem gera | Observação |
|---|---|---|
| `RCLONE_DRIVE_CONF` | Daniel, no PC (`rclone config show drive`) | bloco que começa com `[drive]`, com o token OAuth dele (escopo `drive.file`); app do Google Cloud em "Em produção" |
| `BACKUP_SENHA_1` | Daniel (cofre de senhas) | 20+ caracteres; guardar no cofre ANTES de cadastrar: sem as duas senhas a cópia não volta |
| `BACKUP_SENHA_2` | Daniel (cofre de senhas) | 20+ caracteres, diferente da primeira |
| `SUPABASE_S3_ACCESS_KEY_ID` | Supabase › Project Settings › Storage › S3 Connection | chave só do Storage |
| `SUPABASE_S3_SECRET_ACCESS_KEY` | idem | idem |
| `RESEND_API_KEY` | a mesma do Resend na Vercel | para o e-mail de alarme (hoje não sai) |
| `AVISO_DANIEL_EMAIL` | opcional | só se ninguém tiver "recebe avisos do CEO" ligado no `/admin` |

Passo a passo completo: `docs/RESTAURACAO.md`, Parte A (A1 a A4).
Se os segredos já foram cadastrados, a hipótese a conferir é o **escopo**: segredo criado no repositório vs. no ambiente `backup-producao` (o job declara `environment: backup-producao`; um segredo de ambiente com outro nome do ambiente, ou cadastrado só em "Dependabot"/"Codespaces", não chega ao job).

## Depois de cadastrar
1. Rodar **Backup noturno** à mão (workflow_dispatch) e conferir o cartão do `/admin`.
2. Rodar **Teste de restauração** à mão: é ele que prova que a cópia volta. Só então o item "restore provado" fecha.
Esta pista não tem como fazer isso (não tem os segredos e não faz prova ao vivo).
