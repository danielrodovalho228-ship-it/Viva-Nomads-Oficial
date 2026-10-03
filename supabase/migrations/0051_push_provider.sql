-- ── 0051 — canal (provider) do token de push ────────────────────────────────
-- O app Expo (viva-nomads-app) gera tokens do Expo Push Service
-- (ExponentPushToken[...]), enviados por um canal diferente do FCM bruto usado
-- pelo app Capacitor. Esta coluna diz ao remetente (src/lib/notifications/push.ts)
-- por qual canal mandar cada token.
--
-- ADITIVA/idempotente. `default 'fcm'` mantém válidos os tokens já existentes
-- (todos vieram do Capacitor/FCM). Aplique ANTES de ligar NEXT_PUBLIC_PUSH_ATIVO
-- para o app Expo. Aplique você — nada vai à produção automaticamente.

alter table public.push_tokens
  add column if not exists provider text not null default 'fcm'
    check (provider in ('fcm', 'expo', 'apns'));

-- Consulta de envio filtra por usuário (índice já existe em user_id); o provider
-- é lido junto, sem necessidade de índice próprio.
