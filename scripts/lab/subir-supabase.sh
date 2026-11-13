#!/usr/bin/env bash
# E792 — sobe o Supabase local do laboratório (lab-critico, laboratorio, linhas-de-base) e grava LAB_DB_URL.
#
# O que acontecia (runs 42536824482, 42538098625, 42682752738): numa VM do runner a porta 54322 ficava indisponível para
# o Docker do começo ao fim ("failed to bind host port 0.0.0.0:54322/tcp: address already in use"), sem nenhum processo
# escutando nela (`ss -ltnp` vazio) — e repetir na MESMA porta falhava as 3 vezes. A API (54321) subia; só o host-port do
# banco colidia. O banco só é usado pelo host nos `psql` do próprio workflow, então:
#   1. tenta na porta do config (54322);
#   2. se o erro for o bind da porta do banco, passa o banco para um bloco livre (55322, depois 56322) e sobe de novo;
#   3. qualquer outra falha: limpa os containers e, da 2ª tentativa em diante, reinicia o Docker (como antes).
# No fim grava LAB_DB_URL (no $GITHUB_ENV, quando existe) com a porta que de fato subiu.
#
# Uso: scripts/lab/subir-supabase.sh [tentativas]   (padrão 5)
# Variáveis: SUPABASE_BIN (padrão "supabase", o teste injeta um falso), SUPABASE_CONFIG (padrão supabase/config.toml),
#            LAB_SEM_DOCKER=1 (o teste: não mexe em containers nem no daemon).
set -u
TENTATIVAS="${1:-5}"
SUPABASE_BIN="${SUPABASE_BIN:-supabase}"
CONFIG="${SUPABASE_CONFIG:-supabase/config.toml}"
EXCLUIR="studio,imgproxy,edge-runtime,logflare,vector,supavisor,postgres-meta,mailpit,realtime"
PORTAS_RESERVA=(55322 56322)

porta_do_banco() {
  # A linha "port = N" logo depois de "[db]" (a primeira "port" da seção).
  awk '/^\[db\]/{d=1; next} /^\[/{d=0} d && /^port[[:space:]]*=/{gsub(/[^0-9]/,""); print; exit}' "$CONFIG"
}

trocar_porta_do_banco() {
  local nova="$1"
  awk -v nova="$nova" '/^\[db\]/{d=1; print; next} /^\[/{d=0} d && !feito && /^port[[:space:]]*=/{print "port = " nova; feito=1; next} {print}' "$CONFIG" > "$CONFIG.tmp" && mv "$CONFIG.tmp" "$CONFIG"
}

gravar_url() {
  local url="postgresql://postgres:postgres@127.0.0.1:$1/postgres"
  echo "LAB_DB_URL=$url"
  if [ -n "${GITHUB_ENV:-}" ]; then echo "LAB_DB_URL=$url" >> "$GITHUB_ENV"; fi
}

reserva=0
for tentativa in $(seq 1 "$TENTATIVAS"); do
  porta="$(porta_do_banco)"
  saida="$("$SUPABASE_BIN" start -x "$EXCLUIR" 2>&1)"; codigo=$?
  echo "$saida"
  if [ "$codigo" -eq 0 ]; then
    gravar_url "$porta"
    exit 0
  fi
  echo "::warning::supabase start falhou (tentativa $tentativa/$TENTATIVAS, banco na porta $porta)."
  (sudo -n ss -ltnp 2>/dev/null || ss -ltnp 2>/dev/null) | grep -E ":$porta\b" || echo "ninguém escutando na porta $porta"
  "$SUPABASE_BIN" stop --no-backup >/dev/null 2>&1 || true
  if echo "$saida" | grep -q "failed to bind host port [0-9.]*:$porta/tcp"; then
    if [ "$reserva" -lt "${#PORTAS_RESERVA[@]}" ]; then
      nova="${PORTAS_RESERVA[$reserva]}"; reserva=$((reserva + 1))
      echo "::warning::a porta $porta do banco está presa nesta máquina; o banco sobe na $nova (LAB_DB_URL segue a porta nova)."
      trocar_porta_do_banco "$nova"
      continue
    fi
  fi
  if [ -z "${LAB_SEM_DOCKER:-}" ]; then
    docker rm -f $(docker ps -aq) 2>/dev/null || true
    if [ "$tentativa" -ge 2 ]; then sudo systemctl restart docker || true; sleep 5; fi
    sleep $((tentativa * 5))
  fi
done
echo "::error::supabase start falhou $TENTATIVAS vezes"
exit 1
