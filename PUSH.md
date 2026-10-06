# Notificações push (app)

**Situação:** o push existia só no app em Capacitor, que foi aposentado (veja `docs/CAPACITOR-APOSENTADO.md`). No app Expo, o push **ainda não está ligado**. O plano está em `docs/APP-LINKS.md` → "Push no app Expo".

## O que já está pronto no site
- Tabela `push_tokens` (`user_id`, `token`, `platform`), migration **0048**.
- `src/lib/data/push-actions.ts`: `registrarPushToken(token, "android" | "ios" | "web")` e `removerPushToken(token)`, sempre com a sessão da pessoa.
- `src/lib/notifications/push.ts`: `sendPush({ userId, title, body, url })` envia pelo FCM v1 (conta de serviço do Firebase na Vercel). Sem a credencial, não faz nada.
- `notify()` dispara o push junto com o e-mail: título do evento e a tela (`url`), nunca dado pessoal.

## Próximo passo (app Expo)
`expo-notifications` → `getExpoPushTokenAsync()` → o site chama `registrarPushToken`. Depois, o `sendPush` passa a enviar os `ExponentPushToken[…]` pelo serviço do Expo. As credenciais (FCM e APNs) ficam no EAS.
