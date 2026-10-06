# Capacitor aposentado (outubro de 2026)

**Decisão:** um app só, o **Expo** (`viva-nomads-app`), no iPhone e no Android.

O Capacitor (pasta `android/` deste repositório) foi retirado. Os dois apps usavam o mesmo identificador (`br.com.vivanomads.app`), e só um pode ir para a Play Store. O Android em Capacitor **nunca foi publicado**: os `.aab` encontrados eram de outro projeto.

Este documento registra o que ele fazia, para nada se perder na passagem para o Expo.

## O que o Capacitor fazia → o que o Expo precisa ter

| Função | Como era no Capacitor | No app Expo |
|---|---|---|
| Abrir o site | WebView em `https://vivanomads.com.br` (`server.url`), navegação presa ao domínio (`allowNavigation`) | Já faz: WebView no mesmo endereço |
| Ser reconhecido como app | `appendUserAgent: "VivaNomadsApp/1.0 (capacitor)"` + `Capacitor.isNativePlatform()` | Já faz: user-agent com `VivaNomadsApp` e `window.VivaNomadsApp` (`src/lib/app-mode.ts`) |
| Botão Voltar do Android | `App.addListener("backButton")`: volta uma página; na primeira tela, fecha o app (`native-bridge.tsx`) | **Fazer:** `BackHandler` → `webview.goBack()` quando `canGoBack`; senão, fechar |
| Links externos | `target="_blank"` e `window.open` para fora do domínio abriam no navegador do sistema (`@capacitor/browser`) | **Conferir:** `onShouldStartLoadWithRequest` / `setSupportMultipleWindows` abrindo fora do domínio com `Linking.openURL` |
| "Abrir no navegador" (telas só do site) | — | **Fazer:** a mensagem `abrir-navegador` (`docs/APP-LINKS.md`) |
| Push | `@capacitor/push-notifications`: permissão só depois do login, com uma frase antes; token FCM salvo em `push_tokens` por `registrarPushToken`; toque leva a `data.url` (só caminho interno); token guardado para sair no logout; protegido pela flag `NEXT_PUBLIC_PUSH_ATIVO` | **Fazer:** plano em `docs/APP-LINKS.md` → "Push no app Expo" (`expo-notifications` + o mesmo `push_tokens`) |
| Tela offline | `www/index.html` (fallback sem rede) | **Conferir:** tela de "sem conexão" do Expo |
| Ícone e splash | `@capacitor/assets` a partir de `assets/` | `app.json` do Expo (`icon`, `splash`, `android.adaptiveIcon`) |
| Links de e-mail abrindo o app | (estava no PR #259, depois revertido) | `app.json` com `associatedDomains` + `intentFilters` (`docs/APP-LINKS.md`) |

## O que foi removido
- `android/`, `capacitor.config.ts`, `www/`, `CAPACITOR.md`, `docs/PLAY-STORE.md`.
- `src/components/native/native-bridge.tsx` (Voltar e links externos) e `push-register.tsx` (push).
- As dependências `@capacitor/*` e os scripts `cap:*`.
- A flag `NEXT_PUBLIC_PUSH_ATIVO` (só o push do Capacitor usava). Se ela existir na Vercel, pode apagar.
- A detecção por `window.Capacitor` em `app-mode.ts` e `app-mode-bridge.tsx`.

## O que ficou (o Expo vai usar)
- Tabela `push_tokens` (migration 0048) e `registrarPushToken` / `removerPushToken` (`src/lib/data/push-actions.ts`).
- `sendPush` (`src/lib/notifications/push.ts`, FCM v1) e o push disparado pelo `notify()`. No plano do Expo, ele passa a enviar também pelo serviço de push do Expo.
- `useIsNative()` (`src/lib/use-native.ts`), que agora lê a marca `data-app` (vale para o Expo).
