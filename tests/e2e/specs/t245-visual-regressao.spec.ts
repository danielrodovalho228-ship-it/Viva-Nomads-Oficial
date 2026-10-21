import { test, expect, type Page, type Locator, type APIRequestContext } from "@playwright/test";
import { authFile } from "../fixtures/auth";
import { hasAccount } from "../fixtures/accounts";

/*
  T245 — Regressão visual (adendo do Prompt 40): `toHaveScreenshot` em 20 telas (13 públicas e 7 logadas da
  matriz), a 390 e 1280 px. A linha de base fica versionada em tests/e2e/visual/t245-visual-regressao.spec.ts/
  (caminho estável, sem plataforma: ver snapshotPathTemplate no playwright.config.ts) e só muda no PR que muda
  aquela tela.

  Gerar / atualizar a linha de base (no mesmo ambiente do laboratório, com a base recém-semeada):
    npx playwright test t245 --update-snapshots          # todas
    npx playwright test t245 -g "home" --update-snapshots # só uma tela
  No laboratório do GitHub, quando falta a linha de base (ou ela mudou), o Playwright grava o print real em
  tests/e2e/.artifacts/<teste>/<nome>-actual.png, que vai no artefato "laboratorio-<run>": baixe, renomeie para
  <nome>.png e versione em tests/e2e/visual/t245-visual-regressao.spec.ts/.

  Estabilidade: fotos (img/vídeo/canvas), mapa, datas, contagens e avatares vão MASCARADOS; animações paradas;
  só a área visível (sem fullPage). Rode t245 ANTES do resto da suíte (ou isolado): outros specs criam imóveis
  e conversas no laboratório e mudariam as listas.
*/
const LARGURAS = [390, 1280] as const;
const altura = (l: number) => (l === 390 ? 844 : 900);

/** O que muda sozinho entre rodadas: fotos, mapa, datas, contagens, nomes e códigos. */
function mascaras(page: Page): Locator[] {
  return [
    page.locator("img, video, canvas, svg image"),
    page.locator('[data-testid="busca-mapa"], [data-testid="mapa-busca"], .leaflet-container, .mapboxgl-map'),
    page.locator("time"),
    page.locator('[data-testid="titulo-busca"], [data-testid="cartao-disponivel"], [data-testid="cartao-nota"], [data-testid="atalho-total"]'),
    page.locator('[data-testid="marca-imovel"], [data-testid="aviso-testes"]'),
    page.locator('[data-visual="muda"]'),
  ];
}

async function pronta(page: Page) {
  await page.evaluate(() => document.fonts.ready);
  // Rola até o fim e volta: carrega o que é preguiçoso e estabiliza o layout antes do print.
  await page.evaluate(async () => {
    window.scrollTo(0, document.body.scrollHeight);
    await new Promise((r) => setTimeout(r, 200));
    window.scrollTo(0, 0);
  });
  await page.waitForTimeout(300);
}

async function print(page: Page, nome: string, alvo?: Locator, tolerancia?: number, extras: Locator[] = []) {
  await pronta(page);
  const opcoes = { mask: [...mascaras(page), ...extras], ...(tolerancia ? { maxDiffPixelRatio: tolerancia } : {}) };
  if (alvo) {
    await alvo.scrollIntoViewIfNeeded();
    await expect(alvo).toHaveScreenshot(`${nome}.png`, opcoes);
  } else {
    await expect(page).toHaveScreenshot(`${nome}.png`, opcoes);
  }
}

async function idsNoAr(request: APIRequestContext): Promise<string[]> {
  const api = (await (await request.get("/api/properties")).json()) as unknown;
  const lista = (Array.isArray(api) ? api : ((api as { properties?: unknown[] }).properties ?? [])) as { id: string }[];
  return lista.map((p) => p.id).sort();
}

test.describe("T245 — Regressão visual (adendo do Prompt 40)", () => {
  test.describe.configure({ timeout: 90_000 });

  for (const largura of LARGURAS) {
    test.describe(`públicas ${largura} px`, () => {
      test.use({ storageState: { cookies: [], origins: [] }, viewport: { width: largura, height: altura(largura) } });

      test("01 home (hero e busca)", async ({ page }) => {
        await page.goto("/", { waitUntil: "networkidle" });
        await print(page, `01-home-${largura}`);
      });

      test("02 home (cartões em destaque)", async ({ page }) => {
        await page.goto("/", { waitUntil: "networkidle" });
        const destaques = page.getByTestId("destaques-home");
        test.skip((await destaques.count()) === 0, "Home sem destaques nesta base.");
        await print(page, `02-home-cartoes-${largura}`, destaques);
      });

      test("03 /buscar", async ({ page }) => {
        await page.goto("/buscar", { waitUntil: "networkidle" });
        await print(page, `03-buscar-${largura}`);
      });

      test("04 /buscar com a folha de filtros aberta", async ({ page }) => {
        await page.goto("/buscar", { waitUntil: "networkidle" });
        if (largura < 1024) await page.getByTestId("abrir-filtros").click();
        else {
          await page.getByTestId("busca-compacta").click();
          await page.getByTestId("mais-filtros").click();
        }
        const folha = page.getByRole("dialog", { name: "Filtros" });
        await expect(folha).toBeVisible();
        // A contagem do botão muda com a base: o botão vai mascarado.
        await pronta(page);
        await expect(page).toHaveScreenshot(`04-buscar-folha-${largura}.png`, { mask: [...mascaras(page), folha.getByTestId("aplicar-filtros")] });
      });

      test("05 /favoritos vazio", async ({ page }) => {
        await page.goto("/favoritos", { waitUntil: "networkidle" });
        await print(page, `05-favoritos-vazio-${largura}`);
      });

      test("06 /favoritos com 2 imóveis", async ({ page, request }) => {
        const ids = (await idsNoAr(request)).slice(0, 2);
        test.skip(ids.length < 2, "Menos de 2 anúncios no ar nesta base.");
        await page.addInitScript((lista) => {
          localStorage.setItem("vivanomads-favorites", JSON.stringify({ state: { owner: null, ids: lista }, version: 0 }));
        }, ids);
        await page.goto("/favoritos", { waitUntil: "networkidle" });
        await expect(page.getByTestId("favoritos-grade")).toHaveAttribute("aria-busy", "false", { timeout: 20_000 });
        await print(page, `06-favoritos-${largura}`);
      });

      test("07 /cidades/uberlandia", async ({ page }) => {
        await page.goto("/cidades/uberlandia", { waitUntil: "networkidle" });
        await print(page, `07-cidade-uberlandia-${largura}`);
      });

      test("08 página do imóvel (topo)", async ({ page }) => {
        await page.goto("/imoveis/ube-001", { waitUntil: "networkidle" });
        await print(page, `08-imovel-${largura}`);
      });

      test("09 imóveis parecidos", async ({ page }) => {
        await page.goto("/imoveis/ube-001", { waitUntil: "networkidle" });
        const bloco = page.getByTestId("imoveis-parecidos");
        test.skip((await bloco.count()) === 0, "Sem parecidos nesta base.");
        // Os parecidos empatam na semelhança: quais entram e em que ordem muda a cada base semeada. O texto dos
        // cartões e a barra fixa do imóvel (que passa por cima do bloco no celular) vão mascarados; a forma do
        // cartão (foto 4:3, linhas, espaçamento) continua comparada.
        const textoDosCartoes = bloco.locator(
          '[data-testid="cartao-local"], [data-testid="cartao-titulo"], [data-testid="cartao-total-mes"], [data-testid="cartao-sintese"]',
        );
        await print(page, `09-imoveis-parecidos-${largura}`, bloco, undefined, [textoDosCartoes, page.getByTestId("barra-fixa-imovel")]);
      });

      for (const [n, rota, nome] of [
        ["10", "/como-funciona", "como-funciona"],
        ["11", "/precos", "precos"],
        ["12", "/para-proprietarios", "para-proprietarios"],
        ["13", "/auth", "entrar"],
      ] as const) {
        test(`${n} ${rota}`, async ({ page }) => {
          await page.goto(rota, { waitUntil: "networkidle" });
          await print(page, `${n}-${nome}-${largura}`);
        });
      }
    });

    for (const [papel, telas] of [
      ["inquilino", [["14", "/dashboard", "painel-inquilino"], ["15", "/dashboard/favoritos", "favoritos-painel"], ["16", "/dashboard/buscas", "buscas-salvas"], ["17", "/dashboard/conta", "conta-inquilino"]]],
      ["proprietario", [["18", "/dashboard", "painel-proprietario"], ["19", "/dashboard/imoveis", "imoveis-proprietario"], ["20", "/dashboard/conta/seguranca", "seguranca-proprietario"]]],
    ] as const) {
      test.describe(`logadas (${papel}) ${largura} px`, () => {
        test.skip(!hasAccount(papel), `Sem a conta de teste ${papel}.`);
        test.use({ storageState: authFile(papel), viewport: { width: largura, height: altura(largura) } });
        for (const [n, rota, nome] of telas) {
          test(`${n} ${rota}`, async ({ page }) => {
            await page.goto(rota, { waitUntil: "networkidle" });
            // Telas logadas têm saudação, contagens e datas da conta: tolerância um pouco maior.
            await print(page, `${n}-${nome}-${largura}`, undefined, 0.02);
          });
        }
      });
    }
  }
});
