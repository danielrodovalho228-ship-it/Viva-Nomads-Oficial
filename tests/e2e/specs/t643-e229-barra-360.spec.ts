import { test, expect, type Page } from "@playwright/test";
import { NO_LABORATORIO, adm, apagarContas, criarConta, criarImovelPronto, entrar, novaSenha, novoSufixo } from "../fixtures/laboratorio";

/*
  T643 — E229 (L-74, bloco 60 da Pista C): a barra de baixo do MENUS-5 (5 colunas) a 360 e 390 px, no dono e no
  morador. Nenhum rótulo cortado (reticências), nenhum fora da própria coluna, colunas iguais. A 390 o rótulo segue com
  11 px (nada muda); abaixo de 375 vai a 10 px, só o necessário para "Interessados" caber.
*/
const SAIDA = "tests/laboratorio/saida";
const senha = novaSenha();
const sufixo = novoSufixo();
const dono = { email: `dono.t643.${sufixo}@lab.vivanomads.test`, nome: "Dora Barra", role: "owner" as const };
const morador = { email: `mor.t643.${sufixo}@lab.vivanomads.test`, nome: "Mel Barra", role: "tenant" as const };
const ids: Record<string, string> = {};

async function medir(page: Page) {
  const barra = page.locator("nav[data-papel]:visible").filter({ has: page.locator("ul.grid") }).last();
  await expect(barra).toBeVisible({ timeout: 20_000 });
  const m = await barra.evaluate((nav) =>
    Array.from(nav.querySelectorAll(":scope > ul > li")).map((li) => {
      const r = li.getBoundingClientRect();
      const span = li.querySelector("a > span:last-child") as HTMLElement | null;
      const s = span?.getBoundingClientRect();
      return {
        rotulo: (span?.textContent ?? "").trim(),
        largura: Math.round(r.width * 10) / 10,
        fonte: span ? getComputedStyle(span).fontSize : "",
        cortado: !!span && span.scrollWidth > span.clientWidth,
        foraDaColuna: !!s && (s.left < r.left - 0.5 || s.right > r.right + 0.5),
      };
    })
  );
  return { barra, m };
}

test.describe("T643 — E229: barra de baixo sem rótulo cortado a 360 e 390 px", () => {
  test.skip(!NO_LABORATORIO, "Só no laboratório.");
  test.describe.configure({ mode: "serial", timeout: 120_000 });

  test.beforeAll(async () => {
    ids.dono = await criarConta(dono, senha);
    ids.morador = await criarConta(morador, senha);
    await adm().from("profiles").update({ is_teste: true }).in("id", [ids.dono, ids.morador]);
    await criarImovelPronto(ids.dono, `Studio da barra t643 ${sufixo}`, { ativo: true });
    await adm().from("profiles").update({ preferred_mode: "owner", papel_ativo: "proprietario" }).eq("id", ids.dono);
  });
  test.afterAll(async () => {
    await apagarContas([ids.dono, ids.morador]);
  });

  for (const quem of [
    { nome: "dono", email: dono.email, papel: "proprietario", tem: "Interessados" },
    { nome: "morador", email: morador.email, papel: "inquilino", tem: "Mensagens" },
  ] as const) {
    for (const largura of [360, 390] as const) {
      test(`${quem.nome} a ${largura} px: rótulos inteiros, dentro da coluna, colunas iguais`, async ({ browser }) => {
        const page = await entrar(browser, quem.email, senha);
        await page.setViewportSize({ width: largura, height: 780 });
        await page.goto("/dashboard", { waitUntil: "domcontentloaded" });
        const { barra, m } = await medir(page);
        console.log(`t643|${quem.papel}|${largura}|${JSON.stringify(m)}`);
        expect(m.map((i) => i.rotulo)).toContain(quem.tem);
        expect(m.length).toBeLessThanOrEqual(5);
        expect(m.filter((i) => i.cortado).map((i) => i.rotulo), "rótulos cortados").toEqual([]);
        expect(m.filter((i) => i.foraDaColuna).map((i) => i.rotulo), "rótulos fora da coluna").toEqual([]);
        const larguras = m.map((i) => i.largura);
        expect(Math.max(...larguras) - Math.min(...larguras), "colunas iguais").toBeLessThanOrEqual(1);
        // 390 px (e acima): o tamanho de sempre (11 px). Abaixo de 375: 10 px.
        expect(new Set(m.map((i) => i.fonte))).toEqual(new Set([largura >= 375 ? "11px" : "10px"]));
        await barra.screenshot({ path: `${SAIDA}/t643-barra-${quem.papel}-${largura}.png` });
        await page.context().close();
      });
    }
  }

  test("computador (1280 px): a barra de baixo não aparece (nada muda no desktop)", async ({ browser }) => {
    const page = await entrar(browser, dono.email, senha);
    await page.setViewportSize({ width: 1280, height: 900 });
    await page.goto("/dashboard", { waitUntil: "domcontentloaded" });
    await expect(page.getByTestId("abas-dono")).toBeVisible({ timeout: 30_000 });
    await expect(page.getByRole("navigation", { name: "Navegação principal" })).toBeHidden();
    await page.context().close();
  });
});
