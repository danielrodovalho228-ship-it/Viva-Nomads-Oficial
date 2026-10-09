# PATCH-APP — botão "Abrir no navegador" (ordem bc09134e, item 4)

**O problema:** o site manda `postMessage({tipo:"abrir-navegador", url})` para o app, mas o `App.tsx` do Expo
não tem `onMessage`, então nada acontece. O site já tem a rede de segurança (se o app não responde em ~0,8 s,
a página abre ali mesmo — `src/components/app/links-do-app.tsx`), mas com o patch abaixo o navegador do
sistema abre de verdade. **Precisa de build novo do app** (pasta `viva-nomads-app`, que fica no PC do Daniel).

## Diff do `App.tsx`

```diff
+import * as WebBrowser from "expo-web-browser";
@@
+// Só o domínio da Viva abre no navegador do sistema; qualquer outro endereço é ignorado.
+function urlPermitida(url: unknown): url is string {
+  if (typeof url !== "string") return false;
+  try {
+    const u = new URL(url);
+    return u.protocol === "https:" && (u.hostname === "vivanomads.com.br" || u.hostname === "www.vivanomads.com.br");
+  } catch {
+    return false;
+  }
+}
@@
 <WebView
   ...
+  onMessage={(e) => {
+    try {
+      const msg = JSON.parse(e.nativeEvent.data) as { tipo?: string; url?: unknown };
+      if (msg.tipo === "abrir-navegador" && urlPermitida(msg.url)) {
+        void WebBrowser.openBrowserAsync(msg.url); // aba do Safari/Chrome por cima do app
+      }
+    } catch {
+      /* mensagem que não é nossa: ignora */
+    }
+  }}
 />
```

## Passo a passo
1. `npx expo install expo-web-browser`
2. Aplicar o diff acima no `App.tsx`.
3. `eas build` (iPhone e Android) e enviar às lojas.
4. Conferir: no app, abrir uma tela "só do site" → "Abrir no navegador" abre o Safari/Chrome por cima do app.

> Sem token no log. O checkout com a ponte (sem pedir login de novo) vem na parte 2 desta ordem.
