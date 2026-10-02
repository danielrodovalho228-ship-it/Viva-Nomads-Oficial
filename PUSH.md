# Notificações push (app nativo)

O app nativo (Capacitor) pede permissão e registra o dispositivo para push. O
token é salvo em `push_tokens` (migração **0048**), atrelado ao usuário logado.
Isso dá uma função nativa de verdade (importante para a aprovação na App Store —
*Guideline 4.2*) e permite avisar o dono de uma **nova candidatura**, o inquilino
de uma **resposta**, etc.

## O que já está no código
- `@capacitor/push-notifications` instalado.
- `src/components/native/push-register.tsx` — registra no app nativo (no-op na web), pede permissão e envia o token.
- `src/lib/data/push-actions.ts` → `registrarPushToken()` faz upsert em `push_tokens`.
- Montado em `src/app/(dashboard)/layout.tsx` (usuários logados).
- Migração `supabase/migrations/0048_push_tokens.sql`.

## O que você precisa configurar (uma vez)

### Android — Firebase Cloud Messaging (FCM)
1. Crie um projeto no [Firebase Console](https://console.firebase.google.com).
2. Adicione um app Android com o pacote `br.com.vivanomads.app`.
3. Baixe o `google-services.json` e coloque em `android/app/google-services.json`.
4. `npm run cap:sync`. (O plugin já aplica o Gradle do FCM.)

### iOS — APNs (num Mac)
1. Na conta Apple Developer, habilite **Push Notifications** no App ID.
2. No Xcode: *Signing & Capabilities* → **+ Push Notifications**.
3. Ligue o app ao mesmo projeto Firebase (app iOS) e suba a chave APNs no Firebase.

## Enviar um push (lado servidor)
Os tokens do destinatário estão em `push_tokens` (leia com a **service_role**, que
ignora o RLS). O envio usa a **FCM HTTP v1**. O caminho recomendado é uma
**Supabase Edge Function** (ou rota server-only) que:
1. lê os tokens do `user_id` destino,
2. pega um access token OAuth a partir da *service account* do Firebase,
3. faz `POST https://fcm.googleapis.com/v1/projects/<PROJ>/messages:send`.

Guarde as credenciais só no servidor (ex.: `FCM_SERVICE_ACCOUNT_JSON`). **Nunca**
no cliente. Depois é só chamar esse envio junto do e-mail atual em `requestLead`
(novo lead) e em `moderarDocumento`/aceite — onde já notificamos por e-mail.

> Enquanto o FCM não estiver configurado, o app funciona normal: ele registra o
> token, e o envio simplesmente ainda não dispara. Nada quebra.

## Checklist
- [ ] `google-services.json` em `android/app/` (Android)
- [ ] APNs + capability de Push no Xcode (iOS)
- [ ] Migração 0048 aplicada em produção (`npm run check:migracoes`)
- [ ] Função de envio (Edge Function) com a service account do Firebase
