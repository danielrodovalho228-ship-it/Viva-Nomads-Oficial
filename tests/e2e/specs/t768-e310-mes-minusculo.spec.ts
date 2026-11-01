import { test, expect } from "@playwright/test";
import { NO_LABORATORIO, apagarContas, criarConta, criarImovelPronto, entrar, novaSenha, novoSufixo } from "../fixtures/laboratorio";

/*
  T768 — E310 (devolução de 01/11): em português o mês é minúsculo — "novembro de 2026", nunca "Novembro de 2026".
  Agenda do proprietário (laboratório) e calendário de disponibilidade da página do imóvel, a 390 e a 1280.
*/
const SAIDA = "tests/laboratorio/saida";
const MES = /^(janeiro|fevereiro|março|abril|maio|junho|julho|agosto|setembro|outubro|novembro|dezembro) de \d{4}$/;

for (const largura of [390, 1280] as const) {
  test(`T768 — E310: calendário do imóvel com o mês minúsculo (${largura} px)`, async ({ page }) => {
    await page.setViewportSize({ width: largura, height: 900 });
    const r = await page.goto("/imoveis/ube-001", { waitUntil: "domcontentloaded" });
    test.skip(!r || r.status() === 404, "Sem o anúncio de exemplo ube-001 neste ambiente.");
    const titulos = page.locator("p").filter({ hasText: MES });
    await expect(titulos.first()).toBeVisible({ timeout: 30_000 });
    for (const t of await titulos.all()) {
      const texto = (await t.innerText()).trim();
      expect(texto, "o que aparece na tela (com o CSS aplicado)").toMatch(MES);
    }
  });
}

test.describe("T768 — E310: Agenda do proprietário", () => {
  test.skip(!NO_LABORATORIO, "Só no laboratório.");
  test.describe.configure({ mode: "serial", timeout: 120_000 });
  const senha = novaSenha();
  const sufixo = novoSufixo();
  const dono = { email: `dono.t768.${sufixo}@lab.vivanomads.test`, nome: "Nina Agenda", role: "owner" as const };
  const ids: { dono?: string } = {};
  test.beforeAll(async () => {
    ids.dono = await criarConta(dono, senha);
    await criarImovelPronto(ids.dono, `Studio agenda t768 ${sufixo}`, { ativo: true });
  });
  test.afterAll(async () => {
    await apagarContas([ids.dono]);
  });
  for (const largura of [1280, 390] as const) {
    test(`${largura} px`, async ({ browser }) => {
      const p = await entrar(browser, dono.email, senha);
      await p.setViewportSize({ width: largura, height: largura === 390 ? 844 : 900 });
      await p.goto("/dashboard/agenda", { waitUntil: "domcontentloaded" });
      const titulo = p.getByTestId("agenda-mes-titulo");
      await expect(titulo).toBeVisible({ timeout: 30_000 });
      // innerText devolve o texto com o CSS aplicado (text-transform/first-letter não aparecem no textContent).
      await expect.poll(() => titulo.evaluate((e) => (e as HTMLElement).innerText.trim())).toMatch(MES);
      expect(await titulo.evaluate((e) => getComputedStyle(e, "::first-letter").textTransform)).not.toBe("uppercase");
      await p.getByTestId("agenda-proximo").click();
      await expect.poll(() => titulo.evaluate((e) => (e as HTMLElement).innerText.trim())).toMatch(MES);
      await p.screenshot({ path: `${SAIDA}/t768-agenda-${largura}.png` });
      await p.context().close();
    });
  }
});
