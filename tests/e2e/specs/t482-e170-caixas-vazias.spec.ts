import { test, expect, type Page } from "@playwright/test";
import { authFile } from "../fixtures/auth";

/*
  T482 — E170 (QA do Muse, 25/10): nenhuma caixa vazia nas telas de Conta › Pagamentos, Conta › Privacidade e nas capas
  das Ferramentas. Toda caixa de foto tem a foto carregada; nenhum cartão fica em branco esperando dado.
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
