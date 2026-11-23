/*
  Resumo do aparelho para a trilha de auditoria das aprovações (ordem 12a8086d, item 4:
  "quem, quando, o quê, de qual aparelho"). Puro, sem imports de servidor.
  Só vocabulário fixo: nunca guarda o user-agent cru, versão, modelo do celular nem IP
  (menos rastro pessoal e nada de texto de fora indo para o banco).
*/
import { isAppUserAgent } from "../app-mode.ts";

export const APARELHO_MAX = 60;
const DESCONHECIDO = "Aparelho não identificado";

function sistema(ua: string): string | null {
  if (/iPad/.test(ua)) return "iPad";
  if (/iPhone|iPod/.test(ua)) return "iPhone";
  if (/Android/.test(ua)) return "Android";
  if (/Windows/.test(ua)) return "Windows";
  if (/Macintosh|Mac OS X/.test(ua)) return "Mac";
  if (/CrOS/.test(ua)) return "ChromeOS";
  if (/Linux/.test(ua)) return "Linux";
  return null;
}

function navegador(ua: string): string | null {
  if (/Edg\//.test(ua)) return "Edge";
  if (/SamsungBrowser\//.test(ua)) return "Samsung Internet";
  if (/OPR\//.test(ua)) return "Opera";
  if (/Firefox\/|FxiOS\//.test(ua)) return "Firefox";
  if (/Chrome\/|CriOS\//.test(ua)) return "Chrome";
  if (/Safari\//.test(ua)) return "Safari";
  return null;
}

/** "Celular · iPhone · Safari", "Computador · Windows · Edge", "App Viva Nomads · Android"… */
export function resumoDoAparelho(userAgent: string | null | undefined): string {
  const ua = (userAgent ?? "").slice(0, 1000);
  const so = sistema(ua);
  if (!so) return DESCONHECIDO;
  if (isAppUserAgent(ua)) return `App Viva Nomads · ${so}`;
  const tipo = so === "iPad" || (so === "Android" && !/Mobile/.test(ua)) ? "Tablet" : so === "iPhone" || so === "Android" ? "Celular" : "Computador";
  const nav = navegador(ua);
  return [tipo, so, nav].filter(Boolean).join(" · ").slice(0, APARELHO_MAX);
}
