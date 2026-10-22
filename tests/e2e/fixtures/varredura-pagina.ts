import type { APIRequestContext, Page } from "@playwright/test";
import { controlesCobertos } from "./varredura";

/**
 * VARREDURA DA PÁGINA INTEIRA (t274): o protocolo do Daniel, tela por tela, rolando a página toda em 390 e 1280 px.
 * Cada classe de defeito tem a sua conferência e devolve a lista de achados (vazia = passou), já com a evidência
 * (elemento, posição na página e medida). Roda contra qualquer TESTES_BASE_URL: produção (só páginas públicas, sem
 * login: as contas de teste não existem lá) ou o laboratório.
 *
 * Por que não basta a t249 (c): html e body usam `overflow-x: clip` (globals.css), então a página nunca ganha rolagem
 * lateral e `scrollWidth` não acusa nada; o que vaza fica CORTADO na borda da tela. Aqui a régua é por elemento.
 */
export const CLASSES = {
  imagem: "imagem vazia, quebrada ou 404 (carregamento real)",
  fixo: "elemento fixo/flutuante sobre conteúdo que a rolagem não revela",
  foto: "cartão sem foto ou com a área da foto vazia",
  estouro: "conteúdo vazando pela direita (ou esquerda) da tela",
  texto: "texto cortado",
  grade: "grade desalinhada ou cartões fora do tamanho uniforme",
} as const;
export type Classe = keyof typeof CLASSES;
export type Achados = Record<Classe, string[]>;

/** Mapa e analytics: imagens de terceiros que a Viva não controla (mesma régua da t249). */
const TERCEIROS = /mapbox|maps\.googleapis|maps\.gstatic|googletagmanager|google-analytics|doubleclick|\/tiles?\//i;
/** No laboratório, outras specs semeiam fotos fictícias (host lab.vivanomads.test): ver MOTIVO_FOTO_FICTICIA. */
const IGNORAR = new RegExp(`${TERCEIROS.source}|lab\\.vivanomads\\.test|lab%2Evivanomads%2Etest`, "i");

/** Rola a página inteira devagar (as imagens lazy entram) e volta ao topo. */
async function rolarTudo(page: Page) {
  await page.evaluate(async () => {
    const pausa = (ms: number) => new Promise((r) => setTimeout(r, ms));
    let y = 0;
    for (let i = 0; i < 80 && y < document.documentElement.scrollHeight; i++) {
      window.scrollTo(0, y);
      await pausa(180);
      y += Math.round(window.innerHeight * 0.8);
    }
    window.scrollTo(0, document.documentElement.scrollHeight);
    await pausa(400);
    window.scrollTo(0, 0);
  });
}

/** Abre, rola tudo e mede as seis classes. `respostasRuins` vem de escutarImagens(), ligado antes do goto. */
export async function varrerPagina(page: Page, respostasRuins: string[]): Promise<Achados> {
  await rolarTudo(page);
  // Imagens: dá até 8 s para as que entraram na rolagem terminarem de carregar.
  const imagensRuins = () =>
    page.evaluate((terceiros: string) => {
      const re = new RegExp(terceiros, "i");
      const ruins: string[] = [];
      for (const img of Array.from(document.images)) {
        const r = img.getBoundingClientRect();
        if (r.width < 2 || r.height < 2 || !img.checkVisibility({ opacityProperty: true, visibilityProperty: true })) continue;
        if (r.right <= 0 || r.left >= window.innerWidth) continue; // slide fora da tela num carrossel
        const src = img.currentSrc || img.getAttribute("src") || "";
        if (re.test(src)) continue;
        if (!src) ruins.push(`<img> sem src (alt="${img.alt.slice(0, 40)}") em y=${Math.round(r.top + scrollY)}`);
        else if (!(img.complete && img.naturalWidth > 0)) {
          let alvo = src;
          try {
            const u = new URL(src, location.href);
            alvo = u.pathname === "/_next/image" ? `/_next/image → ${u.searchParams.get("url")}` : u.pathname;
          } catch {}
          ruins.push(`não carregou: ${alvo.slice(0, 120)} (alt="${img.alt.slice(0, 40)}", ${Math.round(r.width)}×${Math.round(r.height)} em y=${Math.round(r.top + scrollY)})`);
        }
      }
      return ruins;
    }, IGNORAR.source);
  let imagens = await imagensRuins();
  for (const limite = Date.now() + 8_000; imagens.length && Date.now() < limite; ) {
    await page.waitForTimeout(400);
    imagens = await imagensRuins();
  }

  const medirDom = () => page.evaluate((ignorar: string) => {
    const reIgnorar = new RegExp(ignorar, "i");
    const W = window.innerWidth;
    const desc = (el: Element) => {
      const r = el.getBoundingClientRect();
      const cls = typeof el.className === "string" ? el.className.trim().split(/\s+/).slice(0, 3).join(".") : "";
      const txt = (el.textContent ?? "").replace(/\s+/g, " ").trim().slice(0, 50);
      const id = el.getAttribute("data-testid");
      return `<${el.tagName.toLowerCase()}${el.id ? `#${el.id}` : ""}${cls ? `.${cls}` : ""}${id ? `[${id}]` : ""}>${txt ? ` "${txt}"` : ""} [x=${Math.round(r.left)}, y=${Math.round(r.top + scrollY)}, ${Math.round(r.width)}×${Math.round(r.height)}]`;
    };
    const visivel = (el: Element) => {
      const r = el.getBoundingClientRect();
      return r.width > 0 && r.height > 0 && el.checkVisibility({ opacityProperty: true, visibilityProperty: true });
    };
    const todos = Array.from(document.body.querySelectorAll("*")).filter((el) => !el.closest("svg") || el.tagName.toLowerCase() === "svg");

    // ESTOURO: elemento que passa da borda da tela e não está dentro de um carrossel (rolagem lateral de propósito)
    // nem recortado por um ancestral que termina dentro da tela. Só o mais externo de cada vazamento.
    const estouro: string[] = [];
    const vazou = new Set<Element>();
    for (const el of todos) {
      if (!visivel(el)) continue;
      const r = el.getBoundingClientRect();
      const passa = r.right > W + 1 || r.left < -1;
      const naTela = r.left < W - 1 && r.right > 1; // aparece em parte (gaveta fechada fica toda fora)
      if (!passa || !naTela) continue;
      if (el.closest("[aria-hidden='true']") && !(el.textContent ?? "").trim()) continue; // enfeite sem conteúdo
      let ignorar = false;
      for (let a = el.parentElement; a && a !== document.body; a = a.parentElement) {
        const cs = getComputedStyle(a);
        if (/(auto|scroll)/.test(cs.overflowX)) { ignorar = true; break; }
        if (/(hidden|clip)/.test(cs.overflowX)) {
          const ra = a.getBoundingClientRect();
          if (ra.right <= W + 1 && ra.left >= -1) { ignorar = true; break; }
        }
        if (vazou.has(a)) { ignorar = true; break; }
      }
      if (ignorar) continue;
      vazou.add(el);
      const lado = r.right > W + 1 ? `${Math.round(r.right - W)}px além da direita` : `${Math.round(-r.left)}px além da esquerda`;
      estouro.push(`${lado}: ${desc(el)}`);
    }

    // FOTO: espaço de foto (aspect-ratio fixo) sem mídia carregada dentro.
    const foto: string[] = [];
    for (const el of todos) {
      const cs = getComputedStyle(el);
      if (cs.aspectRatio === "auto" || !visivel(el)) continue;
      const r = el.getBoundingClientRect();
      if (r.width < 80 || r.height < 40) continue;
      if (/^(img|video|canvas|iframe|svg|picture)$/i.test(el.tagName)) continue;
      const temMidia =
        // Foto fictícia do laboratório (ou de terceiro) que não carrega já fica fora do critério de imagem: aqui também.
        Array.from(el.querySelectorAll("img")).some((i) => (i.complete && i.naturalWidth > 0) || reIgnorar.test(i.currentSrc || i.src)) ||
        !!el.querySelector("video, canvas, iframe, svg") ||
        [el, ...Array.from(el.querySelectorAll("*"))].some((n) => getComputedStyle(n).backgroundImage !== "none");
      if (!temMidia) foto.push(`área de foto vazia (aspect-ratio ${cs.aspectRatio}): ${desc(el)}`);
    }

    // TEXTO: texto recortado sem reticências nem line-clamp (corte de propósito tem "…").
    const texto: string[] = [];
    for (const el of todos) {
      const temTexto = Array.from(el.childNodes).some((n) => n.nodeType === 3 && (n.textContent ?? "").trim().length > 0);
      if (!temTexto || !visivel(el)) continue;
      const cs = getComputedStyle(el);
      if (!/(hidden|clip)/.test(cs.overflowX + cs.overflowY)) continue;
      if (cs.textOverflow === "ellipsis" || cs.getPropertyValue("-webkit-line-clamp") !== "none") continue;
      const he = el as HTMLElement;
      if (he.clientWidth <= 4 || he.clientHeight <= 4) continue; // sr-only
      const sobraX = he.scrollWidth - he.clientWidth;
      const sobraY = he.scrollHeight - he.clientHeight;
      if (sobraX > 1 || sobraY > 2) texto.push(`${sobraX > 1 ? `${sobraX}px cortados na largura` : `${sobraY}px cortados na altura`}: ${desc(el)}`);
    }

    // GRADE: cartões com foto numa grade (grid ou flex que quebra linha): mesma altura e largura na linha, e as
    // colunas das linhas seguintes alinhadas com as da primeira.
    const grade: string[] = [];
    for (const el of todos) {
      const cs = getComputedStyle(el);
      const ehGrade = /grid/.test(cs.display) || (/flex/.test(cs.display) && cs.flexWrap === "wrap");
      if (!ehGrade || !visivel(el)) continue;
      const filhos = Array.from(el.children).filter((c) => visivel(c) && getComputedStyle(c).position !== "absolute");
      if (filhos.length < 3) continue;
      const cartao = (c: Element) => !!c.querySelector("img") || Array.from(c.querySelectorAll("*")).some((n) => getComputedStyle(n).aspectRatio !== "auto");
      if (!filhos.every(cartao) || new Set(filhos.map((c) => c.tagName)).size > 1) continue;
      // A grade estica o item (li) por padrão: mede a caixa do cartão, descendo pelos invólucros de filho único.
      const caixa = (c: Element) => {
        let n = c;
        for (;;) {
          const so = n.children.length === 1 ? n.children[0] : null;
          const textoProprio = Array.from(n.childNodes).some((t) => t.nodeType === 3 && (t.textContent ?? "").trim());
          if (!so || textoProprio || /^(img|picture|video)$/i.test(so.tagName)) return n.getBoundingClientRect();
          if (Math.abs(so.getBoundingClientRect().width - n.getBoundingClientRect().width) > 2) return n.getBoundingClientRect();
          n = so;
        }
      };
      const rs = filhos.map(caixa);
      const linhas: DOMRect[][] = [];
      for (const r of rs) {
        const l = linhas.find((x) => Math.abs(x[0].top - r.top) <= 4);
        if (l) l.push(r);
        else linhas.push([r]);
      }
      const problemas: string[] = [];
      for (const l of linhas) {
        if (l.length < 2) continue;
        const alt = l.map((r) => Math.round(r.height));
        const lar = l.map((r) => Math.round(r.width));
        if (Math.max(...alt) - Math.min(...alt) > 4) problemas.push(`alturas ${alt.join("/")}px na mesma linha`);
        if (Math.max(...lar) - Math.min(...lar) > 4) problemas.push(`larguras ${lar.join("/")}px na mesma linha`);
      }
      const colunas = linhas[0].map((r) => r.left);
      for (const l of linhas.slice(1)) {
        const fora = l.filter((r) => !colunas.some((c) => Math.abs(c - r.left) <= 4));
        if (fora.length) problemas.push(`${fora.length} cartão(ões) fora das colunas da 1ª linha (x=${fora.map((r) => Math.round(r.left)).join(",")})`);
      }
      if (problemas.length) grade.push(`${[...new Set(problemas)].join("; ")}: ${desc(el)}`);
    }
    return { estouro, foto, texto, grade };
  }, IGNORAR.source);
  // Cartão montado pelo cliente (resultado de /buscar) chega antes da <img>: a área de foto fica vazia por um
  // instante. Lab de 82b4d9b (22/10): Buscar @1280 instável assim. Mesma folga de 8 s das imagens.
  let dom = await medirDom();
  for (const limite = Date.now() + 8_000; dom.foto.length && Date.now() < limite; ) {
    await page.waitForTimeout(400);
    dom = await medirDom();
  }

  const fixo = await controlesCobertos(page);
  return {
    imagem: [...new Set([...respostasRuins, ...imagens])],
    fixo,
    foto: dom.foto,
    estouro: dom.estouro,
    texto: dom.texto,
    grade: dom.grade,
  };
}

/** Liga antes do goto: imagem que voltou com HTTP 4xx/5xx (inclui o /_next/image que não acha a foto). */
export function escutarImagens(page: Page): string[] {
  const ruins: string[] = [];
  page.on("response", (r) => {
    if (r.request().resourceType() !== "image" || r.status() < 400 || IGNORAR.test(decodeURIComponent(r.url()))) return;
    let alvo = r.url();
    try {
      const u = new URL(alvo);
      alvo = u.pathname === "/_next/image" ? `/_next/image → ${u.searchParams.get("url")}` : u.pathname;
    } catch {}
    ruins.push(`HTTP ${r.status()}: ${alvo.slice(0, 140)}`);
  });
  return ruins;
}

/** Caminhos do sitemap do próprio alvo (produção ou laboratório), sem o domínio. */
export async function caminhosDoSitemap(request: APIRequestContext): Promise<string[]> {
  const r = await request.get("/sitemap.xml");
  if (!r.ok()) return [];
  return Array.from((await r.text()).matchAll(/<loc>([^<]+)<\/loc>/g), (m) => {
    try {
      return new URL(m[1]).pathname;
    } catch {
      return m[1];
    }
  });
}

/** Links internos (sem query nem âncora) do HTML de `rota` que casam com `padrao`, na ordem da página, sem repetir. */
export async function linksDe(request: APIRequestContext, rota: string, padrao: RegExp): Promise<string[]> {
  const r = await request.get(rota);
  if (!r.ok()) return [];
  const vistos: string[] = [];
  for (const m of (await r.text()).matchAll(/href="([^"#?]+)"/g)) if (padrao.test(m[1]) && !vistos.includes(m[1])) vistos.push(m[1]);
  return vistos;
}

/** Primeiro link interno do HTML de `rota` que casa com `padrao` (ex.: a página de um parceiro a partir da busca). */
export async function primeiroLink(request: APIRequestContext, rota: string, padrao: RegExp): Promise<string | null> {
  const r = await request.get(rota);
  if (!r.ok()) return null;
  for (const m of (await r.text()).matchAll(/href="([^"#?]+)"/g)) if (padrao.test(m[1])) return m[1];
  return null;
}

export type Rota = { nome: string; rota: string | ((r: APIRequestContext) => Promise<string | null>) };
// Sem a família no sitemap, procura nos links das páginas `alternativas` (produção de 22/10: nenhum imóvel real no
// sitemap, só os de exemplo, que ficam fora dele; parceiro publicado nenhum na busca).
const doSitemap = (padrao: RegExp, n = 0, alternativas: string[] = []) => async (r: APIRequestContext) => {
  const achados = (await caminhosDoSitemap(r)).filter((c) => padrao.test(c));
  for (const rota of alternativas) if (achados.length <= n) for (const l of await linksDe(r, rota, padrao)) if (!achados.includes(l)) achados.push(l);
  return achados[n] ?? null;
};

/** Páginas públicas da varredura (t274) e da conferência de EXIF das imagens servidas (t278). */
export const PAGINAS_PUBLICAS: Rota[] = [
  { nome: "Início", rota: "/" },
  { nome: "Buscar", rota: "/buscar" },
  { nome: "Como funciona", rota: "/como-funciona" },
  { nome: "Para proprietários", rota: "/para-proprietarios" },
  { nome: "Empresas", rota: "/empresas" },
  { nome: "Parceiros", rota: "/parceiros" },
  { nome: "Parceiros — buscar", rota: "/parceiros/buscar" },
  { nome: "Parceiros — limpeza", rota: "/parceiros/buscar?categoria=limpeza" },
  { nome: "Parceiros — mudança", rota: "/parceiros/buscar?categoria=mudanca" },
  { nome: "Parceiros — fotógrafos", rota: "/parceiros/fotografos" },
  { nome: "Guia de fotos", rota: "/guia-fotos" },
  { nome: "Preços", rota: "/precos" },
  { nome: "Segurança", rota: "/seguranca" },
  { nome: "Ajuda", rota: "/ajuda" },
  { nome: "Guias", rota: "/guias" },
  { nome: "Cidades", rota: "/cidades" },
  { nome: "Favoritos (visitante)", rota: "/favoritos" },
  { nome: "Comparar (visitante)", rota: "/comparar" },
  { nome: "Novo pedido (visitante)", rota: "/pedidos/novo" },
  { nome: "Termos", rota: "/termos" },
  { nome: "Privacidade", rota: "/privacidade" },
  { nome: "Guia (1º do sitemap)", rota: doSitemap(/^\/guias\/[^/]+$/) },
  { nome: "Cidade (1ª do sitemap)", rota: doSitemap(/^\/cidades\/[^/]+$/) },
  { nome: "Polo ou bairro (1º do sitemap)", rota: doSitemap(/^\/cidades\/[^/]+\/[^/]+$/) },
  { nome: "Imóveis perto de (1º do sitemap)", rota: doSitemap(/^\/imoveis-perto-de\/[^/]+$/) },
  { nome: "Imóvel (1º do sitemap)", rota: doSitemap(/^\/imoveis\/[^/]+$/, 0, ["/", "/buscar"]) },
  { nome: "Imóvel (2º do sitemap)", rota: doSitemap(/^\/imoveis\/[^/]+$/, 1, ["/", "/buscar"]) },
  { nome: "Imóvel (3º do sitemap)", rota: doSitemap(/^\/imoveis\/[^/]+$/, 2, ["/", "/buscar"]) },
  { nome: "Página do parceiro (1ª da busca)", rota: doSitemap(/^\/parceiros\/(?!buscar$|fotografos$|ativar$)[^/]+$/, 0, ["/parceiros/buscar", "/parceiros/fotografos", "/parceiros"]) },
  {
    nome: "Perfil do proprietário (do 1º imóvel)",
    rota: async (r) => {
      const imovel = await doSitemap(/^\/imoveis\/[^/]+$/, 0, ["/", "/buscar"])(r);
      return imovel ? primeiroLink(r, imovel, /^\/proprietario\/[^/]+$/) : null;
    },
  },
];
