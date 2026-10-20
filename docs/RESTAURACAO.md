# Restauração da Viva Nomads a partir da cópia cifrada

Este é o passo a passo para o **Daniel** (ou o **2º dono**) trazer a Viva Nomads de volta **sem depender do Code**,
usando a cópia noturna cifrada que fica no Google Drive.

> **Sem as duas senhas, a cópia não volta.** O conteúdo e os nomes dos arquivos no Drive são cifrados com
> `BACKUP_SENHA_1` e `BACKUP_SENHA_2`. Elas ficam no **cofre de senhas do Daniel** (e com o 2º dono, quando a
> peça 7 for aprovada) e nos segredos do GitHub. Ninguém, nem o Google, nem o Code, recupera uma senha perdida.

Como funciona, em uma frase: toda noite, às 03:15 de Brasília, a Action **Backup noturno** copia o banco inteiro e
todos os arquivos do Storage para a pasta `VivaNomads-Backup` do Drive, já cifrados. Todo domingo a Action **Teste de
restauração** baixa a cópia mais recente, restaura num banco de teste e confere se está tudo lá. O resultado das duas
aparece no cartão **Backup e recuperação** do `/admin`. O desenho completo está em [RESILIENCIA.md](RESILIENCIA.md).

---

## Parte A — Ligar a cópia (uma vez só, depois que o PR for mesclado)

Leva uns 20 minutos. Só o Daniel faz, porque usa o login dele no Google.

### A1. Google Cloud (uma vez)

1. Em **console.cloud.google.com**, crie o projeto **viva-nomads-backup**.
2. Em *APIs e serviços*, **ative a Google Drive API**.
3. Na **tela de consentimento OAuth**: tipo **Externo**; nome **Viva Nomads Backup**; usuário de teste: a conta
   Google do Daniel.
4. **Publique o app em "Em produção".** Isto é obrigatório: em "Teste", o token expira em 7 dias e a cópia para
   sozinha. Para um app pessoal com o escopo `drive.file`, publicar não exige a verificação do Google.
5. Crie um **ID do cliente OAuth** do tipo **App para computador**. Anote o **ID** e a **chave secreta**
   (guarde os dois no cofre: servem também para restaurar).

### A2. rclone no PC do Daniel (PowerShell)

1. `winget install Rclone.Rclone`
2. `rclone config` → **n** (novo remoto) → nome **`drive`** → tipo **`drive`** → cole o ID e a chave do passo A1 →
   **scope = `drive.file`** → *auto config* = **sim**. O navegador abre: entre com a conta Google do Daniel e autorize.
3. `rclone mkdir drive:VivaNomads-Backup`
4. `rclone config show drive` mostra o bloco do remoto (começa com `[drive]`). **O próprio Daniel** copia esse bloco
   inteiro para o segredo `RCLONE_DRIVE_CONF` do passo A4. (Ele contém o token: não cole em chat nem em e-mail.)

### A3. Supabase

Em *Project Settings › Storage › S3 Connection*, gere uma **chave de acesso S3**. Anote o **ID** e o **segredo**.
(É uma chave só do Storage, com menos poder que a service_role.)

### A4. GitHub

Em *Settings › Environments › **backup-producao*** (o ambiente é criado pelo PR; se não aparecer, crie com esse
nome), cadastre os segredos:

| Segredo | O que é |
|---|---|
| `RCLONE_DRIVE_CONF` | o bloco `[drive]` do passo A2 |
| `BACKUP_SENHA_1` | senha longa (20+ caracteres) gerada no cofre. **Guarde no cofre antes.** |
| `BACKUP_SENHA_2` | outra senha longa, diferente da primeira. **Guarde no cofre antes.** |
| `SUPABASE_S3_ACCESS_KEY_ID` | o ID do passo A3 |
| `SUPABASE_S3_SECRET_ACCESS_KEY` | o segredo do passo A3 |
| `SUPABASE_DB_URL` | **já existe** (é o da Action de migrações); se estiver só nos segredos do repositório, vale também aqui |
| `RESEND_API_KEY` | a mesma chave do Resend da Vercel (para o e-mail de alarme) |
| `AVISO_DANIEL_EMAIL` | opcional: só se ninguém tiver "recebe avisos do CEO" ligado no `/admin` |

### A5. Primeira cópia e primeiro teste

1. *Actions › **Backup noturno** › Run workflow*. Espere ficar verde.
2. *Actions › **Teste de restauração** › Run workflow*. Espere ficar verde e **anote a duração** que ele mostra
   (é o primeiro número real de quanto tempo leva para voltar).

### A6. Conferir

- No Drive, a pasta `VivaNomads-Backup` tem arquivos e pastas com **nome ilegível**. É a cifra: está certo.
- O cartão **Backup e recuperação** do `/admin` fica **verde** nos dois blocos.

---

## Parte B — Restaurar (no dia em que precisar)

Você vai precisar de: as duas senhas do cofre; o ID e a chave secreta do OAuth (A1) **ou** a conta Google do Daniel;
um computador com internet; uns 30 a 60 minutos.

### B1. Instalar as ferramentas

- **rclone**: Windows `winget install Rclone.Rclone`; Mac `brew install rclone`; Linux `sudo -v ; curl https://rclone.org/install.sh | sudo bash`.
- **PostgreSQL 17** (só as ferramentas `pg_restore` e `psql`): Windows, o instalador do postgresql.org (marque só
  "Command Line Tools"); Mac `brew install postgresql@17`; Linux `apt install postgresql-client-17` (repositório PGDG).

### B2. Recriar o acesso ao Drive e o remoto cifrado

1. `rclone config` → **n** → nome **`drive`** → tipo **`drive`** → cole o **mesmo** ID e chave do OAuth (A1) →
   scope **`drive.file`** → autorize com a conta Google do Daniel.
   - Sem o ID e a chave do A1, escolha **scope = `drive`** (acesso de leitura a tudo): o `drive.file` só enxerga o
     que foi criado pelo mesmo app.
2. `rclone config` → **n** → nome **`cripto`** → tipo **`crypt`** → remote = **`drive:VivaNomads-Backup`** →
   *filename_encryption* = **standard** → *directory_name_encryption* = **true** → "digitar minha própria senha":
   **BACKUP_SENHA_1** → *password2* (salt): "digitar minha própria": **BACKUP_SENHA_2**.
3. Teste: `rclone lsd cripto:VivaNomads-Backup` deve listar **banco**, **manifestos** e **storage** com nomes
   legíveis. Se aparecer erro de senha ou nomes estranhos, as senhas estão erradas.

### B3. Baixar o banco

1. Veja os manifestos: `rclone lsf cripto:VivaNomads-Backup/manifestos/` — o mais recente é o último da lista.
2. Leia o manifesto: `rclone cat cripto:VivaNomads-Backup/manifestos/AAAA-MM-DD.json` — o campo `dump.arquivo` diz
   o nome do dump e `dump.sha256` o hash.
3. Baixe o dump (procure em `diario`, depois `semanal`, depois `mensal`):
   `rclone copy cripto:VivaNomads-Backup/banco/diario/AAAA-MM-DD_HHMM.dump .`
4. Confira o hash: Windows `certutil -hashfile AAAA-MM-DD_HHMM.dump SHA256`; Mac/Linux `shasum -a 256 …`.
   Tem de ser igual ao `dump.sha256` do manifesto.

### B4. Restaurar num projeto Supabase novo

1. Crie um projeto novo no Supabase (Postgres 17, mesma região). Em *Connect*, copie a **connection string**
   (Session pooler ou direta) e guarde numa variável, sem colar em lugar nenhum:
   - Mac/Linux: `export NOVA_URL='postgresql://…'` · Windows (PowerShell): `$env:NOVA_URL='postgresql://…'`
2. Num projeto novo os schemas `auth` e `storage` já existem: deles vão **só os dados**. O `public` e o
   `supabase_migrations` vão inteiros. Rode, nesta ordem (no Windows, troque `"$NOVA_URL"` por `$env:NOVA_URL`):
   ```
   PGOPTIONS="-c session_replication_role=replica" pg_restore --no-owner --no-privileges --data-only --schema=auth --schema=storage --dbname "$NOVA_URL" AAAA-MM-DD_HHMM.dump
   PGOPTIONS="-c session_replication_role=replica" pg_restore --no-owner --no-privileges --schema=public --schema=supabase_migrations --dbname "$NOVA_URL" AAAA-MM-DD_HHMM.dump
   ```
   Um aviso "schema public already exists" é normal. No Windows (PowerShell), em vez do `PGOPTIONS=…` na frente,
   rode antes `$env:PGOPTIONS='-c session_replication_role=replica'`. Se o pooler recusar a opção, use a conexão
   **direta** (Direct connection) do projeto.
3. Gatilhos e políticas que o app criou nas tabelas de `auth` e `storage` (ex.: regras de quem lê qual arquivo):
   ```
   pg_restore -l AAAA-MM-DD_HHMM.dump | grep -E "(TRIGGER|POLICY) (auth|storage) " > extras.txt
   pg_restore --no-owner --no-privileges -L extras.txt --dbname "$NOVA_URL" AAAA-MM-DD_HHMM.dump
   ```
4. Conferência rápida (só números): `psql "$NOVA_URL" -c "select count(*) from public.properties"` e compare com
   `tabelas."public.properties"` do manifesto.

### B5. Devolver os arquivos aos buckets

1. No projeto novo, gere uma chave S3 (*Project Settings › Storage › S3 Connection*).
2. `rclone config` → **n** → nome **`s3novo`** → tipo **`s3`** → provider **Other** → *endpoint*
   `https://<ref-do-projeto-novo>.supabase.co/storage/v1/s3` → *region* a do projeto → cole a chave e o segredo.
3. Copie: `rclone copy cripto:VivaNomads-Backup/storage/atual/ s3novo: --transfers 4 --progress`
   (os buckets já vieram com o banco; cada pasta de `storage/atual/` é um bucket).
4. Se o Supabase recusar porque o objeto "já existe", apague só os registros de arquivos e repita o passo 3:
   `psql "$NOVA_URL" -c "delete from storage.objects"`.
5. Algo apagado ou trocado nos últimos 30 dias está em `cripto:VivaNomads-Backup/storage/removidos/AAAA-MM-DD/`.

### B6. Apontar um preview da Vercel para o projeto novo

Na Vercel, em *Settings › Environment Variables*, crie as variáveis **só para Preview** e **só para um branch**
(ex.: `restauracao`): `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY` e `SUPABASE_SERVICE_ROLE_KEY` do
projeto novo. Faça um deploy desse branch. **Não mexa nas variáveis de produção** até o teste de fumaça passar.

### B7. Teste de fumaça (no preview)

- [ ] Entrar como admin e abrir o `/admin` (os números aparecem).
- [ ] Abrir a busca e um anúncio de imóvel mobiliado **com fotos**.
- [ ] Abrir um contrato com assinaturas e uma conferência com respostas.
- [ ] Abrir um perfil e uma proposta.
- [ ] Enviar uma foto nova (o Storage aceita gravação).

### B8. Anote o tempo (é o nosso RTO real)

| Etapa | Início | Fim | Observação |
|---|---|---|---|
| B1–B2 ferramentas e acesso |  |  |  |
| B3 baixar o banco |  |  |  |
| B4 restaurar o banco |  |  |  |
| B5 arquivos |  |  |  |
| B6–B7 preview e fumaça |  |  |  |
| **Total** |  |  |  |

Data da restauração: ____/____/______ · Quem fez: ______________ · Cópia usada (AAAA-MM-DD_HHMM): ______________

---

## O que fica onde (no Drive, depois de decifrado)

```
VivaNomads-Backup/
  banco/diario/AAAA-MM-DD_HHMM.dump     14 últimos dias
  banco/semanal/…                        8 últimos domingos
  banco/mensal/…                         12 últimos dias 1
  manifestos/AAAA-MM-DD.json             tamanho, hash, linhas por tabela, objetos por bucket, migrações (sem dado pessoal)
  storage/atual/<bucket>/…               espelho de todos os buckets
  storage/removidos/AAAA-MM-DD/…         o que foi apagado ou trocado naquela noite (30 dias)
```

## Se o alarme chegar

O e-mail **"Alarme do backup"** diz o que aconteceu e traz o link da execução no GitHub. Abra, veja a etapa que
falhou e rode de novo (*Run workflow*). Causas comuns: token do Google expirado (o app voltou para "Teste": publique
de novo em "Em produção" e refaça A2 e o segredo `RCLONE_DRIVE_CONF`); chave S3 revogada (refaça A3); senha do banco
trocada (atualize `SUPABASE_DB_URL`). O cartão do `/admin` fica vermelho até a próxima execução verde.
