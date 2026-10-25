import { test, expect } from "@playwright/test";
import { NO_LABORATORIO, adm, apagarContas, criarConta, criarImovelPronto, novaSenha, novoSufixo } from "../fixtures/laboratorio";

/*
  T475 — E131 (escalada 25/10): anúncio de CONTA DE TESTE (profiles.is_teste) sem a marca "[TESTE]" no título não aparece na
  vitrine pública — o caso do "RETESTE", que contava como imóvel real e escondia os exemplos da /buscar. Só no laboratório.
   1. /buscar: o anúncio da conta de teste não aparece; o de conta normal, criado igual, aparece; a lista e as contagens
      continuam na mesma base (o título bate com os cartões).
   2. Home: o anúncio da conta de teste também não aparece.
   3. A página do anúncio de teste continua abrindo pelo link (o dono e o QA ainda o usam).
  A 390 e 1280 px, com prints.
*/
const SAIDA = "tests/laboratorio/saida";
const senha = novaSenha();
const sufixo = novoSufixo();
const donoTeste = { email: `dono.t475t.${sufixo}@lab.vivanomads.test`, nome: "Rita Reteste", role: "owner" as const };
const donoReal = { email: `dono.t475r.${sufixo}@lab.vivanomads.test`, nome: "Rui Real", role: "owner" as const };
const ids: Record<string, string> = {};

test.describe("T475 — E131: conta de teste fora da vitrine", () => {
  test.skip(!NO_LABORATORIO, "Só no laboratório.");
  test.describe.configure({ mode: "serial", timeout: 180_000 });

  test.beforeAll(async () => {
    ids.donoTeste = await criarConta(donoTeste, senha);
    ids.donoReal = await criarConta(donoReal, senha);
    await adm().from("profiles").update({ is_teste: true }).eq("id", ids.donoTeste);
    // O mesmo anúncio, sem marca no título, nas duas contas.
    ids.teste = await criarImovelPronto(ids.donoTeste, `Studio RETESTE t475 ${sufixo}`, { ativo: true });
    ids.real = await criarImovelPronto(ids.donoReal, `Studio normal t475 ${sufixo}`, { ativo: true });
  });
  test.afterAll(async () => {
    await apagarContas([ids.donoTeste, ids.donoReal]);
  });

  for (const [w, h] of [[390, 844], [1280, 900]] as const) {
    test(`a ${w} px: a conta de teste fica fora da /buscar e da home; a normal aparece`, async ({ page }) => {
      await page.setViewportSize({ width: w, height: h });
      // Dados frescos: a página pública revalida a cada 60 s; o laboratório sobe sem cache de outra rodada.
      await expect
        .poll(async () => {
          await page.goto("/buscar", { waitUntil: "domcontentloaded" });
          await expect(page.getByTestId("titulo-busca")).toHaveText(/^\d+ imóve(l|is)/, { timeout: 30_000 });
          return page.locator(`a[href="/imoveis/${ids.real}"]`).count();
        }, { timeout: 120_000, intervals: [5_000, 15_000, 30_000] })
        .toBeGreaterThan(0);
      await expect(page.locator(`a[href="/imoveis/${ids.teste}"]`)).toHaveCount(0);
      const total = Number(((await page.getByTestId("titulo-busca").innerText()).match(/\d+/) ?? ["0"])[0]);
      await expect(page.getByTestId("card-resultado")).toHaveCount(total);
      await page.screenshot({ path: `${SAIDA}/t475-buscar-${w}.png` });

      await page.goto("/", { waitUntil: "domcontentloaded" });
      await expect(page.locator(`a[href="/imoveis/${ids.teste}"]`)).toHaveCount(0);

      // 3. O link direto continua abrindo (fora das listagens, não fora do ar).
      const r = await page.goto(`/imoveis/${ids.teste}`, { waitUntil: "domcontentloaded" });
      expect(r?.status()).toBeLessThan(400);
    });
  }
});
