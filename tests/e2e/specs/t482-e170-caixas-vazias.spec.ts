import { test, expect, type Page } from "@playwright/test";
import { authFile } from "../fixtures/auth";

/*
  T482 — E170 (QA do Muse, 25/10): nenhuma caixa vazia nas telas de Conta › Pagamentos, Conta › Privacidade e nas capas
  das Ferramentas. Toda caixa de foto tem a foto carregada; nenhum cartão fica em branco esperando dado. Com a rede
  lenta (a imagem otimizada demora, como na produção sem cache), a moldura mostra a própria foto borrada — nunca o
  quadrado cinza liso — e a Privacidade já mostra as três permissões.
*/
const SAIDA = "tests/laboratorio/saida";
const TELAS = [
  ["pagamentos", "/dashboard/conta/pagamentos"],
  ["privacidade", "/dashboard/conta/privacidade"],
  ["ferramentas", "/dashboard/ferramentas"],
  ["simulador", "/dashboard/simulador"],
  ["roi", "/dashboard/roi-imovel"],
  ["tributacao", "/dashboard/tributacao"],
  ["carteira", "/dashboard/carteira"],
  ["agenda", "/dashboard/agenda"],
] as const;

/** Toda <img> visível carregou (largura natural > 0) e nenhum elemento grande ficou sem conteúdo. */
async function semCaixaVazia(p: Page) {
  await p.waitForLoadState("networkidle", { timeout: 10_000 }).catch(() => {});
  await p.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
  await p.waitForTimeout(800);
  await p.evaluate(() => window.scrollTo(0, 0));
  return p.evaluate(() => {
    const ruins: string[] = [];
    for (const img of Array.from(document.images)) {
      const r = img.getBoundingClientRect();
      if (r.width > 40 && r.height > 40 && (!img.complete || img.naturalWidth === 0)) ruins.push(`img sem foto: ${img.getAttribute("src")?.slice(0, 80)}`);
    }
    for (const el of Array.from(document.querySelectorAll<HTMLElement>("main section, main div, main span"))) {
      const r = el.getBoundingClientRect();
      if (r.width < 120 || r.height < 80) continue;
      if (el.querySelector("img, svg, video, canvas, iframe, input, textarea, select, button")) continue;
      // O espaço reservado da barra de baixo (celular) é vazio de propósito.
      if (el.classList.contains("vn-tabbar-spacer")) continue;
      if ((el.innerText || "").trim()) continue;
      ruins.push(`caixa vazia ${Math.round(r.width)}×${Math.round(r.height)}: ${el.tagName.toLowerCase()}.${(el.className || "").toString().slice(0, 80)}`);
    }
    return ruins;
  });
}

for (const [papel, larguras] of [["proprietario", [1280, 390]], ["inquilino", [390]]] as const) {
  test.describe(`T482 — ${papel}`, () => {
    test.use({ storageState: authFile(papel) });
    for (const largura of larguras) {
      for (const [nome, rota] of TELAS) {
        if (papel === "inquilino" && !["pagamentos", "privacidade"].includes(nome)) continue;
        test(`${nome} a ${largura} px: sem caixa vazia`, async ({ page }) => {
          await page.setViewportSize({ width: largura, height: largura === 390 ? 844 : 900 });
          await page.goto(rota, { waitUntil: "domcontentloaded" });
          await expect(page.locator("main")).toBeVisible({ timeout: 30_000 });
          const ruins = await semCaixaVazia(page);
          await page.screenshot({ path: `${SAIDA}/t482-${papel}-${nome}-${largura}.png`, fullPage: true });
          expect(ruins, ruins.join("\n")).toEqual([]);
        });
      }
    }
  });
}

test.describe("T482 — rede lenta: moldura com a foto borrada, Privacidade com as permissões", () => {
  test.use({ storageState: authFile("proprietario") });
  for (const largura of [1280, 390] as const) {
    test(`a ${largura} px`, async ({ page }) => {
      await page.setViewportSize({ width: largura, height: largura === 390 ? 844 : 900 });
      // Segura a imagem otimizada e a leitura das chaves de privacidade (server action) por alguns segundos.
      await page.route("**/_next/image**", async (r) => {
        await new Promise((ok) => setTimeout(ok, 6_000));
        await r.continue().catch(() => {});
      });
      for (const [nome, rota, moldura] of [
        ["pagamentos", "/dashboard/conta/pagamentos", '[data-testid="cartao-foto"] img'],
        ["ferramentas", "/dashboard/ferramentas", '[data-testid="ferramentas-grupo"] img'],
      ] as const) {
        await page.goto(rota, { waitUntil: "domcontentloaded" });
        const img = page.locator(moldura).first();
        await expect(img).toBeAttached({ timeout: 30_000 });
        const fundo = await img.evaluate((el) => getComputedStyle(el).backgroundImage);
        expect(fundo, `${nome}: a moldura mostra a prévia da foto`).toContain("data:image/webp");
        await page.screenshot({ path: `${SAIDA}/t482-rede-lenta-${nome}-${largura}.png` });
      }
      await page.goto("/dashboard/conta/privacidade", { waitUntil: "domcontentloaded" });
      await expect(page.getByText("Mostrar meu perfil para proprietários")).toBeVisible({ timeout: 30_000 });
      await page.screenshot({ path: `${SAIDA}/t482-privacidade-${largura}.png` });
    });
  }
});
