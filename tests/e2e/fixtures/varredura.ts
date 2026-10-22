import { readFileSync } from "node:fs";
import type { Browser, BrowserContext, Page } from "@playwright/test";
import { hasAccount } from "./accounts";
import { entrar } from "./laboratorio";
import { MOTIVO_ACAO_CANCELADA, MOTIVO_ARQUIVO_CANCELADO, canceladaPeloNavegador } from "./requisicao-cancelada";
import { recursoFicticioDoLab } from "../../../src/lib/varredura-texto";

/**
 * Foto fictícia que outras specs semeiam em paralelo (`criarImovelPronto`: host lab.vivanomads.test). O imóvel aparece
 * nos destaques do painel e da busca, o Next devolve 400 em /_next/image e a imagem não carrega. Não é defeito do site:
 * a t48 já ignora pela mesma regra. Lab de 22/10: a, d e o D-V4 da t249 caíam com isso em execuções diferentes.
 */
export const MOTIVO_FOTO_FICTICIA = "foto fictícia semeada por outra spec (lab.vivanomads.test; 400 em /_next/image)";

/**
 * Apoio da VARREDURA VISUAL (t249): os critérios por tela e tamanho, rodáveis em qualquer rota.
 * Cada critério devolve a lista de problemas (vazia = passou), para a spec juntar tudo por tela.
 *  (a) imagens acima da dobra carregadas SEM rolar (espera até 5 s de rede parada; tiles de mapa ficam de fora);
 *  (b) nenhum elemento fixo/flutuante cobre um controle (elementFromPoint no centro), no topo E no fim da rolagem;
 *  (c) sem overflow horizontal;
 *  (d) sem erro de console/página (exceto a lista curta de terceiros abaixo);
 *  (f) clique em botão primário com resposta visível (erro, progresso ou navegação) em até 3 s.
 */

export const TAMANHOS = [
  { nome: "1280", width: 1280, height: 900 },
  { nome: "390", width: 390, height: 844 },
] as const;
export type Tamanho = (typeof TAMANHOS)[number]["nome"];
export type Criterio = "a-imagens" | "b-cobertura" | "c-overflow" | "d-console" | "f-resposta";

/** Mapa e analytics: ruído de terceiros que a Viva não controla. Cada exceção diz o motivo. */
export const EXCECOES_TERCEIROS: { padrao: RegExp; motivo: string }[] = [
  { padrao: /mapbox|maps\.googleapis|maps\.gstatic|googleapis\.com\/maps|google\.com\/maps/i, motivo: "mapa (Mapbox/Google): tiles, chave e cota são do terceiro" },
  { padrao: /googletagmanager|google-analytics|gtag|doubleclick/i, motivo: "analytics do Google: bloqueado/recusado em navegador de teste" },
  { padrao: /vercel-scripts|vercel-insights|_vercel\/(insights|speed-insights)/i, motivo: "Vercel Analytics/Speed Insights: não existem fora da Vercel (lab local)" },
  { padrao: /ResizeObserver loop/i, motivo: "aviso inofensivo do navegador, sem efeito na tela" },
];
const TILE_DE_MAPA = /mapbox|maps\.googleapis|maps\.gstatic|\/tiles?\/|tile\./i;

export interface Massa {
  ids: Record<string, string>;
  imovel17: string;
  rascunho1: string;
  rascunho0: string;
  imovelTres: string;
  contrato: string;
  contratoTres: string;
  parceiro: string;
  parceiroTres: string;
}
/** Ids gravados por scripts/lab/massa-varredura.mjs; null fora do laboratório com a massa. */
export function lerMassa(): Massa | null {
  try {
    return JSON.parse(readFileSync("tests/laboratorio/saida/varredura.json", "utf8")) as Massa;
  } catch {
    return null;
  }
}

export type ChaveConta = "DONO17" | "DONO0" | "INQUILINA" | "PARCEIRO" | "TRES";
export function temContaVarredura(chave: ChaveConta): boolean {
  return !!process.env[`TESTES_VARREDURA_${chave}_EMAIL`] && !!process.env[`TESTES_VARREDURA_${chave}_SENHA`];
}
/** Sessão logada (login real pela tela, como o resto do laboratório). */
export async function abrirComoConta(browser: Browser, chave: ChaveConta, tamanho: Tamanho): Promise<{ context: BrowserContext; page: Page }> {
  const page = await entrar(browser, process.env[`TESTES_VARREDURA_${chave}_EMAIL`]!, process.env[`TESTES_VARREDURA_${chave}_SENHA`]!);
  const t = TAMANHOS.find((x) => x.nome === tamanho)!;
  await page.setViewportSize({ width: t.width, height: t.height });
  return { context: page.context(), page };
}
export { hasAccount };

/** Abre a rota e espera a casca (o painel não assenta em "networkidle": ver t183). */
export async function abrirRota(page: Page, rota: string): Promise<string[]> {
  const resp = await page.goto(rota, { waitUntil: "domcontentloaded", timeout: 40_000 }).catch((e) => String(e).slice(0, 140));
  if (typeof resp === "string") return [`não abriu: ${resp}`];
  const problemas: string[] = [];
  if (resp && resp.status() >= 400) problemas.push(`HTTP ${resp.status()}`);
  if (new URL(page.url()).pathname === "/auth" && !rota.startsWith("/auth")) problemas.push("caiu no login (sessão não vale)");
  await page.locator("main").first().waitFor({ timeout: 20_000 }).catch(() => problemas.push("sem <main> em 20 s"));
  await page.waitForTimeout(400);
  return problemas;
}

/** (d) Liga a escuta ANTES de abrir a rota; `lista()` devolve só o que não é exceção de terceiro. */
export function escutarErros(page: Page): { lista: () => string[]; ignorados: () => string[] } {
  const brutos: string[] = [];
  let fotoFicticia = false;
  page.on("console", (m) => {
    if (m.type() !== "error") return;
    if (/Failed to load resource/i.test(m.text()) && recursoFicticioDoLab(m.location().url)) {
      fotoFicticia = true;
      return;
    }
    brutos.push(`console: ${m.text()} ${m.location().url ?? ""}`);
  });
  page.on("pageerror", (e) => brutos.push(`página: ${e.message}`));
  let acaoCancelada = false;
  let arquivoCancelado = false;
  page.on("requestfailed", (r) => {
    if (recursoFicticioDoLab(r.url())) {
      fotoFicticia = true;
      return;
    }
    const motivo = r.failure()?.errorText ?? "?";
    const cancelada = canceladaPeloNavegador(motivo, r.method(), r.url(), r.headers());
    if (cancelada === "prefetch") return;
    if (cancelada === "acao") {
      acaoCancelada = true;
      return;
    }
    if (cancelada === "arquivo") {
      arquivoCancelado = true;
      return;
    }
    // Tipo, método e erro do navegador vão junto: a rodada 2 (21/10) acusou a URL da própria tela (sem `_rsc`) e só a URL
    // não diz se é documento, ação do servidor (POST com next-action) ou outra coisa.
    const acao = r.headers()["next-action"] ? ", ação do servidor" : "";
    brutos.push(`requisição falhou (${r.resourceType()} ${r.method()}${acao}, ${motivo}): ${r.url()}`);
  });
  const ehExcecao = (t: string) => EXCECOES_TERCEIROS.some((x) => x.padrao.test(t));
  const limpa = (t: string) => t.replace(/\?.*$/, "").slice(0, 200); // sem query string (pode ter token/dado pessoal)
  return {
    lista: () => [...new Set(brutos.filter((t) => !ehExcecao(t)).map(limpa))],
    ignorados: () => [
      ...new Set([
        ...brutos.filter(ehExcecao).map((t) => EXCECOES_TERCEIROS.find((x) => x.padrao.test(t))!.motivo),
        ...(acaoCancelada ? [MOTIVO_ACAO_CANCELADA] : []),
        ...(arquivoCancelado ? [MOTIVO_ARQUIVO_CANCELADO] : []),
        ...(fotoFicticia ? [MOTIVO_FOTO_FICTICIA] : []),
      ]),
    ],
  };
}

/** (c) */
export async function semOverflow(page: Page): Promise<string[]> {
  const sobra = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
  return sobra > 0 ? [`rolagem lateral de ${sobra}px (scrollWidth > innerWidth)`] : [];
}

/** (a) Imagens que aparecem na primeira tela, SEM rolar. Espera até 5 s por elas; depois, reprova. */
export async function imagensAcimaDaDobra(page: Page): Promise<string[]> {
  await page.evaluate(() => window.scrollTo(0, 0));
  const medir = () =>
    page.evaluate((tile: string) => {
      const reTile = new RegExp(tile, "i");
      // Mesma regra de recursoFicticioDoLab (src/lib/varredura-texto.ts), que não entra no navegador.
      const fotoDoLab = (s: string) => {
        try {
          const u = new URL(s);
          const alvo = u.pathname === "/_next/image" ? new URL(u.searchParams.get("url") ?? "") : u;
          return alvo.hostname === "lab.vivanomads.test";
        } catch {
          return false;
        }
      };
      const ruins: string[] = [];
      for (const img of Array.from(document.images)) {
        const r = img.getBoundingClientRect();
        const cs = getComputedStyle(img);
        if (r.width < 2 || r.height < 2 || cs.visibility === "hidden" || cs.display === "none" || img.closest("[aria-hidden='true']")) continue;
        if (r.bottom <= 0 || r.top >= window.innerHeight || r.right <= 0 || r.left >= window.innerWidth) continue; // fora da dobra
        const src = img.currentSrc || img.src;
        if (reTile.test(src)) continue;
        if (fotoDoLab(src)) continue; // foto fictícia de outra spec (ver MOTIVO_FOTO_FICTICIA)
        if (!(img.complete && img.naturalWidth > 0)) ruins.push(`${(src || "(sem src)").replace(/\?.*$/, "").slice(-70)} (${img.loading || "eager"})`);
      }
      return ruins;
    }, TILE_DE_MAPA.source);
  let ruins = await medir();
  const limite = Date.now() + 5_000;
  while (ruins.length > 0 && Date.now() < limite) {
    await page.waitForTimeout(250);
    ruins = await medir();
  }
  return ruins.map((r) => `imagem acima da dobra não carregou em 5 s sem rolar: ${r}`);
}

/**
 * (b) Fecha modais/folhas e confere, no TOPO e no FIM da página, se algo cobre algum controle visível.
 * Régua do Muse (21/10): controle sob elemento fixo só é defeito quando o usuário não consegue revelá-lo. Por isso cada
 * controle coberto por algo fixo é rolado até o meio da tela (no fim da página, até onde a rolagem deixa) e conferido de
 * novo, no centro e perto dos quatro cantos: se algo fixo continua por cima, é defeito; se a rolagem o revela por inteiro,
 * não é (conteúdo passar sob cabeçalho ou barra fixa durante a rolagem é normal). Sobreposição por elemento NÃO fixo
 * continua sendo defeito direto (rolar não resolve).
 */
export async function controlesCobertos(page: Page): Promise<string[]> {
  await page.keyboard.press("Escape").catch(() => {});
  const problemas: string[] = [];
  for (const posicao of ["topo", "fim"] as const) {
    await page.evaluate((p) => window.scrollTo(0, p === "fim" ? document.documentElement.scrollHeight : 0), posicao);
    // O fim só vale com a altura parada (blocos que carregam depois empurram a página).
    let alt = -1;
    for (let i = 0; i < 12; i++) {
      await page.waitForTimeout(250);
      const h = await page.evaluate(() => document.documentElement.scrollHeight);
      if (h === alt) break;
      alt = h;
      if (posicao === "fim") await page.evaluate(() => window.scrollTo(0, document.documentElement.scrollHeight));
    }
    const achados = await page.evaluate(() => {
      const SEL = "a[href], button, input:not([type=hidden]), select, textarea, [role=button], [role=tab], [role=link], summary";
      const fixoOuSticky = (el: Element | null) => {
        for (let n = el; n; n = n.parentElement) {
          const p = getComputedStyle(n).position;
          if (p === "fixed" || p === "sticky") return true;
        }
        return false;
      };
      const nome = (el: Element) => (el.textContent || el.getAttribute("aria-label") || el.getAttribute("name") || el.tagName).trim().replace(/\s+/g, " ").slice(0, 40);
      const cobre = (el: Element, t: Element | null) => !!t && !(el === t || el.contains(t) || t.contains(el)) && fixoOuSticky(t) && !fixoOuSticky(el);
      // Rola o controle até o meio da tela e devolve o fixo que ainda o cobre (centro ou cantos), ou null se ficou à mostra.
      const continuaCoberto = (el: HTMLElement): Element | null => {
        const salvo = window.scrollY;
        el.scrollIntoView({ block: "center", inline: "nearest", behavior: "instant" });
        const r = el.getBoundingClientRect();
        let achou: Element | null = null;
        for (const [fx, fy] of [[0.5, 0.5], [0.15, 0.15], [0.85, 0.15], [0.15, 0.85], [0.85, 0.85]]) {
          const px = r.left + r.width * fx;
          const py = r.top + r.height * fy;
          if (px < 0 || py < 0 || px > window.innerWidth - 1 || py > window.innerHeight - 1) continue; // maior que a tela
          const t = document.elementFromPoint(px, py);
          if (cobre(el, t)) { achou = t; break; }
        }
        window.scrollTo({ top: salvo, behavior: "instant" });
        return achou;
      };
      const out: string[] = [];
      for (const el of Array.from(document.querySelectorAll<HTMLElement>(SEL))) {
        if (el.closest("[aria-hidden='true'], [inert], dialog:not([open])")) continue;
        if (!el.checkVisibility({ opacityProperty: true, visibilityProperty: true })) continue;
        const r = el.getBoundingClientRect();
        if (r.width < 2 || r.height < 2) continue;
        const x = r.left + r.width / 2;
        const y = r.top + r.height / 2;
        if (x < 0 || y < 0 || x > window.innerWidth - 1 || y > window.innerHeight - 1) continue; // fora da janela: não é visível agora
        // Cortado por ancestral com overflow (carrossel, gaveta): o ponto fora da área do ancestral não conta.
        let cortado = false;
        for (let n = el.parentElement; n && n !== document.body; n = n.parentElement) {
          const s = getComputedStyle(n);
          if (s.overflowX === "visible" && s.overflowY === "visible") continue;
          const a = n.getBoundingClientRect();
          if (x < a.left || x > a.right || y < a.top || y > a.bottom) { cortado = true; break; }
        }
        if (cortado) continue;
        const topo = document.elementFromPoint(x, y);
        if (!topo || el === topo || el.contains(topo) || topo.contains(el)) continue;
        if (topo instanceof HTMLLabelElement && topo.control === el) continue;
        if (fixoOuSticky(topo) && !fixoOuSticky(el)) {
          const fixo = continuaCoberto(el);
          if (fixo) out.push(`"${nome(el)}" coberto por elemento fixo mesmo depois de rolar até ele (${fixo.tagName.toLowerCase()} "${nome(fixo)}")`);
        }
        else if (!fixoOuSticky(topo)) out.push(`"${nome(el)}" coberto por ${topo.tagName.toLowerCase()} "${nome(topo)}"`);
        if (out.length >= 5) break;
      }
      return out;
    });
    problemas.push(...achados.map((a) => `${posicao}: ${a}`));
  }
  await page.evaluate(() => window.scrollTo(0, 0));
  return problemas;
}

/** (f) Clica e exige resposta visível em até 3 s: navegação, alerta/status novo, progresso, botão ocupado ou conteúdo mudou. */
export async function cliqueResponde(page: Page, botao: ReturnType<Page["locator"]>, nome: string): Promise<string[]> {
  const foto = () =>
    page.evaluate(() => {
      const txt = (document.querySelector("main") ?? document.body).innerText;
      const avisos = Array.from(document.querySelectorAll("[role=alert], [role=status], [aria-live], [data-sonner-toast]")).map((e) => (e as HTMLElement).innerText.trim()).filter(Boolean).join("|");
      const progresso = document.querySelectorAll("[role=progressbar], [aria-busy='true'], [data-loading='true']").length;
      return { url: location.pathname + location.search, txt, avisos, progresso, dialogos: document.querySelectorAll("[role=dialog], dialog[open]").length };
    });
  if (!(await botao.first().isVisible().catch(() => false))) return [`botão "${nome}" não aparece na tela`];
  const antes = await foto();
  const habilitado = await botao.first().isEnabled().catch(() => false);
  if (!habilitado) {
    // Trava silenciosa: botão desabilitado só é resposta se a tela disser POR QUÊ (aria-describedby/title ou aviso ao lado).
    const explica = await botao.first().evaluate((el) => !!(el.getAttribute("aria-describedby") || el.getAttribute("title") || el.closest("form,section,div")?.querySelector("[role=alert],[role=status],[data-trava-motivo]")));
    return explica ? [] : [`botão "${nome}" desabilitado sem explicar o motivo`];
  }
  await botao.first().click({ timeout: 5_000 }).catch(() => {});
  const limite = Date.now() + 3_000;
  while (Date.now() < limite) {
    await page.waitForTimeout(200);
    const depois = await foto();
    if (depois.url !== antes.url || depois.avisos !== antes.avisos || depois.progresso > antes.progresso || depois.dialogos > antes.dialogos || depois.txt !== antes.txt) return [];
    const ocupado = await botao.first().evaluate((el) => (el as HTMLButtonElement).disabled || el.getAttribute("aria-busy") === "true").catch(() => true);
    if (ocupado) return [];
  }
  return [`clique em "${nome}" sem resposta visível (erro, progresso ou navegação) em 3 s`];
}

/** Todos os critérios de página (a, b, c, d) numa tela já aberta. `erros` vem de escutarErros(), ligado antes do goto. */
export async function medirTela(page: Page, erros: ReturnType<typeof escutarErros>): Promise<Record<Exclude<Criterio, "f-resposta">, string[]>> {
  const imagens = await imagensAcimaDaDobra(page);
  const overflow = await semOverflow(page);
  const cobertura = await controlesCobertos(page);
  return { "a-imagens": imagens, "b-cobertura": cobertura, "c-overflow": overflow, "d-console": erros.lista() };
}
