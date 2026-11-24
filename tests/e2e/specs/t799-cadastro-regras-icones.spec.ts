import { test, expect } from "@playwright/test";
import { NO_LABORATORIO, apagarContas, criarConta, novaSenha, novoSufixo } from "../fixtures/laboratorio";
import { abrirPasso, prepararRascunho } from "../fixtures/rascunho-cadastro";

/*
  T799 — conformidade do cadastro (Passo 6, mockup 06, 01/11, Pista A): cada regra da casa tem ícone — os cartões
  sim/não e os blocos de convivência. 390 e 1280.
  E744 (asserção alterada, tabela da Fable #3832): desde o E193/E56 o bloco é um cartão grande (`CartaoEscolha`) com o
  ícone dentro de `bloco-<id>-toggle`, sem o testid `-icone`; o ícone é procurado como `svg` no cartão do bloco. O spec
  ganha conta e rascunho próprios (a conta compartilhada `proprietario` com `?etapa=regras` caía em outro rascunho).
*/
const SAIDA = "tests/laboratorio/saida";
const senha = novaSenha();
const sufixo = novoSufixo();
const dono = { email: `dono.t799.${sufixo}@lab.vivanomads.test`, nome: "Regina Regras", role: "owner" as const };
const ids: { dono?: string; rascunho?: string } = {};

test.describe("T799 — Passo 6 com ícone em cada regra", () => {
  test.skip(!NO_LABORATORIO, "Só no laboratório (conta e rascunho próprios).");
  test.describe.configure({ timeout: 120_000 });
  test.beforeAll(async () => {
    ids.dono = await criarConta(dono, senha);
    ids.rascunho = await prepararRascunho(ids.dono, `Studio t799 ${sufixo}`);
  });
  test.afterAll(async () => {
    await apagarContas([ids.dono]);
  });

  for (const largura of [390, 1280] as const) {
    test(`T799 — Passo 6 com ícone em cada regra (${largura} px)`, async ({ browser }) => {
      const page = await abrirPasso(browser, { email: dono.email, senha }, ids.rascunho!, "regras", largura);
      const grade = page.getByTestId("etapa-regras-casa");
      await expect(grade).toBeVisible({ timeout: 20_000 });
      const cartoes = grade.locator("[data-cartao-assistente]");
      expect(await cartoes.count()).toBeGreaterThanOrEqual(4);
      for (const c of await cartoes.all()) await expect(c.locator("svg").first()).toBeVisible();
      const blocos = page.getByTestId("regras-casa").locator("[data-ligado]");
      expect(await blocos.count()).toBeGreaterThan(0);
      for (const b of await blocos.all()) {
        const id = (await b.getAttribute("data-testid"))!;
        await expect(b.getByTestId(`${id}-toggle`).locator("svg").first()).toBeVisible();
      }
      expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth + 1)).toBe(true);
      await grade.scrollIntoViewIfNeeded();
      await page.screenshot({ path: `${SAIDA}/t799-passo6-${largura}.png` });
      await page.context().close();
    });
  }
});
