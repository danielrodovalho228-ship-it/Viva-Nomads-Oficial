#!/usr/bin/env bash
# Resiliência 2 — a cópia noturna (Action "Backup noturno"). Antes: instalar-ferramentas.sh e montar-rclone.sh.
# Depois (sempre): finalizar.sh copia e limpar.sh.
#  1. pg_dump 17 (formato custom, sem dono nem privilégios) de public, auth, storage e supabase_migrations;
#  2. contagem de linhas por tabela LIDA DO DUMP + as 5 consultas-chave em produção (só true/false);
#  3. envio do dump cifrado para cripto:VivaNomads-Backup/banco/diario/AAAA-MM-DD_HHMM.dump;
#  4. rclone sync de TODOS os buckets do Storage (S3) para storage/atual/, com o que sumiu ou mudou indo para
#     storage/removidos/AAAA-MM-DD/;
#  5. manifesto (sem dado pessoal) em manifestos/AAAA-MM-DD.json;
#  6. retenção (14 diárias, 8 semanais, 3 mensais; removidos com mais de 30 dias);
#  7. total usado na pasta do Drive.
# Nada aqui imprime dado, nome de arquivo de usuário, URL ou segredo: só etapas e números.
source "$(dirname "${BASH_SOURCE[0]}")/comum.sh"
export NODE_OPTIONS="${NODE_OPTIONS:-} --disable-warning=MODULE_TYPELESS_PACKAGE_JSON"

: "${SUPABASE_DB_URL:?Falta o segredo SUPABASE_DB_URL.}"
[ -f "$RCLONE_CONFIG" ] || {
  echo "::error::rclone.conf não montado (rode montar-rclone.sh antes)."
  exit 1
}
rm -f "$TRAB"/res_*
resultado inicio "$(date -u +%FT%TZ)"

AGORA="$(agora_brt)"
HOJE="${AGORA%_*}"
DUMP="$AGORA.dump"

etapa "dump do banco"
if ! "$PG_BIN/pg_dump" --dbname="$SUPABASE_DB_URL" --format=custom --no-owner --no-privileges \
  --schema=public --schema=auth --schema=storage --schema=supabase_migrations \
  --file="$TRAB/$DUMP" 2>"$TRAB/pg.err"; then
  echo "::error::pg_dump falhou: $(primeiro_erro "$TRAB/pg.err")"
  exit 1
fi
BYTES_BANCO="$(stat -c %s "$TRAB/$DUMP")"
resultado bytes_banco "$BYTES_BANCO"
echo "  dump: $BYTES_BANCO bytes"

etapa "contagem do dump"
"$PG_BIN/pg_restore" --data-only --file=- "$TRAB/$DUMP" 2>"$TRAB/pg.err" | node "$RAIZ/scripts/backup/contar-dump.ts" >"$TRAB/contagem.json"
# shellcheck disable=SC2016 # é JavaScript, não shell
node -e 'const c=JSON.parse(require("fs").readFileSync(process.argv[1],"utf8"));const t=Object.values(c.tabelas);console.log(`  ${t.length} tabelas, ${t.reduce((a,b)=>a+b,0)} linhas, ${c.migracoes.length} migrações`)' "$TRAB/contagem.json"

etapa "consultas-chave"
node "$RAIZ/scripts/backup/consultas-chave.ts" SUPABASE_DB_URL >"$TRAB/chaves.json"

etapa "envio do dump"
rc copyto "$TRAB/$DUMP" "$DESTINO/banco/diario/$DUMP"

etapa "arquivos do storage"
# Todos os buckets: a raiz do remoto S3 lista os buckets como pastas.
# Sem --checksum: o crypt não guarda hash, e com --checksum o rclone cai para "só tamanho" (um arquivo trocado por
# outro do mesmo tamanho NÃO seria copiado — provado no ensaio). Tamanho + data do servidor S3 pega a troca; o teste
# de restauração ainda compara o conteúdo byte a byte (rclone check --download) numa amostra toda semana.
rc sync s3supabase: "$DESTINO/storage/atual/" \
  --backup-dir "$DESTINO/storage/removidos/$HOJE/" \
  --fast-list --use-server-modtime --transfers 4

etapa "contagem do storage"
: >"$TRAB/buckets.tsv"
rc lsf --dirs-only s3supabase: >"$TRAB/lista_buckets.txt"
OBJETOS=0
BYTES_STORAGE=0
while IFS= read -r b; do
  b="${b%/}"
  [ -n "$b" ] || continue
  rc size --json "s3supabase:$b" >"$TRAB/size.json"
  read -r n by < <(node -e 'const s=JSON.parse(require("fs").readFileSync(process.argv[1],"utf8"));console.log(s.count,s.bytes)' "$TRAB/size.json")
  printf '%s\t%s\t%s\n' "$b" "$n" "$by" >>"$TRAB/buckets.tsv"
  OBJETOS=$((OBJETOS + n))
  BYTES_STORAGE=$((BYTES_STORAGE + by))
done <"$TRAB/lista_buckets.txt"
resultado objetos_storage "$OBJETOS"
resultado bytes_storage "$BYTES_STORAGE"
echo "  storage: $(wc -l <"$TRAB/buckets.tsv") buckets, $OBJETOS objetos, $BYTES_STORAGE bytes"

etapa "manifesto"
node "$RAIZ/scripts/backup/manifesto.ts" "$TRAB" "$DUMP" >"$TRAB/manifesto.json"
rc copyto "$TRAB/manifesto.json" "$DESTINO/manifestos/$HOJE.json"

etapa "retenção"
listar() { rc lsf "$@" 2>/dev/null || true; }
listar --files-only "$DESTINO/banco/diario/" >"$TRAB/lista_diario.txt"
listar --files-only "$DESTINO/banco/semanal/" >"$TRAB/lista_semanal.txt"
listar --files-only "$DESTINO/banco/mensal/" >"$TRAB/lista_mensal.txt"
listar --files-only "$DESTINO/manifestos/" >"$TRAB/lista_manifestos.txt"
listar --dirs-only "$DESTINO/storage/removidos/" >"$TRAB/lista_removidos.txt"
grep -qx "$DUMP" "$TRAB/lista_diario.txt" || {
  echo "::error::O dump de hoje não aparece na pasta diária depois do envio."
  exit 1
}
node "$RAIZ/scripts/backup/retencao.ts" "$HOJE" "$TRAB" >"$TRAB/plano.txt"
copiados=0 apagados=0 purgados=0
while read -r acao a b c; do
  case "$acao" in
    copiar)
      rc copyto "$DESTINO/banco/$a/$b" "$DESTINO/banco/$c/$b"
      copiados=$((copiados + 1))
      ;;
    apagar)
      rc deletefile "$DESTINO/banco/$a/$b"
      apagados=$((apagados + 1))
      ;;
    purgar-removidos)
      rc purge "$DESTINO/storage/removidos/$a/"
      purgados=$((purgados + 1))
      ;;
    apagar-manifesto)
      rc deletefile "$DESTINO/manifestos/$a"
      apagados=$((apagados + 1))
      ;;
  esac
done <"$TRAB/plano.txt"
echo "  retenção: $copiados cópia(s) para semanal/mensal, $apagados arquivo(s) podado(s), $purgados pasta(s) de removidos podada(s)"

etapa "tamanho da pasta"
if rc size --json "$CRIPTO_BASE" >"$TRAB/pasta.json"; then
  BYTES_PASTA="$(node -e 'console.log(JSON.parse(require("fs").readFileSync(process.argv[1],"utf8")).bytes)' "$TRAB/pasta.json")"
  resultado bytes_pasta "$BYTES_PASTA"
  echo "  pasta no Drive: $BYTES_PASTA bytes"
fi

resultado ok 1
echo "Cópia concluída."
