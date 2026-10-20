/*
  Resiliência 2 — as Actions e os scripts da cópia noturna e do teste de restauração: quando rodam, onde, e que
  nenhum segredo, dado ou nome de arquivo vai para o log.
  Roda: node --test src/lib/backup/workflows.test.ts
*/
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const raiz = (p: string) => readFileSync(new URL(`../../../${p}`, import.meta.url), "utf8");
const SEGREDOS = ["SUPABASE_DB_URL", "RCLONE_DRIVE_CONF", "BACKUP_SENHA_1", "BACKUP_SENHA_2", "SUPABASE_S3_ACCESS_KEY_ID", "SUPABASE_S3_SECRET_ACCESS_KEY", "RESEND_API_KEY", "AVISO_DANIEL_EMAIL"];

function comumAsDuas(wf: string, nome: string) {
  assert.match(wf, /workflow_dispatch:/, nome);
  assert.doesNotMatch(wf, /pull_request/, `${nome}: PR nunca roda`);
  assert.match(wf, /if: github\.repository == 'danielrodovalho228-ship-it\/Viva-Nomads-Oficial'/, `${nome}: fork nunca roda`);
  assert.match(wf, /concurrency:\n\s+group: backup-producao\n\s+cancel-in-progress: false/, nome);
  assert.match(wf, /environment: backup-producao/, nome);
  assert.match(wf, /permissions:\n\s+contents: read/, nome);
  // Segredo só como `NOME: ${{ secrets.NOME }}` dentro de env:, nunca em run: nem em echo.
  for (const m of wf.matchAll(/\$\{\{\s*secrets\.([A-Z0-9_]+)\s*\}\}/g)) {
    const linha = wf.slice(wf.lastIndexOf("\n", m.index) + 1, wf.indexOf("\n", m.index));
    assert.match(linha, new RegExp(`^\\s+${m[1]}: \\$\\{\\{ secrets\\.${m[1]} \\}\\}$`), `${nome}: ${m[1]} fora de env:`);
  }
  assert.doesNotMatch(wf, /echo[^\n]*\$\{?(SUPABASE_DB_URL|RCLONE_DRIVE_CONF|BACKUP_SENHA|SUPABASE_S3|RESEND_API_KEY)/, nome);
  assert.match(wf, /bash scripts\/backup\/instalar-ferramentas\.sh/, nome);
  assert.match(wf, /bash scripts\/backup\/montar-rclone\.sh/, nome);
  // Registro/alarme e limpeza rodam mesmo com falha.
  assert.match(wf, /- name: Registrar no admin e alarmar\n\s+if: always\(\)/, nome);
  assert.match(wf, /- name: Apagar o rclone\.conf e os arquivos temporários\n\s+if: always\(\)\n\s+run: bash scripts\/backup\/limpar\.sh/, nome);
}

test("Backup noturno: 03:15 de Brasília + à mão, nunca em PR nem fork, segredos só em env", () => {
  const wf = raiz(".github/workflows/backup-noturno.yml");
  assert.match(wf, /schedule:\n\s+- cron: "15 6 \* \* \*"/);
  comumAsDuas(wf, "backup-noturno");
  assert.match(wf, /run: bash scripts\/backup\/copia\.sh/);
  assert.match(wf, /run: bash scripts\/backup\/finalizar\.sh copia/);
  for (const s of SEGREDOS) assert.match(wf, new RegExp(`secrets\\.${s}\\b`), s);
});

test("Teste de restauração: domingo 09:00 UTC + à mão, postgres:17 no job, mesmo ambiente", () => {
  const wf = raiz(".github/workflows/drill-restauracao.yml");
  assert.match(wf, /schedule:\n\s+- cron: "0 9 \* \* 0"/);
  comumAsDuas(wf, "drill-restauracao");
  assert.match(wf, /image: postgres:17\n/);
  assert.match(wf, /run: bash scripts\/drill\/drill\.sh/);
  assert.match(wf, /run: bash scripts\/backup\/finalizar\.sh drill/);
});

test("Ensaio: roda em PR, sem nenhum segredo, com Postgres 17 e MinIO de teste", () => {
  const wf = raiz(".github/workflows/backup-ensaio.yml");
  assert.match(wf, /on:\n\s+pull_request:\n\s+paths:/);
  assert.doesNotMatch(wf, /secrets\./);
  assert.doesNotMatch(wf, /environment:/);
  assert.match(wf, /image: postgres:17\n/);
  assert.match(wf, /minio\/minio:RELEASE\.[0-9TZ-]+ server/);
  assert.match(wf, /bash scripts\/backup\/ensaio\.sh/);
});

test("scripts: rclone fixo e conferido, conf 600, log do rclone só em arquivo, pg_dump 17 custom dos 4 schemas", () => {
  const instalar = raiz("scripts/backup/instalar-ferramentas.sh");
  assert.match(instalar, /RCLONE_VERSAO="\d+\.\d+\.\d+"/);
  assert.match(instalar, /RCLONE_SHA256="[0-9a-f]{64}"/);
  assert.match(instalar, /sha256sum -c/);
  assert.match(instalar, /postgresql-client-17/);

  const comum = raiz("scripts/backup/comum.sh");
  assert.match(comum, /umask 077/);
  assert.match(comum, /rc\(\) \{ "\$RCLONE" --config "\$RCLONE_CONFIG" --log-file "\$RLOG" --log-level NOTICE --stats 0 "\$@"; \}/);

  const montar = raiz("scripts/backup/montar-rclone.sh");
  assert.match(montar, /chmod 600 "\$RCLONE_CONFIG"/);
  assert.match(montar, /printf '%s' "\$BACKUP_SENHA_1" \| "\$RCLONE" obscure -/, "senha pela entrada padrão, nunca em argumento");
  assert.match(montar, /type = crypt/);
  assert.match(montar, /filename_encryption = standard\\ndirectory_name_encryption = true/);
  assert.match(montar, /esezeutgtycekfosxplk\.supabase\.co\/storage\/v1\/s3/);

  const copia = raiz("scripts/backup/copia.sh");
  assert.match(copia, /--format=custom --no-owner --no-privileges/);
  for (const s of ["public", "auth", "storage", "supabase_migrations"]) assert.match(copia, new RegExp(`--schema=${s}\\b`));
  assert.match(copia, /banco\/diario\/\$DUMP/);
  assert.match(copia, /rc sync s3supabase: "\$DESTINO\/storage\/atual\/"/);
  assert.match(copia, /--backup-dir "\$DESTINO\/storage\/removidos\/\$HOJE\/"/);
  assert.match(copia, /--fast-list --use-server-modtime --transfers 4/);
  assert.match(copia, /manifestos\/\$HOJE\.json/);

  const limpar = raiz("scripts/backup/limpar.sh");
  assert.match(limpar, /shred -u "\$TRAB\/rclone\.conf"/);
  assert.match(limpar, /rm -rf "\$TRAB"/);

  for (const f of ["comum.sh", "montar-rclone.sh", "copia.sh", "finalizar.sh", "limpar.sh", "instalar-ferramentas.sh", "ensaio.sh"].map((n) => `scripts/backup/${n}`).concat("scripts/drill/drill.sh")) {
    const sh = raiz(f);
    assert.doesNotMatch(sh, /set -x|set -o xtrace/, f);
    assert.doesNotMatch(sh, /echo[^\n]*\$\{?(SUPABASE_DB_URL|RCLONE_DRIVE_CONF|BACKUP_SENHA_[12]|SUPABASE_S3_SECRET_ACCESS_KEY|RESEND_API_KEY|AVISO_DANIEL_EMAIL)\b/, f);
    // Toda chamada do rclone de produção passa pelo rc() (log só em arquivo) e nenhuma usa -v.
    assert.doesNotMatch(sh, /(^|\s)rc [^\n]*\s-v{1,2}\b/m, f);
  }
});
