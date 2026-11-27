import { test, expect } from "@playwright/test";
import { NO_LABORATORIO, adm, apagarContas, criarConta, novaSenha, novoSufixo } from "../fixtures/laboratorio";
import { noPasso } from "../fixtures/cadastro";
import { abrirPasso, prepararRascunho } from "../fixtures/rascunho-cadastro";

/*
  T1202 — E615: o `?etapa=` da URL acompanha a navegação do assistente. Antes ficava no valor com que a página abriu
  (etapa=4 nos Passos 5 a 10), e atualizar a página devolvia ao passo errado.
   1. Abre o rascunho no Preço (etapa=preco), volta ao Passo 7: a URL diz etapa=descricao, e o recarregar fica no 7.
   2. Volta mais um (Passo 6): a URL diz etapa=regras; abrir o link copiado numa aba nova cai no 6.
  A 390 e 1280 px. Só no laboratório.
*/
const senha = novaSenha();
const sufixo = novoSufixo();
const dono = { email: `dono.t1202.${sufixo}@lab.vivanomads.test`, nome: "Ursula Url", role: "owner" as const };
const ids: { dono?: string; rascunho?: string } = {};

test.describe("T1202 — E615: a URL diz o passo atual do assistente", () => {
  test.skip(!NO_LABORATORIO, "Só no laboratório.");
  test.describe.configure({ mode: "serial", timeout: 120_000 });

  test.beforeAll(async () => {
    ids.dono = await criarConta(dono, senha);
    ids.rascunho = await prepararRascunho(ids.dono, `Rascunho t1202 ${sufixo}`, {}, 8);
  });
  test.afterAll(async () => {
    if (ids.rascunho) await adm().from("properties").delete().eq("id", ids.rascunho);
    await apagarContas([ids.dono!]);
  });

  for (const largura of [390, 1280] as const) {
    test(`${largura} px: voltar muda a URL; recarregar e abrir o link ficam no passo atual`, async ({ browser }) => {
      const page = await abrirPasso(browser, { email: dono.email, senha }, ids.rascunho!, "preco", largura);
      await expect(page).toHaveURL(new RegExp(`draft=${ids.rascunho}&etapa=preco$`));

      await page.getByTestId("cadastro-voltar").click();
      await noPasso(page, "descricao");
      await expect(page, "a URL acompanha o passo").toHaveURL(new RegExp(`draft=${ids.rascunho}&etapa=descricao$`));
      await page.reload({ waitUntil: "domcontentloaded" });
      await noPasso(page, "descricao", 30_000);

      await page.getByTestId("cadastro-voltar").click();
      await noPasso(page, "regras");
      await expect(page).toHaveURL(new RegExp(`draft=${ids.rascunho}&etapa=regras$`));
      const link = page.url();
      const outra = await page.context().newPage();
      await outra.goto(link, { waitUntil: "domcontentloaded" });
      await noPasso(outra, "regras", 30_000);
      await page.context().close();
    });
  }
});
