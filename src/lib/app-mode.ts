/**
 * MODO APP — quando o site roda DENTRO dos apps (Android/Capacitor, iPhone/Expo),
 * vira um app enxuto: sem home de marketing, menu de cima e rodapé; barra
 * inferior de 5 abas por papel.
 *
 * Como o app é reconhecido:
 *  - iPhone (Expo): user-agent com "VivaNomadsApp" e/ou window.VivaNomadsApp;
 *  - Android (Capacitor): Capacitor.isNativePlatform() no navegador (o build
 *    atual não marca o user-agent; o próximo build marca — capacitor.config.ts);
 *  - depois da 1ª detecção no navegador, o cookie `vn_app=1` faz o SERVIDOR
 *    (proxy) reconhecer o app nas próximas requisições, sem "piscar" o site.
 *
 * Puro (sem imports de servidor/cliente): usado no proxy, no layout e em testes.
 */
export const APP_COOKIE = "vn_app";

export function isAppUserAgent(ua: string | null | undefined): boolean {
  return /VivaNomadsApp/i.test(ua ?? "");
}

/**
 * Rotas de MARKETING que não existem no app: redirecionam para a aba inicial do
 * papel (inquilino → Buscar; proprietário → Painel; sem login → boas-vindas).
 */
const MARKETING_EXATAS = new Set([
  "/",
  "/home",
  "/como-funciona",
  "/para-proprietarios",
  "/precos",
  "/planos",
  "/empresas",
  "/acesso-socios",
]);
const MARKETING_PREFIXOS = [
  "/cidades",
  "/simulacao",
  "/simulador",
  "/roi",
  "/modelodenegocio",
  "/tributario",
  "/socios",
  "/decisao",
];

export function isMarketingPath(pathname: string): boolean {
  if (MARKETING_EXATAS.has(pathname)) return true;
  return MARKETING_PREFIXOS.some((p) => pathname === p || pathname.startsWith(p + "/"));
}

/** Aba inicial do app por papel. */
export function appHome(papel: "owner" | "tenant" | null): string {
  if (papel === "owner") return "/dashboard";
  if (papel === "tenant") return "/buscar";
  return "/app/boas-vindas";
}

/**
 * Script que roda ANTES da 1ª pintura (no <head>): marca <html data-app="1"> e
 * trava o zoom de pinça quando é o app. Assim o CSS esconde o "site" sem piscar
 * e sem diferença de hidratação (o React não mexe nesse atributo).
 */
export const APP_PREPAINT_SCRIPT = `(function(){try{
var c=document.cookie.indexOf('${APP_COOKIE}=1')>-1;
var u=/VivaNomadsApp/i.test(navigator.userAgent);
var w=!!(window.VivaNomadsApp||window.__VN_APP__);
var cap=!!(window.Capacitor&&window.Capacitor.isNativePlatform&&window.Capacitor.isNativePlatform());
if(c||u||w||cap){document.documentElement.setAttribute('data-app','1');
var m=document.querySelector('meta[name=viewport]');
if(m){m.setAttribute('content','width=device-width, initial-scale=1, maximum-scale=1, user-scalable=no, viewport-fit=cover');}}
}catch(e){}})();`;
