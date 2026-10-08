#!/usr/bin/env bash
# Decide o alvo do E2E. Entradas (env): EVENTO, AMBIENTE, TARGET_URL, INPUT_URL, TEM_BYPASS (true|false).
# Saída (stdout, formato GITHUB_OUTPUT): base_url, rodar (true|false), bypass (true|false), aviso.
# Por quê: o preview da Vercel é protegido; sem o segredo de bypass a suíte cai no login da Vercel
# (vermelho falso). Produção usa o domínio próprio, que não é protegido.
set -eu
PROD_URL="https://vivanomads.com.br"
amb=$(printf '%s' "${AMBIENTE:-}" | tr '[:upper:]' '[:lower:]')
base="" rodar="true" bypass="false" aviso=""
if [ "${EVENTO:-}" = "workflow_dispatch" ]; then
  base="${INPUT_URL:-}"
  [ "${TEM_BYPASS:-false}" = "true" ] && bypass="true"
elif [ "$amb" = "production" ]; then
  base="$PROD_URL"
elif [ "${TEM_BYPASS:-false}" = "true" ]; then
  base="${TARGET_URL:-}"; bypass="true"
else
  base="${TARGET_URL:-}"; rodar="false"
  aviso="Preview protegido e sem VERCEL_AUTOMATION_BYPASS_SECRET: E2E do preview foi pulado (não é falha)."
fi
echo "base_url=$base"
echo "rodar=$rodar"
echo "bypass=$bypass"
echo "aviso=$aviso"
