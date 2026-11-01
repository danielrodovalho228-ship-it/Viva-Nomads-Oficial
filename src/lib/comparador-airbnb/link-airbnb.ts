/*
  E399-C — o link do anúncio do Airbnb que o dono cola no cadastro. Guarda só o número do anúncio (a chave do
  fornecedor, desenho do E293); datas, hóspedes e rastreio do link saem. PURO.
  Roda: node --test src/lib/comparador-airbnb/comparador.test.ts
*/

export type LinkAirbnb = { ok: true; id: string; url: string } | { ok: false; vazio?: true; erro: string };

export const ERRO_LINK_AIRBNB = "Cole o link do anúncio no Airbnb (airbnb.com.br/rooms/…).";

/** airbnb.com, airbnb.com.br, airbnb.pt… com ou sem www./m. — e nada depois do domínio. */
const HOST_AIRBNB = /^(?:www\.|m\.)?airbnb\.(?:com|[a-z]{2}|com\.[a-z]{2}|co\.[a-z]{2})$/;
const CAMINHO_ANUNCIO = /^\/rooms\/(?:plus\/)?(\d{3,20})\/?$/;

export function lerLinkAirbnb(texto: string): LinkAirbnb {
  const bruto = (texto ?? "").trim();
  if (!bruto) return { ok: false, vazio: true, erro: "" };
  let u: URL;
  try {
    u = new URL(/^[a-z][a-z0-9+.-]*:/i.test(bruto) ? bruto : `https://${bruto}`);
  } catch {
    return { ok: false, erro: ERRO_LINK_AIRBNB };
  }
  if (u.protocol !== "https:" && u.protocol !== "http:") return { ok: false, erro: ERRO_LINK_AIRBNB };
  if (!HOST_AIRBNB.test(u.hostname.toLowerCase())) return { ok: false, erro: ERRO_LINK_AIRBNB };
  const m = CAMINHO_ANUNCIO.exec(u.pathname);
  if (!m) return { ok: false, erro: ERRO_LINK_AIRBNB };
  return { ok: true, id: m[1], url: `https://www.airbnb.com.br/rooms/${m[1]}` };
}
