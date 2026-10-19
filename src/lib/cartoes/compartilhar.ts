/*
  Cartões compartilháveis — Fase 1 (só compartilhar; sem recompensa nem cupom). PURO (node --test).
  T1 = cartão-postal pós-estadia (morador) · T2 = cartão do anúncio (proprietário).
  O QR leva SEMPRE a uma URL do próprio domínio: /imoveis/<id>?ref=<CÓDIGO>&utm_…&sig=<HMAC-SHA256(ref+id)>.
  O código é da conta (XXXX-XXXX, alfabeto sem 0/O/1/I/L), revogável; assinatura alterada = sem atribuição.
*/
import { createHmac, randomBytes, timingSafeEqual } from "node:crypto";

export type TipoCartao = "poststay" | "ownercard";
export const TIPOS_CARTAO: readonly TipoCartao[] = ["poststay", "ownercard"] as const;

/** Formatos fixos (modelo travado: nada de texto livre). */
export const FORMATOS = {
  retrato: { largura: 1080, altura: 1350 },
  quadrado: { largura: 1080, altura: 1080 },
} as const;
export type FormatoCartao = keyof typeof FORMATOS;

// ── Código da conta ────────────────────────────────────────────────────────────────────────────────────────────
/** Sem 0, O, 1, I, L (nada que se confunda lendo ou digitando). */
export const ALFABETO_CODIGO = "23456789ABCDEFGHJKMNPQRSTUVWXYZ";
const CODIGO_RE = new RegExp(`^[${ALFABETO_CODIGO}]{4}-[${ALFABETO_CODIGO}]{4}$`);

export function codigoValido(c: string | null | undefined): boolean {
  return CODIGO_RE.test(String(c ?? ""));
}

/** Novo código XXXX-XXXX (aleatório, sem viés de módulo). */
export function gerarCodigo(rand: (n: number) => Uint8Array = (n) => randomBytes(n)): string {
  const out: string[] = [];
  const limite = 256 - (256 % ALFABETO_CODIGO.length);
  while (out.length < 8) {
    for (const b of rand(16)) {
      if (b >= limite) continue;
      out.push(ALFABETO_CODIGO[b % ALFABETO_CODIGO.length]);
      if (out.length === 8) break;
    }
  }
  return `${out.slice(0, 4).join("")}-${out.slice(4).join("")}`;
}

/** Atalho do link curto (/c/<curto>): 10 caracteres do mesmo alfabeto. */
export function gerarCurto(rand: (n: number) => Uint8Array = (n) => randomBytes(n)): string {
  return gerarCodigo(rand).replace("-", "") + gerarCodigo(rand).slice(0, 2);
}
export function curtoValido(c: string | null | undefined): boolean {
  return new RegExp(`^[${ALFABETO_CODIGO}]{10}$`).test(String(c ?? ""));
}

// ── Assinatura ─────────────────────────────────────────────────────────────────────────────────────────────────
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** Chave própria dos cartões, derivada do segredo do servidor (o segredo em si nunca vai para a URL). */
export function chaveDosCartoes(segredoServidor: string): Buffer {
  if (!segredoServidor || segredoServidor.length < 16) throw new Error("Segredo do servidor ausente para assinar cartões.");
  return createHmac("sha256", segredoServidor).update("viva-nomads:cartoes:v1").digest();
}

/** sig = HMAC_SHA256(ref + listing_id), em hexadecimal. */
export function assinar(chave: Buffer, ref: string, listingId: string): string {
  return createHmac("sha256", chave).update(`${ref}${listingId}`).digest("hex");
}

export function assinaturaConfere(chave: Buffer, ref: string, listingId: string, sig: string | null | undefined): boolean {
  if (!codigoValido(ref) || !UUID_RE.test(listingId) || !/^[0-9a-f]{64}$/.test(String(sig ?? ""))) return false;
  const esperado = Buffer.from(assinar(chave, ref, listingId), "hex");
  const recebido = Buffer.from(String(sig), "hex");
  return esperado.length === recebido.length && timingSafeEqual(esperado, recebido);
}

// ── URL do QR (só domínio próprio) ─────────────────────────────────────────────────────────────────────────────
export const DOMINIOS_PROPRIOS = ["vivanomads.com.br", "www.vivanomads.com.br"];

/** Domínio próprio; o laboratório (localhost/127.0.0.1) só fora de produção. */
export function origemPropria(base: string, producao: boolean): string {
  let u: URL;
  try {
    u = new URL(base);
  } catch {
    throw new Error("Endereço do site inválido para o cartão.");
  }
  const lab = !producao && (u.hostname === "localhost" || u.hostname === "127.0.0.1");
  if (!DOMINIOS_PROPRIOS.includes(u.hostname) && !lab) throw new Error(`Domínio fora da Viva Nomads no cartão: ${u.hostname}`);
  if (!lab && u.protocol !== "https:") throw new Error("O cartão só aponta para https.");
  return u.origin;
}

export type MeioCartao = "qr" | "link";

/** <domínio>/imoveis/<id>?ref&utm_source=share_card&utm_medium=<qr|link>&utm_campaign=<tipo>&utm_content=<id>&sig */
export function urlDoCartao(o: { base: string; producao: boolean; chave: Buffer; ref: string; listingId: string; tipo: TipoCartao; meio: MeioCartao }): string {
  if (!codigoValido(o.ref)) throw new Error("Código de compartilhamento inválido.");
  if (!UUID_RE.test(o.listingId)) throw new Error("Imóvel inválido.");
  const url = new URL(`/imoveis/${o.listingId}`, origemPropria(o.base, o.producao));
  url.searchParams.set("ref", o.ref);
  url.searchParams.set("utm_source", "share_card");
  url.searchParams.set("utm_medium", o.meio);
  url.searchParams.set("utm_campaign", o.tipo);
  url.searchParams.set("utm_content", o.listingId);
  url.searchParams.set("sig", assinar(o.chave, o.ref, o.listingId));
  return url.toString();
}

export interface ParametrosRef {
  ref: string;
  tipo: TipoCartao;
  meio: MeioCartao;
  listingId: string;
}

/**
 * Lê os parâmetros da visita. Só devolve atribuição com assinatura certa, imóvel da própria página e campanha
 * conhecida; qualquer adulteração → null (a página abre normalmente, sem atribuir).
 */
export function lerRef(chave: Buffer, listingIdDaPagina: string, q: Record<string, string | string[] | undefined>): ParametrosRef | null {
  const um = (k: string) => (Array.isArray(q[k]) ? (q[k] as string[])[0] : (q[k] as string | undefined)) ?? "";
  const ref = um("ref");
  const tipo = um("utm_campaign") as TipoCartao;
  const meio = um("utm_medium") as MeioCartao;
  if (!ref && !um("sig")) return null;
  if (um("utm_source") !== "share_card" || !TIPOS_CARTAO.includes(tipo) || (meio !== "qr" && meio !== "link")) return null;
  if (um("utm_content") !== listingIdDaPagina) return null;
  if (!assinaturaConfere(chave, ref, listingIdDaPagina, um("sig"))) return null;
  return { ref, tipo, meio, listingId: listingIdDaPagina };
}

// ── Textos (modelo travado; só campos aprovados) ───────────────────────────────────────────────────────────────
const MESES = ["janeiro", "fevereiro", "março", "abril", "maio", "junho", "julho", "agosto", "setembro", "outubro", "novembro", "dezembro"];

/** "outubro de 2026" — nunca o dia (data só como mês/ano). */
export function mesAno(dataISO: string | null | undefined): string {
  const m = /^(\d{4})-(\d{2})/.exec(String(dataISO ?? ""));
  if (!m) return "";
  const mes = Number(m[2]);
  return mes >= 1 && mes <= 12 ? `${MESES[mes - 1]} de ${m[1]}` : "";
}

/** Só o primeiro nome, e só com o consentimento (opt-in). Sem sobrenome, sem e-mail. */
export function nomeNoCartao(nomeCompleto: string | null | undefined, consentiu: boolean): string {
  if (!consentiu) return "";
  const n = String(nomeCompleto ?? "").trim();
  if (!n || n.includes("@")) return "";
  const primeiro = n.split(/\s+/)[0].replace(/[^\p{L}'-]/gu, "");
  return primeiro.slice(0, 20);
}

export const TEXTOS = {
  poststay: { frase: "Morei aqui com a Viva Nomads", rodape: "Imóveis mobiliados para morar por meses" },
  ownercard: { frase: "Anunciado na Viva Nomads", rodape: "Imóveis mobiliados para morar por meses" },
  qr: "Aponte a câmera para ver o imóvel",
} as const;

const brl = (v: number) => `R$ ${Math.round(v).toString().replace(/\B(?=(\d{3})+(?!\d))/g, ".")}`;

/** "R$ 3.200 por mês · mínimo de 30 dias" (valor mensal e período do anúncio). */
export function textoValorPeriodo(valorMensal: number | null | undefined, minDias: number | null | undefined): string {
  const partes: string[] = [];
  if (valorMensal && valorMensal > 0) partes.push(`${brl(valorMensal)} por mês`);
  if (minDias && minDias > 0) partes.push(`mínimo de ${minDias} dias`);
  return partes.join(" · ");
}

/** Legenda pronta para o WhatsApp: frase fixa + link curto. */
export function legendaWhatsapp(o: { tipo: TipoCartao; cidade: string; bairro?: string | null; link: string }): string {
  const lugar = o.tipo === "ownercard" && o.bairro ? `${o.bairro}, ${o.cidade}` : o.cidade;
  return o.tipo === "poststay"
    ? `Morei neste imóvel mobiliado em ${lugar} pela Viva Nomads. Dá uma olhada: ${o.link}`
    : `Meu imóvel mobiliado em ${lugar} está na Viva Nomads. Veja fotos e valores: ${o.link}`;
}

export function linkWhatsapp(legenda: string): string {
  return `https://wa.me/?text=${encodeURIComponent(legenda)}`;
}

// ── Métricas ───────────────────────────────────────────────────────────────────────────────────────────────────
export const METRICAS_CARTAO = ["cards_generated", "cards_shared", "qr_scans", "ref_listing_views", "ref_bookings"] as const;
export type MetricaCartao = (typeof METRICAS_CARTAO)[number];

// ── Quando o cartão-postal aparece ─────────────────────────────────────────────────────────────────────────────
const STATUS_ESTADIA_ENCERRADA = ["encerrado_em_acerto", "encerrado_sem_renovacao", "concluido"];

/**
 * Depois da saída: contrato assinado pelas duas partes e (encerrado, ou o último bloco já terminou). Cancelado nunca.
 * `fimUltimoBloco` e `hoje` em AAAA-MM-DD (Brasília).
 */
export function estadiaTerminou(c: { status: string; assinadoProprietarioEm: string | null; assinadoInquilinoEm: string | null; fimUltimoBloco: string | null }, hoje: string): boolean {
  if (c.status === "cancelado" || !c.assinadoProprietarioEm || !c.assinadoInquilinoEm) return false;
  if (STATUS_ESTADIA_ENCERRADA.includes(c.status)) return true;
  return !!c.fimUltimoBloco && c.fimUltimoBloco < hoje;
}

/** Cookie de atribuição (30 dias): "<CÓDIGO>|<tipo>|<imóvel>". */
export const REF_COOKIE = "vn_ref";
export const REF_DIAS = 30;
export function valorCookieRef(p: ParametrosRef): string {
  return `${p.ref}|${p.tipo}|${p.listingId}`;
}
export function lerCookieRef(v: string | null | undefined): { ref: string; tipo: TipoCartao; listingId: string } | null {
  const [ref, tipo, listingId] = String(v ?? "").split("|");
  if (!codigoValido(ref) || !TIPOS_CARTAO.includes(tipo as TipoCartao) || !UUID_RE.test(listingId ?? "")) return null;
  return { ref, tipo: tipo as TipoCartao, listingId };
}
