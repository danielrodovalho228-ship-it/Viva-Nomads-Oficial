import { test, expect } from "@playwright/test";
import { PAGINAS_PUBLICAS } from "../fixtures/varredura-pagina";

/*
  T308 — UM SÓ MARCO PRINCIPAL (<main>) POR PÁGINA PÚBLICA (Pista C, 23/10). O layout das páginas públicas
  (`src/app/(public)/layout.tsx`) já abre `<main id="conteudo">`; página que põe outro `<main>` dentro dele deixa dois
  marcos principais (HTML inválido: o leitor de tela anuncia dois "principal" e o atalho "pular para o conteúdo" fica
  ambíguo). Achado pela Pista B no 62-B2 (`04f97529`: "/conferir tem dois <main>"), registrado como L-22.
  Conta os `<main>` visíveis e escondidos depois da hidratação, a 390 px, como visitante. Os casos já conhecidos entram
  como test.fail com o código L-22: quem corrigir o produto remove o test.fail no mesmo PR (o Playwright avisa).
*/
const EXTRAS = [
  { nome: "Conferir contrato", rota: "/conferir" },
  { nome: "Conferir contrato — código", rota: "/conferir/0000000000000000" },
  { nome: "Desligar alerta de busca", rota: "/alerta-busca/desligar" },
];
// L-22 (23/10): a página põe <main> próprio dentro do <main id="conteudo"> do layout público.
const CONHECIDOS: Record<string, string> = {
  "/conferir": "L-22",
  "/conferir/0000000000000000": "L-22",
  "/alerta-busca/desligar": "L-22",
};

test.describe("T308 — um só <main> por página pública (390 px)", () => {
  test.use({ storageState: { cookies: [], origins: [] }, viewport: { width: 390, height: 844 } });
  test.beforeEach(({}, info) => {
    test.skip(info.project.name !== "chromium", "a contagem não depende do navegador: roda só no chromium");
  });

  for (const p of [...PAGINAS_PUBLICAS, ...EXTRAS]) {
    test(`${p.nome}: um só <main>`, async ({ page, request }) => {
      test.setTimeout(60_000);
      const rota = typeof p.rota === "string" ? p.rota : await p.rota(request);
      test.skip(!rota, `${p.nome}: não existe neste alvo (sitemap/links sem essa família)`);
      if (CONHECIDOS[rota!]) test.fail(true, `${CONHECIDOS[rota!]}: ${rota} põe <main> dentro do <main> do layout`);
      await page.goto(rota!, { waitUntil: "domcontentloaded", timeout: 40_000 });
      await page.locator("main").first().waitFor({ state: "attached", timeout: 20_000 });
      await page.waitForLoadState("networkidle", { timeout: 10_000 }).catch(() => {});
      const mains = await page.locator("main").evaluateAll((els) => els.map((e) => e.id || e.className.split(" ")[0] || "main"));
      expect(mains, `${p.nome} (${rota}): ${mains.length} <main> — ${mains.join(", ")}`).toHaveLength(1);
    });
  }
});
