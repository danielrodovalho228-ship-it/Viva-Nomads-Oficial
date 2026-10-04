/*
  Eventos anônimos de uso (0067) — regras PURAS: tipos aceitos, validação do
  que o navegador manda, origem (UTM) e plataforma. Sem imports de servidor
  (testável com node --test). Nada de dado pessoal: sem IP, e-mail ou texto
  livre — só tipo, imóvel, cidade normalizada e origem da 1ª visita.
*/
import { chaveCidade } from "../cidades.ts";

export const TIPOS_EVENTO = [
  "busca",
  "ver_anuncio",
  "favoritar",
  "iniciar_candidatura",
  "enviar_candidatura",
  "iniciar_cadastro",
  "concluir_cadastro",
  "publicar_pedido",
  "iniciar_anuncio",
  "publicar_anuncio",
] as const;
export type TipoEvento = (typeof TIPOS_EVENTO)[number];

export type Plataforma = "web" | "ios" | "android";

/** Cookie com a origem da 1ª visita (30 dias). */
export const ORIGEM_COOKIE = "vn_origem";
export const ORIGEM_DIAS = 30;

export interface Origem {
  source: string | null;
  medium: string | null;
  campaign: string | null;
}

export interface EventoValido {
  tipo: TipoEvento;
  imovel_id: string | null;
  cidade_chave: string | null;
  plataforma: Plataforma;
}

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export function ehTipoEvento(t: unknown): t is TipoEvento {
  return typeof t === "string" && (TIPOS_EVENTO as readonly string[]).includes(t);
}

/** Valor de UTM limpo: minúsculo, só [a-z0-9 _.-], cortado. Vazio → null. */
export function limparUtm(v: unknown, max = 80): string | null {
  if (typeof v !== "string") return null;
  const s = v
    .toLowerCase()
    .replace(/[^a-z0-9 _.\-]/g, "")
    .trim()
    .slice(0, max);
  return s || null;
}

/** UTMs da URL (?utm_source=…). Sem utm_source, não há origem a gravar. */
export function origemDaUrl(search: string): Origem | null {
  const p = new URLSearchParams(search);
  const source = limparUtm(p.get("utm_source"));
  if (!source) return null;
  return {
    source,
    medium: limparUtm(p.get("utm_medium")),
    campaign: limparUtm(p.get("utm_campaign"), 120),
  };
}

export function origemParaCookie(o: Origem): string {
  return encodeURIComponent(JSON.stringify({ s: o.source, m: o.medium, c: o.campaign }));
}

/** Lê o cookie de origem; qualquer coisa estranha → origem vazia. */
export function origemDoCookie(valor: string | null | undefined): Origem {
  const vazio: Origem = { source: null, medium: null, campaign: null };
  if (!valor) return vazio;
  try {
    const o = JSON.parse(decodeURIComponent(valor)) as Record<string, unknown>;
    return { source: limparUtm(o.s), medium: limparUtm(o.m), campaign: limparUtm(o.c, 120) };
  } catch {
    return vazio;
  }
}

/** Plataforma: só app (marcado pelo cliente) vira ios/android, pelo user-agent. */
export function plataformaDe(ua: string | null | undefined, ehApp: boolean): Plataforma {
  if (!ehApp) return "web";
  const u = ua ?? "";
  if (/android/i.test(u)) return "android";
  if (/iphone|ipad|ipod|ios/i.test(u)) return "ios";
  return "web";
}

/** Valida o corpo enviado pelo navegador. Inválido → null (a rota ignora). */
export function validarEvento(corpo: unknown, ua: string | null | undefined): EventoValido | null {
  if (!corpo || typeof corpo !== "object") return null;
  const c = corpo as Record<string, unknown>;
  if (!ehTipoEvento(c.tipo)) return null;
  const imovel = typeof c.imovel_id === "string" && UUID.test(c.imovel_id) ? c.imovel_id.toLowerCase() : null;
  const cidade = typeof c.cidade === "string" ? chaveCidade(c.cidade.slice(0, 80)) || null : null;
  return {
    tipo: c.tipo,
    imovel_id: imovel,
    cidade_chave: cidade,
    plataforma: plataformaDe(ua, c.app === true),
  };
}

/** Dia (AAAA-MM-DD) no horário de Brasília — a sessão anônima troca todo dia. */
export function diaBR(agora: Date = new Date()): string {
  return new Intl.DateTimeFormat("en-CA", { timeZone: "America/Sao_Paulo" }).format(agora);
}
