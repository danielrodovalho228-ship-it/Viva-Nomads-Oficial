import { test, expect } from "@playwright/test";
import { NO_LABORATORIO, adm, apagarContas, criarConta, entrar, novaSenha, novoSufixo } from "../fixtures/laboratorio";

/*
  T721 — E284 (#1626) e E286 (#1632) juntos, o que a t736 não olha. Pista C, bloco 76 (30/10). Morador SEM estadia,
  1280 e 390:
   1. Sem cidade no perfil: a seção "Serviços" na home tem os 6 cartões com foto carregada e a faixa "Como funciona" com
      os 3 passos; tocar em "Montagem" abre a busca com o seletor mostrando "Montagem de móveis" (ida e volta E284 → E286).
   2. Com cidade no perfil: a frase diz "em <cidade>", cada cartão leva a cidade junto na busca, e a busca abre com a
      categoria e a cidade preenchidas no formulário.
*/
const SAIDA = "tests/laboratorio/saida";
const senha = novaSenha();
const sufixo = novoSufixo();
const semCidade = { email: `mor.t721.${sufixo}@lab.vivanomads.test`, nome: "Rita Semestadia", role: "tenant" as const };
const comCidade = { email: `mor2.t721.${sufixo}@lab.vivanomads.test`, nome: "Caio Comcidade", role: "tenant" as const };
const ids: { semCidade?: string; comCidade?: string } = {};
const CIDADE = "Uberlândia";

test.describe("T721 — E284: Serviços na home do morador sem estadia levam à busca certa (com e sem cidade)", () => {
  test.skip(!NO_LABORATORIO, "Só no laboratório.");
  test.describe.configure({ mode: "serial", timeout: 120_000 });
  test.use({ actionTimeout: 15_000, navigationTimeout: 30_000 });

  test.beforeAll(async () => {
    ids.semCidade = await criarConta(semCidade, senha);
    ids.comCidade = await criarConta(comCidade, senha);
    await adm().from("profiles").update({ preferred_mode: "tenant", papel_ativo: "morador", cidade: null }).eq("id", ids.semCidade);
    const { error } = await adm().from("profiles").update({ preferred_mode: "tenant", papel_ativo: "morador", cidade: CIDADE }).eq("id", ids.comCidade);
    if (error) throw error;
  });
  test.afterAll(async () => {
    await apagarContas([ids.semCidade, ids.comCidade]);
  });

  for (const largura of [1280, 390] as const) {
    test(`1. ${largura} px: sem cidade — 6 cartões com foto, "Como funciona" e Montagem abre a busca com "Montagem de móveis"`, async ({ browser }) => {
      const p = await entrar(browser, semCidade.email, senha);
      await p.setViewportSize({ width: largura, height: largura === 390 ? 844 : 900 });
      await p.goto("/dashboard", { waitUntil: "domcontentloaded" });
      const painel = p.getByTestId("painel-servicos-parceiros");
      await expect(painel).toHaveCount(1, { timeout: 30_000 });
      await painel.scrollIntoViewIfNeeded();
      const imgs = painel.getByTestId("servicos-foto").locator("img");
      await expect(imgs).toHaveCount(6);
      for (let i = 0; i < 6; i++) {
        await imgs.nth(i).scrollIntoViewIfNeeded();
        await expect.poll(() => imgs.nth(i).evaluate((el: HTMLImageElement) => el.complete && el.naturalWidth > 0), { timeout: 15_000 }).toBe(true);
      }
      await expect(painel.getByTestId("servicos-passo")).toHaveCount(3);
      await expect(painel).toContainText("Como funciona");
      // Sem rolagem lateral na home do morador.
      expect(await p.evaluate(() => document.documentElement.scrollWidth - window.innerWidth)).toBeLessThanOrEqual(1);
      await p.screenshot({ path: `${SAIDA}/t721-sem-cidade-${largura}.png`, fullPage: largura === 390 });

      const montagem = painel.getByTestId("servicos-montagem");
      await expect(montagem).toHaveAttribute("href", "/parceiros/buscar?categoria=montagem");
      await montagem.click();
      await expect(p).toHaveURL(/\/parceiros\/buscar\?categoria=montagem$/, { timeout: 30_000 });
      await expect
        .poll(() => p.locator("#bp-categoria").evaluate((s: HTMLSelectElement) => s.options[s.selectedIndex]?.text.trim()), { timeout: 20_000 })
        .toBe("Montagem de móveis");
      await p.context().close();
    });
  }

  for (const largura of [1280, 390] as const) {
    test(`2. ${largura} px: com cidade — a frase diz a cidade e a busca abre com categoria e cidade preenchidas`, async ({ browser }) => {
      const p = await entrar(browser, comCidade.email, senha);
      await p.setViewportSize({ width: largura, height: largura === 390 ? 844 : 900 });
      await p.goto("/dashboard", { waitUntil: "domcontentloaded" });
      const painel = p.getByTestId("painel-servicos-parceiros");
      await expect(painel).toHaveCount(1, { timeout: 30_000 });
      await painel.scrollIntoViewIfNeeded();
      await expect(painel).toContainText(`Parceiros aprovados pela Viva em ${CIDADE}.`);
      const limpeza = painel.getByTestId("servicos-limpeza");
      const href = (await limpeza.getAttribute("href")) ?? "";
      const url = new URL(href, "http://x");
      expect(url.pathname).toBe("/parceiros/buscar");
      expect(url.searchParams.get("categoria")).toBe("limpeza");
      expect(url.searchParams.get("cidade")).toBe(CIDADE);
      await limpeza.click();
      await expect(p).toHaveURL(/categoria=limpeza/, { timeout: 30_000 });
      await expect(p.locator("#bp-categoria")).toHaveValue("limpeza", { timeout: 20_000 });
      await expect(p.locator("#bp-cidade")).toHaveValue(CIDADE);
      await p.screenshot({ path: `${SAIDA}/t721-com-cidade-busca-${largura}.png` });
      await p.context().close();
    });
  }
});
