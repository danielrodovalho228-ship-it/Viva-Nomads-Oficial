/*
  Cartões compartilháveis — Fase 1 (só compartilhar; sem recompensa nem cupom). PURO (node --test).
  T1 = cartão-postal pós-estadia (morador) · T2 = cartão do anúncio (proprietário) · partnercard = cartão do parceiro
  (Prompt 31c, a página pública do parceiro).
  O QR leva SEMPRE a uma URL do próprio domínio: /imoveis/<id>?ref=<CÓDIGO>&utm_…&sig=<HMAC-SHA256(ref+id)>, ou
  /parceiros/<slug>?ref=<CÓDIGO>&utm_source=cartao&utm_medium=partnercard&sig=<HMAC-SHA256(ref+parceiroId)>.
  O código é da conta (XXXX-XXXX, alfabeto sem 0/O/1/I/L), revogável; assinatura alterada = sem atribuição.
*/
import { createHmac, randomBytes, timingSafeEqual } from "node:crypto";
import { rotuloCategoria } from "../parceiros/regras.ts";

/** Cartões de imóvel (o QR leva a /imoveis/<id>). */
export type TipoCartaoImovel = "poststay" | "ownercard";
export const TIPOS_CARTAO: readonly TipoCartaoImovel[] = ["poststay", "ownercard"] as const;
/** Todos os cartões: os de imóvel e o do parceiro (o QR leva a /parceiros/<slug>). */
export type TipoCartao = TipoCartaoImovel | "partnercard";

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
export function urlDoCartao(o: { base: string; producao: boolean; chave: Buffer; ref: string; listingId: string; tipo: TipoCartaoImovel; meio: MeioCartao }): string {
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
  tipo: TipoCartaoImovel;
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
  const tipo = um("utm_campaign") as TipoCartaoImovel;
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
export function legendaWhatsapp(o: { tipo: TipoCartaoImovel; cidade: string; bairro?: string | null; link: string }): string {
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
/** Métricas do cartão do parceiro: ref_partner_requests nasce no banco (gatilho da 0192), uma vez por pedido. */
export const METRICAS_CARTAO_PARCEIRO = ["cards_generated", "cards_shared", "qr_scans", "ref_partner_views", "ref_partner_requests"] as const;
export type MetricaCartao = (typeof METRICAS_CARTAO)[number] | (typeof METRICAS_CARTAO_PARCEIRO)[number];

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
export function lerCookieRef(v: string | null | undefined): { ref: string; tipo: TipoCartaoImovel; listingId: string } | null {
  const [ref, tipo, listingId] = String(v ?? "").split("|");
  if (!codigoValido(ref) || !TIPOS_CARTAO.includes(tipo as TipoCartaoImovel) || !UUID_RE.test(listingId ?? "")) return null;
  return { ref, tipo: tipo as TipoCartaoImovel, listingId };
}

// ── Cartão do parceiro (partnercard, Prompt 31c) ───────────────────────────────────────────────────────────────
const SLUG_RE = /^[a-z0-9]+(-[a-z0-9]+)*$/;

/** QR (meio "qr") = exatamente /parceiros/<slug>?ref&utm_source=cartao&utm_medium=partnercard&sig; o link curto
 *  (/c/<curto>) acrescenta utm_content=link, fora da assinatura (só diz se a visita foi pelo QR ou pelo link). */
export function urlDoCartaoParceiro(o: { base: string; producao: boolean; chave: Buffer; ref: string; parceiroId: string; slug: string; meio: MeioCartao }): string {
  if (!codigoValido(o.ref)) throw new Error("Código de compartilhamento inválido.");
  if (!UUID_RE.test(o.parceiroId)) throw new Error("Parceiro inválido.");
  if (!SLUG_RE.test(o.slug)) throw new Error("Endereço da página inválido.");
  const url = new URL(`/parceiros/${o.slug}`, origemPropria(o.base, o.producao));
  url.searchParams.set("ref", o.ref);
  url.searchParams.set("utm_source", "cartao");
  url.searchParams.set("utm_medium", "partnercard");
  url.searchParams.set("sig", assinar(o.chave, o.ref, o.parceiroId));
  if (o.meio === "link") url.searchParams.set("utm_content", "link");
  return url.toString();
}

export interface ParametrosRefParceiro {
  ref: string;
  meio: MeioCartao;
  parceiroId: string;
}

/** Visita à página do parceiro: só com a assinatura certa para ESTE parceiro; qualquer adulteração → null. */
export function lerRefParceiro(chave: Buffer, parceiroIdDaPagina: string, q: Record<string, string | string[] | undefined>): ParametrosRefParceiro | null {
  const um = (k: string) => (Array.isArray(q[k]) ? (q[k] as string[])[0] : (q[k] as string | undefined)) ?? "";
  const ref = um("ref");
  if (!ref && !um("sig")) return null;
  if (um("utm_source") !== "cartao" || um("utm_medium") !== "partnercard") return null;
  if (!assinaturaConfere(chave, ref, parceiroIdDaPagina, um("sig"))) return null;
  return { ref, meio: um("utm_content") === "link" ? "link" : "qr", parceiroId: parceiroIdDaPagina };
}

/** Cookie da atribuição do pedido de serviço (30 dias), separado do vn_ref do imóvel: "<CÓDIGO>|<parceiroId>". */
export const REF_COOKIE_PARCEIRO = "vn_ref_parceiro";
export function valorCookieRefParceiro(p: ParametrosRefParceiro): string {
  return `${p.ref}|${p.parceiroId}`;
}
export function lerCookieRefParceiro(v: string | null | undefined): { ref: string; parceiroId: string } | null {
  const [ref, parceiroId] = String(v ?? "").split("|");
  if (!codigoValido(ref) || !UUID_RE.test(parceiroId ?? "")) return null;
  return { ref, parceiroId };
}

/** O que a página pública do parceiro expõe (a view parceiros_publicos) e o cartão pode usar. */
export interface ParceiroPublicoDoCartao {
  nomePublico: string;
  categorias: string[];
  cidades: string[];
  notaMedia: number | null;
  avaliacoesQtd: number;
  fotoUrl: string | null;
}

export interface CamposCartaoParceiro {
  titulo: string;
  categoria: string;
  cidades: string;
  nota: string;
  selo: string;
  fotoUrl: string | null;
}

export const TEXTOS_PARCEIRO = {
  selo: "Parceiro Viva Nomads",
  novo: "Novo na Viva",
  qr: "Aponte a câmera para ver a página e pedir orçamento",
  rodape: "Contato sempre pela plataforma",
} as const;

/**
 * Tira de um texto público tudo o que é contato ou dado sensível (a página aceita texto livre no nome): e-mail,
 * endereço de site ou rede, @usuário, números longos (telefone, CPF/CNPJ), valores em R$ e nomes de aplicativo de
 * mensagem. O cartão nunca leva contato: quem escaneia fala com o parceiro pela Viva.
 */
export function limparTextoDoCartao(s: string | null | undefined, max = 60): string {
  return String(s ?? "")
    .replace(/\S+@\S+/g, " ")
    .replace(/\b(?:https?:\/\/|www\.)\S+/gi, " ")
    .replace(/\b[a-z0-9-]+\.(?:com|net|org|br|me|io|app|site)(?:\.[a-z]{2})?\S*/gi, " ")
    .replace(/R\$\s*[\d.,]+/gi, " ")
    .replace(/\+?\d[\d\s().\/-]{6,}\d/g, " ")
    .replace(/\b(?:whats\s*app|wpp|zap|zapzap|telegram|insta(?:gram)?|tiktok|facebook|linkedin)\b/gi, " ")
    .replace(/[<>{}()[\]]/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .replace(/^[-–—·:,|/\s]+|[-–—·:,|/\s]+$/g, "")
    .slice(0, max)
    .trim();
}

/**
 * Os ÚNICOS campos que vão para a imagem do cartão do parceiro (a rota de imagem desenha só isto): foto, nome
 * público (com o opt-in), categoria principal, até 2 cidades, nota só com avaliação real (senão "Novo na Viva") e o
 * selo. Nada de telefone, e-mail, documento, preço ou rede social.
 */
export function camposCartaoParceiro(p: ParceiroPublicoDoCartao, mostrarNome: boolean): CamposCartaoParceiro {
  const categoria = rotuloCategoria(String(p.categorias[0] ?? ""));
  const cidades = p.cidades
    .map((c) => limparTextoDoCartao(c, 40))
    .filter(Boolean)
    .slice(0, 2)
    .join(" · ");
  const nome = mostrarNome ? limparTextoDoCartao(p.nomePublico, 50) : "";
  const real = p.avaliacoesQtd > 0 && p.notaMedia != null && p.notaMedia >= 1 && p.notaMedia <= 5;
  const nota = real
    ? `★ ${p.notaMedia!.toFixed(1).replace(".", ",")} · ${p.avaliacoesQtd} ${p.avaliacoesQtd === 1 ? "avaliação" : "avaliações"}`
    : TEXTOS_PARCEIRO.novo;
  const foto = p.fotoUrl && /^https?:\/\//.test(p.fotoUrl) ? p.fotoUrl : null;
  return { titulo: nome || categoria, categoria, cidades, nota, selo: TEXTOS_PARCEIRO.selo, fotoUrl: foto };
}

/** Texto que acompanha o link no compartilhar do aparelho (sem contato; a conversa é pela Viva). */
export function legendaParceiro(o: { categoria: string; cidade: string; link: string }): string {
  const onde = o.cidade ? ` em ${o.cidade}` : "";
  return `${o.categoria}${onde}: veja meu trabalho e peça orçamento pela Viva Nomads. ${o.link}`;
}

/** Fórmulas do admin (/admin/parceiros), escritas na tela. */
export const FORMULAS_CARTAO_PARCEIRO = {
  gerados: "Cartões gerados = cartões do parceiro (tipo partnercard) criados por parceiros com página publicada.",
  pedidos: "Pedidos vindos de cartão = pedidos de serviço com ref_tipo = partnercard (a visita veio do QR ou do link assinado do cartão).",
  teste: "Contas de teste (parceiro ou cliente) ficam fora dos totais.",
} as const;

/**
 * Números do cartão do parceiro para o admin. Por parceiro: tudo (a linha de teste já leva o selo). Totais: sem
 * contas de teste (o parceiro de teste não conta; o pedido feito por cliente de teste também não).
 */
export function numerosCartaoParceiro(o: {
  cartoes: { parceiro_id: string | null; usuario_id: string }[];
  pedidos: { parceiro_id: string; cliente_id: string }[];
  donoDoParceiro: Map<string, string>;
  contasTeste: Set<string>;
}): { porParceiro: Map<string, { gerados: number; pedidos: number }>; total: { gerados: number; pedidos: number } } {
  const porParceiro = new Map<string, { gerados: number; pedidos: number }>();
  const linha = (id: string) => porParceiro.get(id) ?? (porParceiro.set(id, { gerados: 0, pedidos: 0 }), porParceiro.get(id)!);
  const total = { gerados: 0, pedidos: 0 };
  for (const c of o.cartoes) {
    if (!c.parceiro_id) continue;
    linha(c.parceiro_id).gerados++;
    if (!o.contasTeste.has(c.usuario_id)) total.gerados++;
  }
  for (const p of o.pedidos) {
    linha(p.parceiro_id).pedidos++;
    const dono = o.donoDoParceiro.get(p.parceiro_id);
    if (dono && !o.contasTeste.has(dono) && !o.contasTeste.has(p.cliente_id)) total.pedidos++;
  }
  return { porParceiro, total };
}
