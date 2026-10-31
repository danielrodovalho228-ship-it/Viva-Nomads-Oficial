import { test, expect, type Page } from "@playwright/test";
import { authFile } from "../fixtures/auth";
import { NO_LABORATORIO } from "../fixtures/laboratorio";

/*
  T757 — Varredura visual das telas logadas (Muse, 31/10, frente 2 do cardápio da Pista A): as mesmas classes da
  varredura pública (t756), em 390 e 1280 px, no painel do proprietário e do morador.
  Guarda (expect.soft — o quadro inteiro de uma vez): sem estouro horizontal, sem imagem quebrada na área visível,
  sem fundo bege (o padrão é o clean) e nada fixo/flutuante cobrindo controle no fim da rolagem.
  Pistas (só no log, para a triagem): grade com cartão sozinho na última linha e texto espremido por vizinho.
  O log só leva rota, largura, data-testid e medidas — nunca texto da tela, nome de arquivo ou dado de linha.
*/
const SAIDA = "tests/laboratorio/saida";

const DONO = [
  "/dashboard",
  "/dashboard/imoveis",
  "/dashboard/imoveis/novo",
  "/dashboard/contratos",
  "/dashboard/leads",
  "/dashboard/visitas",
  "/dashboard/agenda",
  "/dashboard/mensagens",
  "/dashboard/carteira",
  "/dashboard/ganhos",
  "/dashboard/avaliacoes",
  "/dashboard/servicos",
  "/dashboard/ferramentas",
  "/dashboard/assinatura",
  "/dashboard/notificacoes",
  "/dashboard/conta",
  "/dashboard/conta/perfil",
  "/dashboard/conta/ajuda",
];
const MORADOR = [
  "/dashboard",
  "/dashboard/favoritos",
  "/dashboard/candidaturas",
  "/dashboard/pedidos",
  "/dashboard/buscas",
  "/dashboard/locacoes",
  "/dashboard/estadia",
  "/dashboard/mensagens",
  "/dashboard/solicitacoes",
  "/dashboard/comparar",
  "/dashboard/notificacoes",
  "/dashboard/conta",
  "/dashboard/conta/ajuda",
];

type Medida = {
  estouro: number;
  quebradas: string[];
  bege: string[];
  cobertos: string[];
  orfaos: string[];
  espremidos: string[];
};

async function medir(p: Page): Promise<Medida> {
  // Rola a página inteira para o lazy-load carregar o que existe.
  const altura = await p.evaluate(() => document.documentElement.scrollHeight);
  for (let y = 0; y <= altura; y += 600) {
    await p.evaluate((v) => window.scrollTo(0, v), y);
    await p.waitForTimeout(80);
  }
  await p.waitForTimeout(600);
  return p.evaluate(() => {
    // Rótulo seguro: data-testid do elemento ou do ancestral mais próximo; senão a tag. Nunca o texto.
    const rotulo = (e: Element) => e.closest("[data-testid]")?.getAttribute("data-testid") ?? e.tagName.toLowerCase();
    const de = document.documentElement;
    const main = document.querySelector("main") ?? document.body;
    const visivel = (e: Element) => {
      const r = e.getBoundingClientRect();
      return r.width > 0 && r.height > 0 && getComputedStyle(e).visibility !== "hidden";
    };
    // Imagem quebrada: completa e sem pixels, dentro da faixa horizontal da tela (fora dela é carrossel não aberto).
    const quebradas = [...document.images]
      .filter((i) => visivel(i) && i.getBoundingClientRect().left < innerWidth && i.getBoundingClientRect().right > 0)
      .filter((i) => i.complete && i.naturalWidth === 0)
      .map(rotulo);
    const bege = new Set<string>();
    for (const e of main.querySelectorAll("*")) {
      const m = getComputedStyle(e).backgroundColor.match(/rgba?\((\d+), (\d+), (\d+)(?:, ([\d.]+))?\)/);
      if (!m) continue;
      const [r, g, b, a] = [+m[1], +m[2], +m[3], m[4] === undefined ? 1 : +m[4]];
      const rr = e.getBoundingClientRect();
      if (a < 0.5 || rr.width < 100 || rr.height < 40) continue;
      if (r > 200 && g > 180 && b > 140 && r - b > 18 && r >= g) bege.add(`${rotulo(e)} ${r},${g},${b}`);
    }
    // No fim da rolagem, nada fixo pode ficar em cima de um controle (o que fica embaixo seria inalcançável).
    window.scrollTo(0, de.scrollHeight);
    const fixos = [...document.querySelectorAll("body *")].filter((e) => getComputedStyle(e).position === "fixed" && visivel(e));
    const cobertos: string[] = [];
    for (const el of main.querySelectorAll("a[href], button, input:not([type=hidden]), select, textarea")) {
      if (fixos.some((f) => f.contains(el)) || !visivel(el)) continue;
      const r = el.getBoundingClientRect();
      if (r.bottom < 0 || r.top > innerHeight) continue;
      const topo = document.elementFromPoint(Math.min(Math.max(r.left + r.width / 2, 0), innerWidth - 1), Math.min(Math.max(r.top + r.height / 2, 0), innerHeight - 1));
      if (!topo || el.contains(topo) || topo.contains(el)) continue;
      const f = fixos.find((x) => x.contains(topo));
      if (f) cobertos.push(`${rotulo(el)} sob ${rotulo(f)}`);
    }
    const orfaos: string[] = [];
    for (const g of main.querySelectorAll("*")) {
      if (getComputedStyle(g).display !== "grid") continue;
      const filhos = [...g.children].filter(visivel);
      if (filhos.length < 3) continue;
      const tops = filhos.map((k) => Math.round(k.getBoundingClientRect().top));
      const linhas = [...new Set(tops)];
      if (linhas.length < 2) continue;
      const porLinha = linhas.map((t) => tops.filter((x) => x === t).length);
      const cols = Math.max(...porLinha);
      if (cols > 1 && porLinha[porLinha.length - 1] === 1) orfaos.push(`${rotulo(g)} ${porLinha.join("+")}`);
    }
    // Texto espremido: cortado com reticências sem ocupar a linha toda do pai (um vizinho tomou o espaço).
    const espremidos: string[] = [];
    for (const e of main.querySelectorAll("*")) {
      if (e.childElementCount !== 0 || !visivel(e)) continue;
      const c = getComputedStyle(e);
      if (c.textOverflow !== "ellipsis" || (e as HTMLElement).scrollWidth <= (e as HTMLElement).clientWidth + 1) continue;
      const pai = e.parentElement!.getBoundingClientRect().width;
      const w = e.getBoundingClientRect().width;
      if (w < pai * 0.6) espremidos.push(`${rotulo(e)} ${Math.round(w)}/${Math.round(pai)}px`);
    }
    return {
      estouro: de.scrollWidth - innerWidth,
      quebradas,
      bege: [...bege],
      cobertos: [...new Set(cobertos)],
      orfaos: [...new Set(orfaos)],
      espremidos: [...new Set(espremidos)].slice(0, 10),
    };
  });
}

async function varrer(page: Page, papel: string, largura: number, rotas: string[]) {
  for (const rota of rotas) {
    const r = await page.goto(rota, { waitUntil: "domcontentloaded" });
    await page.waitForLoadState("networkidle", { timeout: 10_000 }).catch(() => {});
    const m = await medir(page);
    const chegou = new URL(page.url()).pathname;
    console.log(`VARREDURA-LOGADA ${JSON.stringify({ papel, largura, rota, chegou, status: r?.status() ?? 0, ...m })}`);
    const onde = `${papel} ${largura}px ${rota}`;
    expect.soft(m.estouro, `${onde}: estouro horizontal`).toBeLessThanOrEqual(0);
    expect.soft(m.quebradas, `${onde}: imagem quebrada`).toEqual([]);
    expect.soft(m.bege, `${onde}: fundo bege`).toEqual([]);
    expect.soft(m.cobertos, `${onde}: fixo cobrindo controle no fim`).toEqual([]);
    await page.screenshot({ path: `${SAIDA}/t757-${papel}-${largura}${rota.replace(/\//g, "_")}.png`, fullPage: true });
  }
}

for (const largura of [390, 1280]) {
  test.describe(`T757 — varredura visual logada a ${largura} px`, () => {
    test.skip(!NO_LABORATORIO, "Só no laboratório.");
    test.describe.configure({ timeout: 300_000 });
    test.use({ viewport: { width: largura, height: largura === 390 ? 844 : 900 }, actionTimeout: 15_000, navigationTimeout: 30_000 });

    test.describe("proprietário", () => {
      test.use({ storageState: authFile("proprietario") });
      test("telas do painel do proprietário", async ({ page }) => varrer(page, "dono", largura, DONO));
    });
    test.describe("morador", () => {
      test.use({ storageState: authFile("inquilino") });
      test("telas do painel do morador", async ({ page }) => varrer(page, "morador", largura, MORADOR));
    });
  });
}
