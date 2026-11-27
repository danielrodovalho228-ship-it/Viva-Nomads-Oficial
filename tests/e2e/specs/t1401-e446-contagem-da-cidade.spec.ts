import { test, expect, type Page } from "@playwright/test";
import { NO_LABORATORIO, apagarContas, criarConta, criarImovelPronto, novaSenha, novoSufixo } from "../fixtures/laboratorio";

/*
  T1401 — E446 (#2971, na main): a página da cidade conta pela MESMA fonte da busca. O número do título
  ("N imóveis em Uberlândia") é o de cartões da lista, a soma dos cartões de bairro é o mesmo N, e reais e exemplos nunca
  viram um número só: quando há exemplos, a linha de detalhe (cidade-contagem-detalhe) separa os dois e soma N; com imóvel
  real publicado, os exemplos saem da base. 390 e 1280 px, sem estouro horizontal.
*/
const senha = novaSenha();
const dono = { email: `dono.t1401.${novoSufixo()}@lab.vivanomads.test`, nome: "Cida Cidade", role: "owner" as const };
const ids: { dono?: string; imovel?: string } = {};
const semRolagem = (page: Page) => page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);

test.describe("T1401 — E446: contagem da cidade pela fonte única da busca", () => {
  test.skip(!NO_LABORATORIO, "Só no laboratório.");
  test.beforeAll(async () => {
    ids.dono = await criarConta(dono, senha);
    ids.imovel = await criarImovelPronto(ids.dono, "Studio da contagem de teste", { ativo: true });
  });
  test.afterAll(async () => {
    await apagarContas([ids.dono]);
  });

  for (const largura of [390, 1280] as const) {
    test(`${largura} px: número do título = cartões = soma dos bairros`, async ({ page, request }) => {
      test.setTimeout(120_000);
      await request.get("/cidades/uberlandia", { timeout: 60_000 }).catch(() => {});
      await page.setViewportSize({ width: largura, height: 900 });
      await page.goto("/cidades/uberlandia", { waitUntil: "domcontentloaded" });
      const titulo = page.getByTestId("cidade-contagem");
      await expect(titulo).toBeVisible({ timeout: 30_000 });
      const m = /^(\d+) imóve(?:l|is) em /.exec(((await titulo.textContent()) ?? "").trim());
      expect(m, `título da contagem: ${await titulo.textContent()}`).toBeTruthy();
      const n = Number(m![1]);
      expect(n).toBeGreaterThanOrEqual(1);
      expect(await page.getByTestId("cidade-imoveis").locator(":scope > *").count(), "cartões = número do título").toBe(n);

      // A soma dos cartões de bairro é o mesmo total da base.
      const textos = await page.getByTestId("bairro-cartao").allTextContents();
      const soma = textos.reduce((s, t) => s + Number(/(\d+) imóve(?:l|is)/.exec(t)?.[1] ?? 0), 0);
      expect(soma, "soma dos bairros = número do título").toBe(n);

      // Reais e exemplos nunca viram um número só: a linha de detalhe, quando existe, soma o mesmo N.
      const detalhe = page.getByTestId("cidade-contagem-detalhe");
      if (await detalhe.count()) {
        const t = (await detalhe.textContent()) ?? "";
        const nums = [...t.matchAll(/(\d+)/g)].map((x) => Number(x[1]));
        if (nums.length === 2) expect(nums[0] + nums[1]).toBe(n);
      }
      expect(await semRolagem(page)).toBeLessThanOrEqual(1);
    });
  }
});
