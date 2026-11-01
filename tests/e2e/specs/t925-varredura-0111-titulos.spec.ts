import { test, expect, type Page } from "@playwright/test";
import { NO_LABORATORIO, apagarContas, criarConta, entrar, novaSenha, novoSufixo } from "../fixtures/laboratorio";
import { abrirComoConta, temContaVarredura } from "../fixtures/varredura";

/*
  T925 — #2008 (Pista A, varredura 01/11): os títulos não pulam mais de h1 para h3 — o estado vazio do painel
  (EmptyState), o nome do candidato em Interessados e o cartão do imóvel no Fechamento viraram h2. Na tela de verdade, a
  390 e a 1280 px, a sequência de títulos VISÍVEIS do <main> começa em h1 e nunca sobe mais de um nível de uma vez:
   - conta nova de morador (sem nada): buscas salvas, candidaturas, propostas e visitas (telas com o EmptyState) — o estado vazio logo abaixo do h1;
   - proprietário da massa (DONO17): Interessados, com o nome do candidato.
*/
const SAIDA = "tests/laboratorio/saida";
const senha = novaSenha();
const sufixo = novoSufixo();
const email = `titulos.t925.${sufixo}@lab.vivanomads.test`;
let id = "";

async function titulos(page: Page) {
  return page.locator("main").first().evaluate((m) =>
    [...m.querySelectorAll("h1,h2,h3,h4,h5,h6")]
      .filter((h) => (h as HTMLElement).offsetParent !== null)
      .map((h) => ({ n: Number(h.tagName[1]), t: (h.textContent ?? "").trim().slice(0, 40) })),
  );
}
function semPulo(lista: { n: number; t: string }[], onde: string) {
  expect(lista.length, `${onde}: há títulos`).toBeGreaterThan(0);
  expect(lista[0].n, `${onde}: começa no h1 ("${lista[0].t}")`).toBe(1);
  for (let i = 1; i < lista.length; i++) {
    expect(lista[i].n - lista[i - 1].n, `${onde}: "${lista[i - 1].t}" (h${lista[i - 1].n}) → "${lista[i].t}" (h${lista[i].n}) pula nível`).toBeLessThanOrEqual(1);
  }
}

test.describe("T925 — #2008: títulos sem pular de h1 para h3 (390 e 1280 px)", () => {
  test.skip(!NO_LABORATORIO, "Só no laboratório.");
  test.describe.configure({ mode: "serial", timeout: 150_000 });

  test.beforeAll(async () => {
    id = await criarConta({ email, nome: "Tina Titulos", role: "tenant" }, senha);
  });
  test.afterAll(async () => {
    await apagarContas([id]);
  });

  for (const largura of [390, 1280] as const) {
    test(`morador sem nada @${largura}: estado vazio em h2 logo abaixo do h1`, async ({ browser }) => {
      const page = await entrar(browser, email, senha);
      await page.setViewportSize({ width: largura, height: largura === 390 ? 844 : 900 });
      for (const rota of ["/dashboard/buscas", "/dashboard/candidaturas", "/dashboard/propostas", "/dashboard/visitas"]) {
        await page.goto(rota, { waitUntil: "domcontentloaded" });
        await expect(page.getByTestId("estado-vazio").first()).toBeVisible({ timeout: 30_000 });
        const lista = await titulos(page);
        console.log(`t925|${rota}|${largura}|${lista.map((h) => `h${h.n}:${h.t}`).join(" > ")}`);
        semPulo(lista, rota);
        expect(await page.getByTestId("estado-vazio").first().locator("h2").count(), `${rota}: o título do estado vazio é h2`).toBeGreaterThan(0);
      }
      await page.screenshot({ path: `${SAIDA}/t925-vazio-${largura}.png` });
      await page.context().close();
    });

    test(`proprietário @${largura}: Interessados com o nome do candidato em h2`, async ({ browser }) => {
      test.skip(!temContaVarredura("DONO17"), "sem a conta DONO17 na massa");
      const { context, page } = await abrirComoConta(browser, "DONO17", largura === 390 ? "390" : "1280");
      await page.goto("/dashboard/leads", { waitUntil: "domcontentloaded" });
      await page.locator("main").first().waitFor({ timeout: 30_000 });
      await page.waitForLoadState("networkidle", { timeout: 15_000 }).catch(() => {});
      const lista = await titulos(page);
      console.log(`t925|/dashboard/leads|${largura}|${lista.map((h) => `h${h.n}:${h.t}`).join(" > ")}`);
      semPulo(lista, "/dashboard/leads");
      const nomes = page.getByTestId("candidato-nome");
      if (await nomes.count()) expect(await nomes.first().evaluate((e) => e.tagName)).toBe("H2");
      await context.close();
    });
  }
});
