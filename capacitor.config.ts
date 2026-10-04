import type { CapacitorConfig } from "@capacitor/cli";

/**
 * Capacitor — shell nativo (Android/iOS) que carrega o app hospedado.
 *
 * O Viva Nomads é SSR (server actions + Supabase), então o app nativo NÃO
 * empacota um export estático: ele abre a URL de produção numa webview nativa,
 * preservando login, moderação, pagamentos — tudo o que já funciona na web.
 *
 * `webDir` aponta para um fallback mínimo (www/) usado só antes de a rede
 * carregar / quando offline. Em produção, `server.url` manda.
 *
 * Para testar contra um ambiente local, troque `server.url` por
 * http://SEU_IP:3000 e deixe `cleartext: true` (só em dev).
 *
 * Push: o app só chama `PushNotifications.register()` quando a flag
 * `NEXT_PUBLIC_PUSH_ATIVO="on"` está ligada (ver src/lib/flags.ts e PLAY-STORE.md).
 * Isso evita o crash nativo de registrar push sem o `google-services.json` no build.
 */
const config: CapacitorConfig = {
  appId: "br.com.vivanomads.app",
  appName: "Viva Nomads",
  webDir: "www",
  // Marca o app no user-agent: o SITE reconhece o app no servidor já na 1ª
  // requisição (modo app enxuto, src/lib/app-mode.ts). Vale a partir do
  // próximo build do Android; o build atual é reconhecido pelo navegador.
  appendUserAgent: "VivaNomadsApp/1.0 (capacitor)",
  server: {
    url: "https://vivanomads.com.br",
    androidScheme: "https",
    // Navegação dentro da webview fica no próprio domínio; links externos
    // (ex.: mapbox, redes) abrem no navegador do sistema.
    allowNavigation: ["vivanomads.com.br", "*.vivanomads.com.br"],
  },
};

export default config;
