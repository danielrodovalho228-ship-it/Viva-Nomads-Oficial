import { test, expect } from "@playwright/test";
import type { Page } from "@playwright/test";
import { authFile } from "../fixtures/auth";
import { hasAccount } from "../fixtures/accounts";
import { NO_LABORATORIO, apagarContas, criarConta, entrar, novaSenha, novoSufixo } from "../fixtures/laboratorio";

/*
  T265 — pacote D-V (QA do Muse em produção, 22/10, depois do #998): no fim da rolagem, nada fixo embaixo cobre o fim da
  página. Na página do imóvel a barra de preço (celular) e o "Fale com a Viva" cobriam as duas últimas linhas do rodapé
  ("© … Estadias de 30 a 180 dias" e "A plataforma conecta proprietários e inquilinos — não é parte do contrato"),
  sem respiro que as liberasse. Régua vigente: conteúdo que a rolagem não revela por completo = defeito.
  Confere a 390 e 1280 px: no fim da página, cada linha do rodapé (texto e links) fica inteira acima do topo de todo
  elemento fixo/sticky visível que encosta no fim da tela (abas, barra de preço, "Comparar", "Fale com a Viva").
  Mais, no mesmo pacote (relatos do Daniel no celular, 22/10):
    - hero da home: nunca abre como bloco preto (prévia borrada no HTML; poster com preload e prioridade alta; em 4G
      simulado o poster chega em menos de 3 s);
    - vídeo institucional: o celular pede a versão de 540p, o computador a de 720p, e só no play;
    - a 390 px, o menu superior e a barra inferior aparecem (visitante, proprietário, admin no painel);
    - passos do proprietário novo: cada cartão tem a altura do próprio conteúdo no celular (sem vão).
*/
const LARGURAS = [
  { largura: 390, altura: 844 },
  { largura: 1280, altura: 900 },
] as const;
const ROTAS = [
  { rota: "/imoveis/ube-001", nome: "página do imóvel" },
  { rota: "/", nome: "início" },
  { rota: "/buscar", nome: "busca" },
  { rota: "/cidades/uberlandia", nome: "cidade" },
];

async function rolarAteOFim(page: Page) {
  let alt = -1;
  for (let i = 0; i < 16; i++) {
    await page.evaluate(() => window.scrollTo(0, document.documentElement.scrollHeight));
    await page.waitForTimeout(250);
    const h = await page.evaluate(() => document.documentElement.scrollHeight);
    if (h === alt) break;
    alt = h;
  }
}

/** Linhas do rodapé cobertas por algo fixo no fim da tela: devolve "linha ⟂ fixo". */
async function rodapeCoberto(page: Page): Promise<string[]> {
  return page.evaluate(() => {
    const rodape = document.querySelector("footer.vn-rodape");
    if (!rodape) return ["sem o rodapé do site"];
    const fixoOuSticky = (el: Element) => {
      const p = getComputedStyle(el).position;
      return p === "fixed" || p === "sticky";
    };
    // Os fixos de baixo: visíveis, encostando na metade de baixo da tela, fora do rodapé.
    const fixos = Array.from(document.querySelectorAll<HTMLElement>("body *")).filter((el) => {
      if (!fixoOuSticky(el) || rodape.contains(el)) return false;
      if (!el.checkVisibility({ opacityProperty: true, visibilityProperty: true })) return false;
      const r = el.getBoundingClientRect();
      return r.width > 0 && r.height > 0 && r.top > innerHeight / 2 && r.top < innerHeight;
    });
    const linhas = Array.from(rodape.querySelectorAll<HTMLElement>("p, a, h2, li"))
      .filter((el) => el.getBoundingClientRect().height > 0 && (el.textContent ?? "").trim());
    const out: string[] = [];
    for (const l of linhas) {
      const a = l.getBoundingClientRect();
      for (const f of fixos) {
        const b = f.getBoundingClientRect();
        const cruza = a.left < b.right && a.right > b.left && a.top < b.bottom && a.bottom > b.top;
        if (cruza) out.push(`"${(l.textContent ?? "").trim().slice(0, 50)}" ⟂ ${f.dataset.testid || f.tagName.toLowerCase()}`);
      }
    }
    return [...new Set(out)];
  });
}

for (const { largura, altura } of LARGURAS) {
  test.describe(`T265 — fim da página sem nada fixo por cima (${largura} px)`, () => {
    test.use({ viewport: { width: largura, height: altura }, storageState: { cookies: [], origins: [] } });
    for (const { rota, nome } of ROTAS) {
      test(`${nome}: as últimas linhas do rodapé ficam acima dos fixos`, async ({ page }) => {
        await page.goto(rota, { waitUntil: "networkidle" });
        const ultima = page.locator("footer.vn-rodape p").last();
        await expect(ultima).toContainText("não é parte do contrato");
        // Blocos que carregam depois mudam a altura e o botão compacto cresce: mede de novo até a página assentar.
        await expect
          .poll(
            async () => {
              await rolarAteOFim(page);
              return rodapeCoberto(page);
            },
            { timeout: 15_000 },
          )
          .toEqual([]);
        await expect(ultima).toBeInViewport({ ratio: 1 });
        await page.screenshot({ path: `tests/laboratorio/saida/t265-${nome.replace(/\W+/g, "-")}-${largura}.png` });
      });
    }
    test("página do imóvel: o 'Fale com a Viva' fica acima da barra de preço (celular) e fora do rodapé no fim", async ({ page }) => {
      await page.goto("/imoveis/ube-001", { waitUntil: "networkidle" });
      const flut = page.getByTestId("fale-com-a-viva");
      await expect(flut).toBeVisible();
      if (largura < 1024) {
        const barra = page.getByTestId("barra-fixa-imovel");
        await expect(barra).toBeVisible();
        const [f, b] = [(await flut.boundingBox())!, (await barra.boundingBox())!];
        expect(f.y + f.height).toBeLessThanOrEqual(b.y);
        // A altura medida da barra chegou ao CSS.
        expect(await page.evaluate(() => getComputedStyle(document.documentElement).getPropertyValue("--altura-barra-fixa"))).toMatch(/^\d+px$/);
      }
      // Mede de novo até a página assentar (blocos tardios mudam a altura; a 1ª medida pode vir antes).
      await expect
        .poll(
          async () => {
            await rolarAteOFim(page);
            const f = (await flut.boundingBox())!;
            const copy = (await page.locator("footer.vn-rodape p").last().boundingBox())!;
            return f.y - (copy.y + copy.height);
          },
          { timeout: 15_000, message: "a última linha do rodapé termina acima do botão" },
        )
        .toBeGreaterThanOrEqual(0);
    });
  });
}

// ─────────────────────────── hero da home ───────────────────────────
for (const { largura, altura } of LARGURAS) {
  test.describe(`T265 — hero da home (${largura} px)`, () => {
    test.use({ viewport: { width: largura, height: altura }, storageState: { cookies: [], origins: [] } });
    test("nunca abre preto: prévia no HTML, preload do poster e poster em < 3 s num 4G simulado", async ({ page }) => {
      // 4G comum: ~4 Mb/s de descida e 60 ms de latência.
      const cdp = await page.context().newCDPSession(page);
      await cdp.send("Network.enable");
      await cdp.send("Network.emulateNetworkConditions", { offline: false, latency: 60, downloadThroughput: 500 * 1024, uploadThroughput: 375 * 1024 });
      const inicio = Date.now();
      await page.goto("/", { waitUntil: "commit" });
      // Já no HTML do servidor: o <link rel=preload> do poster e a prévia borrada (data: URI, sem rede).
      const html = await (await page.request.get("/")).text();
      expect(html).toMatch(/<link[^>]+rel="preload"[^>]+hero-home-poster/);
      const previa = page.getByTestId("hero-previa");
      await expect(previa).toBeVisible();
      expect(await previa.evaluate((el) => getComputedStyle(el).backgroundImage)).toMatch(/^url\("data:image\/webp;base64,/);
      const poster = page.getByTestId("hero-poster");
      await expect(poster).toHaveAttribute("fetchpriority", "high");
      await expect.poll(() => poster.evaluate((el: HTMLImageElement) => el.complete && el.naturalWidth > 0), { timeout: 3_000 }).toBe(true);
      const ms = Date.now() - inicio;
      const escolhido = await poster.evaluate((el: HTMLImageElement) => new URL(el.currentSrc).pathname);
      expect(escolhido).toBe(largura < 768 ? "/media/hero-home-poster-768.webp" : "/media/hero-home-poster.webp");
      test.info().annotations.push({ type: "hero", description: `${largura}px: poster ${escolhido} em ${ms} ms (4G simulado)` });
      await page.screenshot({ path: `tests/laboratorio/saida/t265-hero-${largura}.png` });
    });
    test("vídeo institucional: arquivo do tamanho da tela, pedido só no play", async ({ page }) => {
      const pedidos: string[] = [];
      page.on("request", (r) => {
        if (/\/media\/institucional(-540)?\.mp4/.test(r.url())) pedidos.push(new URL(r.url()).pathname);
      });
      await page.goto("/", { waitUntil: "networkidle" });
      expect(pedidos).toEqual([]);
      const video = page.getByTestId("video-institucional");
      await video.scrollIntoViewIfNeeded();
      // Sem esperar a promessa do play: o Chromium de teste não traz H.264 e ela pode nunca resolver (como no t177);
      // o que importa é QUAL arquivo é pedido e que só depois do play.
      await video.evaluate((v: HTMLVideoElement) => {
        void v.play().catch(() => undefined);
      });
      await expect.poll(() => pedidos.length, { timeout: 15_000 }).toBeGreaterThan(0);
      expect(pedidos[0]).toBe(largura < 768 ? "/media/institucional-540.mp4" : "/media/institucional.mp4");
    });
  });
}

// ─────────────────────────── barras a 390 px ───────────────────────────
test.describe("T265 — menu superior e barra inferior a 390 px", () => {
  test.use({ viewport: { width: 390, height: 844 } });
  const barraInferior = (page: Page) => page.locator('nav[aria-label="Navegação principal"]');

  test.describe("visitante", () => {
    test.use({ storageState: { cookies: [], origins: [] } });
    for (const rota of ["/", "/buscar", "/imoveis/ube-001", "/cidades/uberlandia"]) {
      test(`${rota}: cabeçalho e barra de 5 itens visíveis`, async ({ page }) => {
        await page.goto(rota, { waitUntil: "domcontentloaded" });
        await expect(page.locator("[data-logo]").filter({ visible: true }).first()).toBeVisible();
        await expect(barraInferior(page)).toBeVisible({ timeout: 15_000 });
        await expect(barraInferior(page).getByRole("link")).toHaveCount(5);
      });
    }
  });

  test.describe("proprietário", () => {
    test.skip(!hasAccount("proprietario"), "sem a conta do proprietário");
    test.use({ storageState: authFile("proprietario") });
    test("/dashboard: cabeçalho e a barra do proprietário", async ({ page }) => {
      await page.goto("/dashboard", { waitUntil: "domcontentloaded" });
      await expect(page.locator("[data-logo]").filter({ visible: true }).first()).toBeVisible({ timeout: 20_000 });
      await expect(barraInferior(page)).toBeVisible({ timeout: 20_000 });
      await expect(barraInferior(page)).toHaveAttribute("data-papel", "proprietario");
      await expect(barraInferior(page).getByRole("link")).toHaveCount(5);
    });
  });

  test.describe("admin no painel (a conta do Daniel)", () => {
    test.skip(!hasAccount("admin"), "sem a conta do admin");
    test.use({ storageState: authFile("admin") });
    test("/dashboard e /dashboard/conta: a barra do modo ativo aparece; /admin continua sem barra", async ({ page }) => {
      // Os dois prints do Daniel (22/10, 19:59 e 20:00): Painel e Conta.
      for (const rota of ["/dashboard", "/dashboard/conta"]) {
        await page.goto(rota, { waitUntil: "domcontentloaded" });
        await expect(barraInferior(page), rota).toBeVisible({ timeout: 20_000 });
        await expect(barraInferior(page).getByRole("link"), rota).toHaveCount(5);
      }
      await page.goto("/admin", { waitUntil: "domcontentloaded" });
      await expect(page.locator("main").first()).toBeVisible({ timeout: 20_000 });
      await expect(barraInferior(page)).toHaveCount(0);
    });
  });
});

// ─────────────────────────── proprietário novo (Prompt 42: sem o funil de passos) ───────────────────────────
test.describe("T265 — proprietário novo (laboratório)", () => {
  test.skip(!NO_LABORATORIO, "Só no laboratório (cria um proprietário sem imóvel).");
  const senha = novaSenha();
  const dono = { email: `dono.t265.${novoSufixo()}@lab.vivanomads.test`, nome: "Dora Passos", role: "owner" as const };
  let id: string | undefined;
  test.beforeAll(async () => {
    id = await criarConta(dono, senha);
  });
  test.afterAll(async () => {
    await apagarContas([id]);
  });
  test("390 px: nada a decidir, um único primário 'Cadastrar meu imóvel' e a barra do proprietário aparece", async ({ browser }) => {
    test.setTimeout(120_000);
    const page = await entrar(browser, dono.email, senha);
    await page.goto("/dashboard", { waitUntil: "domcontentloaded" });
    await expect(page.getByRole("heading", { level: 1, name: "Nada pede sua decisão hoje" })).toBeVisible({ timeout: 20_000 });
    await expect(page.getByTestId("passos-proprietario")).toHaveCount(0);
    const primarios = page.locator('main [data-cta="primary"]:visible');
    await expect(primarios).toHaveCount(1);
    await expect(primarios.first()).toHaveText(/Cadastrar meu imóvel/);
    await expect(page.locator('nav[aria-label="Navegação principal"]')).toBeVisible();
    await page.screenshot({ path: "tests/laboratorio/saida/t265-dono-novo-390.png", fullPage: true });
    await page.context().close();
  });
});
