/*
  E640 (c) — visualização PROTEGIDA de fotos de check-in/check-out e do laudo (aprovado pelo Daniel em 05/11/2026). PURO.
  Só as duas partes logadas, link que EXPIRA, sem download e com marca VISÍVEL do nome de quem vê + a data.
  O link é nosso (/api/protegido/conferencia), assinado por HMAC e preso à pessoa logada: não é a URL do armazenamento.
*/
import { createHmac, timingSafeEqual } from "node:crypto";

export const TEXTO_FOTOS_PROTEGIDAS =
  "Fotos protegidas: as de entrada e saída são privadas entre você e o proprietário, sem download e com identificação de quem visualiza.";

/** O link vale por poucos minutos; a tela gera outro a cada carga. */
export const TTL_LINK_PROTEGIDO_S = 300;

export const linkProtegidoPath = (token: string) => `/api/protegido/conferencia?t=${encodeURIComponent(token)}`;

const b64 = (s: string | Buffer) => Buffer.from(s).toString("base64url");
const assinatura = (corpo: string, segredo: string) => createHmac("sha256", segredo).update(corpo).digest("base64url");
const caminhoSeguro = (c: string) => !!c && !c.startsWith("/") && !c.includes("..") && !c.includes("\\") && c.length <= 300;

export function assinarLink(d: { caminho: string; uid: string }, segredo: string, agora: Date = new Date()): string {
  if (!caminhoSeguro(d.caminho)) throw new Error("caminho inválido");
  const corpo = b64(JSON.stringify({ c: d.caminho, u: d.uid, exp: Math.floor(agora.getTime() / 1000) + TTL_LINK_PROTEGIDO_S }));
  return `${corpo}.${assinatura(corpo, segredo)}`;
}

export function verificarLink(token: string, segredo: string, agora: Date = new Date()): { ok: true; caminho: string; uid: string } | { ok: false } {
  try {
    const [corpo, sig] = String(token ?? "").split(".");
    if (!corpo || !sig) return { ok: false };
    const esperado = Buffer.from(assinatura(corpo, segredo));
    const recebido = Buffer.from(sig);
    if (esperado.length !== recebido.length || !timingSafeEqual(esperado, recebido)) return { ok: false };
    const d = JSON.parse(Buffer.from(corpo, "base64url").toString("utf8")) as { c?: unknown; u?: unknown; exp?: unknown };
    if (typeof d.c !== "string" || typeof d.u !== "string" || typeof d.exp !== "number") return { ok: false };
    if (!caminhoSeguro(d.c) || Math.floor(agora.getTime() / 1000) > d.exp) return { ok: false };
    return { ok: true, caminho: d.c, uid: d.u };
  } catch {
    return { ok: false };
  }
}

/** "Visto por Ana Souza em 06/11/2026" — data de Brasília. */
export function marcaTexto(nome: string, agora: Date = new Date()): string {
  const quem = (nome ?? "").trim() || "conta logada";
  const [a, m, d] = new Intl.DateTimeFormat("en-CA", { timeZone: "America/Sao_Paulo" }).format(agora).split("-");
  return `Visto por ${quem} em ${d}/${m}/${a}`;
}

export function escaparXml(s: string): string {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&apos;");
}

/** SVG da marca, repetida na imagem inteira (nenhum canto fica sem ela): contorno escuro + preenchimento claro, legível em foto clara e escura. */
export function svgMarca(largura: number, altura: number, nome: string, agora: Date = new Date()): string {
  const texto = escaparXml(marcaTexto(nome, agora));
  const tam = Math.max(14, Math.round(Math.min(largura, altura) / 22));
  const passoY = Math.round(tam * 4.5);
  const passoX = Math.round(tam * 18);
  const linhas: string[] = [];
  for (let y = Math.round(passoY / 2), i = 0; y < altura + passoY; y += passoY, i++) {
    for (let x = (i % 2 === 0 ? 0 : -Math.round(passoX / 2)) + Math.round(tam); x < largura + passoX; x += passoX) {
      linhas.push(`<text x="${x}" y="${y}" transform="rotate(-24 ${x} ${y})" font-size="${tam}" font-family="Arial, Helvetica, sans-serif" font-weight="700" fill="#ffffff" fill-opacity="0.62" stroke="#000000" stroke-opacity="0.55" stroke-width="${Math.max(1, Math.round(tam / 14))}" paint-order="stroke">${texto}</text>`);
    }
  }
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${largura}" height="${altura}" viewBox="0 0 ${largura} ${altura}">${linhas.join("")}</svg>`;
}
