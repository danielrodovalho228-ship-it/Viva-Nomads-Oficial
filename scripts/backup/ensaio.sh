#!/usr/bin/env bash
# Resiliência 2 — ENSAIO do pipeline (CI do PR; também roda local). Sem Drive real, sem banco real:
#  • Postgres 17 de teste no lugar do Supabase (banco "fonte" com scripts/backup/ensaio/fonte.sql + a migração 0191);
#  • um S3 de teste (MinIO no CI) no lugar do Storage do Supabase;
#  • um remoto LOCAL do rclone no lugar do Google Drive, com o crypt REAL e senhas de teste geradas agora.
# Roda a cópia (2×, para provar o --backup-dir), prova que o "Drive" só tem nomes e conteúdo cifrados e que a
# retenção podou, roda o teste de restauração (verde) e dois casos de falha de propósito (dump corrompido; cifra
# adulterada) → vermelho e alarme montado, sem enviar e-mail.
#
# Variáveis: ENSAIO_PG_URL (superusuário, banco "postgres"), S3_ENDPOINT, ENSAIO_S3_CHAVE, ENSAIO_S3_SEGREDO,
#            PG_BIN e RCLONE_BIN (opcionais), ENSAIO_DIR (opcional).
# As verificações vão entre aspas simples de propósito: são avaliadas depois, por confere().
# shellcheck disable=SC2016
set -euo pipefail
umask 077
AQUI="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
RAIZ="$(cd "$AQUI/../.." && pwd)"
: "${ENSAIO_PG_URL:?Falta ENSAIO_PG_URL}"
: "${S3_ENDPOINT:?Falta S3_ENDPOINT}"
: "${ENSAIO_S3_CHAVE:?Falta ENSAIO_S3_CHAVE}"
: "${ENSAIO_S3_SEGREDO:?Falta ENSAIO_S3_SEGREDO}"
E="${ENSAIO_DIR:-$(mktemp -d)}"
mkdir -p "$E"
chmod 700 "$E"
export PG_BIN="${PG_BIN:-/usr/lib/postgresql/17/bin}"
export PSQL="${PSQL:-$PG_BIN/psql}"
export NODE_OPTIONS="${NODE_OPTIONS:-} --disable-warning=MODULE_TYPELESS_PACKAGE_JSON"
RCLONE="${RCLONE_BIN:-rclone}"
export RCLONE_BIN="$RCLONE"

export BACKUP_TRAB="$E/trab"
DRIVE="$E/drive-falso"
SAIDA="$E/saida.log" # tudo o que a cópia/teste imprimem: o ensaio procura dado aqui também
: >"$SAIDA"
mkdir -p "$DRIVE/VivaNomads-Backup"
BASE="${ENSAIO_PG_URL%/*}"
export SUPABASE_DB_URL="$BASE/fonte"
export DRILL_ADMIN_URL="$ENSAIO_PG_URL"
export RCLONE_DRIVE_CONF=$'[drive]\ntype = local'
export BACKUP_CRIPTO_BASE="drive:$DRIVE/VivaNomads-Backup"
export S3_ENDPOINT S3_REGION="${S3_REGION:-us-east-1}"
export SUPABASE_S3_ACCESS_KEY_ID="$ENSAIO_S3_CHAVE" SUPABASE_S3_SECRET_ACCESS_KEY="$ENSAIO_S3_SEGREDO"
BACKUP_SENHA_1="ensaio-$(openssl rand -hex 24)"
BACKUP_SENHA_2="ensaio-$(openssl rand -hex 24)"
export BACKUP_SENHA_1 BACKUP_SENHA_2
export ALARME_SIMULAR=1
unset RESEND_API_KEY AVISO_DANIEL_EMAIL

ok=0
falhas=0
passou() {
  ok=$((ok + 1))
  echo "  ✔ $1"
}
falhou() {
  falhas=$((falhas + 1))
  echo "  ✘ $1"
}
confere() { if eval "$2"; then passou "$1"; else falhou "$1"; fi; }
psqlf() { "$PSQL" "$SUPABASE_DB_URL" -X -q -At -v ON_ERROR_STOP=1 "$@"; }
rcl() { "$RCLONE" --config "$BACKUP_TRAB/rclone.conf" --log-file "$E/rclone-ensaio.log" "$@"; }

echo "== 1. Banco de teste (Postgres 17) e storage de teste (S3)"
"$PSQL" "$ENSAIO_PG_URL" -X -q -v ON_ERROR_STOP=1 -c "drop database if exists fonte" -c "create database fonte template template0" >/dev/null
psqlf -f "$AQUI/ensaio/fonte.sql" >/dev/null
psqlf -f "$RAIZ/supabase/migrations/0191_backups_execucoes.sql" >/dev/null
# As migrações do repositório registradas como em produção (o teste confere repositório = backup).
for f in "$RAIZ"/supabase/producao/aplicar-[0-9][0-9][0-9][0-9].sql; do
  n="$(basename "$f" .sql)"
  n="${n#aplicar-}"
  nome="$(grep -oE "'${n}_[a-z0-9_]+'" "$f" | head -1 | tr -d "'")"
  [ -n "$nome" ] && psqlf -c "insert into supabase_migrations.schema_migrations (version, name, created_by) values ('2026101900$n', '$nome', 'ensaio@exemplo.com') on conflict do nothing"
done
echo "  fonte: $(psqlf -c "select count(*) from supabase_migrations.schema_migrations") migrações, $(psqlf -c "select count(*) from public.properties") imóveis"

bash "$AQUI/montar-rclone.sh" >>"$SAIDA" 2>&1
for b in avatars property-photos documentos; do rcl mkdir "s3supabase:$b"; done
OBJ=0
for i in $(seq 1 8); do
  printf 'TEXTO-EM-CLARO-ENSAIO avatar %s maria.ensaio@exemplo.com\n' "$i" | rcl rcat "s3supabase:avatars/00000000-0000-4000-8000-00000000000$((i % 3 + 1))/maria-silva-rg-$i.jpg"
  printf 'TEXTO-EM-CLARO-ENSAIO foto %s %s\n' "$i" "$(openssl rand -hex 512)" | rcl rcat "s3supabase:property-photos/imovel-$i/foto-sala-$i.jpg"
  printf 'TEXTO-EM-CLARO-ENSAIO CPF 123.456.789-09 documento %s\n' "$i" | rcl rcat "s3supabase:documentos/contratos/contrato-joao-$i.pdf"
  OBJ=$((OBJ + 3))
done
echo "  storage: 3 buckets, $OBJ objetos"

# Cópias antigas (30 dias até ontem) e uma pasta de removidos de 40 dias: a retenção tem de podar.
HOJE="$(TZ=America/Sao_Paulo date +%F)"
for d in $(seq 1 30); do
  dia="$(date -u -d "$HOJE -$d day" +%F)"
  echo "copia antiga $dia" | rcl rcat "cripto:VivaNomads-Backup/banco/diario/${dia}_0315.dump"
done
VELHA="$(date -u -d "$HOJE -40 day" +%F)"
echo "removido antigo" | rcl rcat "cripto:VivaNomads-Backup/storage/removidos/$VELHA/avatars/x.jpg"

echo "== 2. Cópia noturna"
T0=$(date +%s)
if bash "$AQUI/copia.sh" >>"$SAIDA" 2>&1 && bash "$AQUI/finalizar.sh" copia >>"$SAIDA" 2>&1; then passou "cópia verde ($(($(date +%s) - T0)) s)"; else falhou "cópia verde"; fi
confere "linha 'copia' ok=true gravada em backups_execucoes" '[ "$(psqlf -c "select count(*) from public.backups_execucoes where tipo = '"'"'copia'"'"' and ok")" = 1 ]'
confere "objetos do storage registrados = $OBJ" '[ "$(psqlf -c "select objetos_storage from public.backups_execucoes where tipo = '"'"'copia'"'"' order by inicio desc limit 1")" = "$OBJ" ]'

echo "== 3. O \"Drive\" só tem nomes e conteúdo cifrados"
find "$DRIVE/VivaNomads-Backup" -mindepth 1 -printf '%f\n' >"$E/nomes-no-drive.txt"
confere "há arquivos no Drive falso ($(wc -l <"$E/nomes-no-drive.txt") nomes)" '[ -s "$E/nomes-no-drive.txt" ]'
confere "nenhum nome em claro (banco, diario, storage, manifestos, buckets, .dump, .json, .jpg, .pdf, maria, joao)" \
  '! grep -qiE "vivanomads|banco|diario|semanal|mensal|storage|atual|removidos|manifesto|avatars|property|documentos|contrato|maria|joao|\.(dump|json|jpg|pdf)$|^[0-9]{4}-[0-9]{2}-[0-9]{2}" "$E/nomes-no-drive.txt"'
confere "nenhum conteúdo em claro (marca do texto, e-mail, CPF, cabeçalho PGDMP do pg_dump, manifesto)" \
  '! grep -rqaE "TEXTO-EM-CLARO-ENSAIO|maria\.ensaio@|123\.456\.789-09|PGDMP|\"tabelas\"|COPY public" "$DRIVE"'
confere "o log da cópia não tem dado nem nome de arquivo de usuário" \
  '! grep -qaE "TEXTO-EM-CLARO-ENSAIO|@exemplo\.com|123\.456\.789-09|maria-silva|contrato-joao|foto-sala|$BACKUP_SENHA_1|$BACKUP_SENHA_2|$ENSAIO_S3_SEGREDO" "$SAIDA"'
confere "rclone.conf temporário com permissão 600" '[ "$(stat -c %a "$BACKUP_TRAB/rclone.conf")" = 600 ]'

echo "== 4. Retenção e --backup-dir"
rcl lsf --files-only "cripto:VivaNomads-Backup/banco/diario/" >"$E/diario.txt"
rcl lsf --files-only "cripto:VivaNomads-Backup/banco/semanal/" >"$E/semanal.txt" || : >"$E/semanal.txt"
rcl lsf --files-only "cripto:VivaNomads-Backup/banco/mensal/" >"$E/mensal.txt" || : >"$E/mensal.txt"
confere "14 diárias depois da poda (havia 31)" '[ "$(wc -l <"$E/diario.txt")" = 14 ]'
# O esperado vem da regra pura (testada à parte); aqui se prova que a cópia EXECUTA o plano no Drive.
cat "$E/diario.txt" "$E/semanal.txt" "$E/mensal.txt" | sort -u >"$E/todas.txt"
node --input-type=module -e '
  import { readFileSync, writeFileSync } from "node:fs";
  const { quaisFicam } = await import(process.argv[1]);
  const todas = readFileSync(process.argv[2], "utf8").split("\n").filter(Boolean);
  const r = quaisFicam(todas, process.argv[3]);
  writeFileSync(process.argv[4], r.semanais.join("\n") + "\n");
  writeFileSync(process.argv[5], r.mensais.join("\n") + "\n");
' "$RAIZ/src/lib/backup/retencao.ts" "$E/todas.txt" "$HOJE" "$E/semanal-esperado.txt" "$E/mensal-esperado.txt"
confere "semanais = regra (8 semanas; $(wc -l <"$E/semanal.txt") com o histórico do ensaio)" 'diff -q <(sort "$E/semanal.txt") <(sort "$E/semanal-esperado.txt") >/dev/null'
confere "todo domingo do histórico virou semanal" '! while read -r n; do [ "$(date -u -d "${n:0:10}" +%u)" = 7 ] && ! grep -qx "$n" "$E/semanal.txt" && echo x; done <"$E/todas.txt" | grep -q x'
confere "no máximo 3 mensais (Prompt 58: cópia de segurança expira em até ~90 dias)" '[ "$(wc -l <"$E/mensal.txt")" -le 3 ]'
confere "mensais = regra ($(wc -l <"$E/mensal.txt"), com a do dia 1)" 'diff -q <(sort "$E/mensal.txt") <(sort "$E/mensal-esperado.txt") >/dev/null && grep -qE "^[0-9]{4}-[0-9]{2}-01_" "$E/mensal.txt"'
confere "pasta de removidos com mais de 30 dias podada" '! rcl lsf --dirs-only "cripto:VivaNomads-Backup/storage/removidos/" | grep -q "$VELHA"'
rcl deletefile "s3supabase:avatars/00000000-0000-4000-8000-000000000002/maria-silva-rg-1.jpg"
printf 'TEXTO-EM-CLARO-ENSAIO trocado\n' | rcl rcat "s3supabase:documentos/contratos/contrato-joao-2.pdf"
# Troca por um conteúdo do MESMO tamanho: com --checksum sobre o crypt isso passaria despercebido.
printf 'TEXTO-EM-CLARO-ENSAIO CPF 123.456.789-09 documento X\n' | rcl rcat "s3supabase:documentos/contratos/contrato-joao-3.pdf"
if ! { bash "$AQUI/copia.sh" >>"$SAIDA" 2>&1 && bash "$AQUI/finalizar.sh" copia >>"$SAIDA" 2>&1; }; then falhou "segunda cópia verde"; fi
confere "o apagado e os 2 trocados (um do mesmo tamanho) foram para storage/removidos/$HOJE/" '[ "$(rcl lsf -R --files-only "cripto:VivaNomads-Backup/storage/removidos/$HOJE/" | wc -l)" = 3 ]'
confere "a versão nova do trocado de mesmo tamanho está no backup" '[ "$(rcl cat "cripto:VivaNomads-Backup/storage/atual/documentos/contratos/contrato-joao-3.pdf" | grep -c "documento X")" = 1 ]'
OBJ=$((OBJ - 1))

echo "== 5. Teste de restauração"
if bash "$RAIZ/scripts/drill/drill.sh" >"$E/drill.log" 2>&1 && bash "$AQUI/finalizar.sh" drill >>"$E/drill.log" 2>&1; then passou "teste de restauração verde"; else falhou "teste de restauração verde"; fi
cat "$E/drill.log" >>"$SAIDA"
grep -E "^  (✔|✘|pg_restore|dump)" "$E/drill.log" | sed 's/^/    /' || true
DUR="$(psqlf -c "select duracao_restauracao_s from public.backups_execucoes where tipo = 'drill' and ok order by inicio desc limit 1")"
confere "linha 'drill' ok=true com a duração da restauração (${DUR:-?} s)" '[ -n "$DUR" ]'
confere "o restaurado bate: contagens, migrações, 5 consultas-chave e amostra de $(grep -oE "[0-9]+ de [0-9]+ iguais" "$E/drill.log" | head -1)" '! grep -q "✘" "$E/drill.log"'

echo "== 6. Falha de propósito: dump corrompido"
MAN="$(rcl lsf --files-only "cripto:VivaNomads-Backup/manifestos/" | sort | tail -1)"
rcl copyto "cripto:VivaNomads-Backup/manifestos/$MAN" "$E/manifesto.json"
DUMP="$(node -e 'console.log(JSON.parse(require("fs").readFileSync(process.argv[1],"utf8")).dump.arquivo)' "$E/manifesto.json")"
rcl copyto "cripto:VivaNomads-Backup/banco/diario/$DUMP" "$E/bom.dump"
head -c 2000 "$E/bom.dump" | rcl rcat "cripto:VivaNomads-Backup/banco/diario/$DUMP"
if bash "$RAIZ/scripts/drill/drill.sh" >"$E/drill-ruim.log" 2>&1; then falhou "drill vermelho com dump corrompido"; else passou "drill vermelho com dump corrompido"; fi
if bash "$AQUI/finalizar.sh" drill >>"$E/drill-ruim.log" 2>&1; then falhou "finalizar sai vermelho"; else passou "finalizar sai vermelho"; fi
cat "$E/drill-ruim.log" >>"$SAIDA"
confere "linha 'drill' ok=false com motivo sem dado" '[ "$(psqlf -c "select count(*) from public.backups_execucoes where tipo = '"'"'drill'"'"' and not ok and motivo like '"'"'%corrompido%'"'"'")" = 1 ]'
confere "alarme montado (assunto e motivo) e NÃO enviado" '[ -f "$BACKUP_TRAB/alarme.json" ] && grep -q "Alarme do backup: teste de restauração com problema" "$BACKUP_TRAB/alarme.json" && grep -q "simulação, nada enviado" "$E/drill-ruim.log"'
confere "o alarme não tem dado" '! grep -qaE "TEXTO-EM-CLARO|@exemplo|123\.456|maria|joao|postgres(ql)?://" "$BACKUP_TRAB/alarme.json"'
cp "$BACKUP_TRAB/alarme.json" "$E/alarme-dump-corrompido.json"

echo "== 7. Falha de propósito: cifra adulterada no Drive"
rcl copyto "$E/bom.dump" "cripto:VivaNomads-Backup/banco/diario/$DUMP"
CIFRADO="$("$RCLONE" --config "$BACKUP_TRAB/rclone.conf" cryptdecode --reverse cripto: "VivaNomads-Backup/banco/diario/$DUMP" | awk -F'\t' '{print $2}' | sed 's/^ *//')"
python3 - "$DRIVE/VivaNomads-Backup/$CIFRADO" <<'PY'
import sys
p = sys.argv[1]
b = bytearray(open(p, "rb").read())
b[200] ^= 0xFF
open(p, "wb").write(bytes(b))
PY
if bash "$RAIZ/scripts/drill/drill.sh" >"$E/drill-cifra.log" 2>&1; then falhou "drill vermelho com cifra adulterada"; else passou "drill vermelho com cifra adulterada"; fi
bash "$AQUI/finalizar.sh" drill >>"$E/drill-cifra.log" 2>&1 || true
cat "$E/drill-cifra.log" >>"$SAIDA"
confere "motivo: não foi possível decifrar" '[ "$(psqlf -c "select count(*) from public.backups_execucoes where tipo = '"'"'drill'"'"' and not ok and motivo like '"'"'%decifrar%'"'"'")" = 1 ]'

echo "== 8. Limpeza"
bash "$AQUI/limpar.sh" >>"$SAIDA" 2>&1
confere "pasta temporária (rclone.conf incluído) apagada" '[ ! -e "$BACKUP_TRAB" ]'
confere "nenhum log do ensaio tem dado, senha ou nome de arquivo de usuário" \
  '! grep -qaE "TEXTO-EM-CLARO-ENSAIO|@exemplo\.com|123\.456\.789-09|maria-silva|contrato-joao|foto-sala|$BACKUP_SENHA_1|$BACKUP_SENHA_2|$ENSAIO_S3_SEGREDO" "$SAIDA"'

echo
echo "Ensaio: $ok verificação(ões) OK, $falhas falha(s)."
[ "$falhas" = 0 ]
