#!/usr/bin/env bash
# Resiliência 2 — monta o rclone.conf TEMPORÁRIO (permissão 600, dentro de $TRAB) com três remotos:
#   [drive]       o bloco que o Daniel colou no segredo RCLONE_DRIVE_CONF (OAuth dele, escopo drive.file);
#   [cripto]      crypt por cima de drive:VivaNomads-Backup, conteúdo E nomes cifrados, com as duas senhas
#                 (BACKUP_SENHA_1 e BACKUP_SENHA_2) passadas pelo "rclone obscure" via entrada padrão;
#   [s3supabase]  o Storage do Supabase pelo protocolo S3, com as chaves só do Storage.
# O arquivo é apagado no fim por limpar.sh (if: always() no workflow). Nenhum valor é impresso.
# No ensaio do CI, RCLONE_DRIVE_CONF é um remoto "local" e S3_ENDPOINT aponta para o S3 de teste (rclone serve s3).
source "$(dirname "${BASH_SOURCE[0]}")/comum.sh"

S3_ENDPOINT="${S3_ENDPOINT:-https://esezeutgtycekfosxplk.supabase.co/storage/v1/s3}"
S3_REGION="${S3_REGION:-us-east-1}"

falta=()
[ -n "${RCLONE_DRIVE_CONF:-}" ] || falta+=(RCLONE_DRIVE_CONF)
[ -n "${BACKUP_SENHA_1:-}" ] || falta+=(BACKUP_SENHA_1)
[ -n "${BACKUP_SENHA_2:-}" ] || falta+=(BACKUP_SENHA_2)
[ -n "${SUPABASE_S3_ACCESS_KEY_ID:-}" ] || falta+=(SUPABASE_S3_ACCESS_KEY_ID)
[ -n "${SUPABASE_S3_SECRET_ACCESS_KEY:-}" ] || falta+=(SUPABASE_S3_SECRET_ACCESS_KEY)
if [ "${#falta[@]}" -gt 0 ]; then
  echo "::error::Faltam segredos no ambiente backup-producao: ${falta[*]} (veja docs/RESTAURACAO.md, passo do Daniel)."
  exit 1
fi
if [ "${#BACKUP_SENHA_1}" -lt 20 ] || [ "${#BACKUP_SENHA_2}" -lt 20 ]; then
  echo "::error::BACKUP_SENHA_1 e BACKUP_SENHA_2 precisam ter 20 caracteres ou mais (gere no cofre de senhas)."
  exit 1
fi
if ! printf '%s\n' "$RCLONE_DRIVE_CONF" | grep -qE '^\[drive\][[:space:]]*$'; then
  echo "::error::RCLONE_DRIVE_CONF precisa ser o bloco do remoto [drive] (saída de: rclone config show drive)."
  exit 1
fi

: >"$RCLONE_CONFIG"
chmod 600 "$RCLONE_CONFIG"

senha1="$(printf '%s' "$BACKUP_SENHA_1" | "$RCLONE" obscure -)"
senha2="$(printf '%s' "$BACKUP_SENHA_2" | "$RCLONE" obscure -)"
mascarar "$senha1"
mascarar "$senha2"

{
  printf '%s\n\n' "$RCLONE_DRIVE_CONF"
  printf '[cripto]\ntype = crypt\nremote = %s\nfilename_encryption = standard\ndirectory_name_encryption = true\npassword = %s\npassword2 = %s\n\n' \
    "$CRIPTO_BASE" "$senha1" "$senha2"
  printf '[s3supabase]\ntype = s3\nprovider = Other\nendpoint = %s\nregion = %s\nforce_path_style = true\naccess_key_id = %s\nsecret_access_key = %s\n' \
    "$S3_ENDPOINT" "$S3_REGION" "$SUPABASE_S3_ACCESS_KEY_ID" "$SUPABASE_S3_SECRET_ACCESS_KEY"
} >>"$RCLONE_CONFIG"
unset senha1 senha2

echo "rclone.conf temporário montado (permissão $(stat -c %a "$RCLONE_CONFIG")): remotos drive, cripto e s3supabase."
