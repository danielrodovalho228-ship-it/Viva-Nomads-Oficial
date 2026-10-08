/**
 * MODO APP — quando o site roda DENTRO do app (Expo, iPhone e Android),
 * vira um app enxuto: sem home de marketing, menu de cima e rodapé; barra
 * inferior de 5 abas por papel.
 *
 * Como o app é reconhecido:
 *  - user-agent com "VivaNomadsApp" e/ou window.VivaNomadsApp (app Expo);
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
export const APP_VIEWPORT_APP =
  "width=device-width, initial-scale=1, maximum-scale=1, user-scalable=no, viewport-fit=cover";

/**
 * O script roda no <head> ANTES de o <meta name=viewport> existir; por isso, se o
 * meta ainda não está lá, observa o documento e aplica o viewport do app assim
 * que ele aparecer (e de novo no DOMContentLoaded). Sem isso o iPhone nunca
 * recebia o maximum-scale=1 e dava zoom ao tocar nos campos.
 */
export const APP_PREPAINT_SCRIPT = `(function(){try{
var c=document.cookie.indexOf('${APP_COOKIE}=1')>-1;
var u=/VivaNomadsApp/i.test(navigator.userAgent);
var w=!!(window.VivaNomadsApp||window.__VN_APP__);
if(c||u||w){document.documentElement.setAttribute('data-app','1');
var V='${APP_VIEWPORT_APP}';
var ap=function(){var m=document.querySelector('meta[name=viewport]');
if(m){if(m.getAttribute('content')!==V){m.setAttribute('content',V);}return true;}return false;};
if(!ap()){
if(typeof MutationObserver==='function'){var o=new MutationObserver(function(){if(ap()){o.disconnect();}});
o.observe(document.documentElement,{childList:true,subtree:true});}
document.addEventListener('DOMContentLoaded',ap);}}
}catch(e){}})();`;
