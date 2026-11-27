import { test, expect } from "@playwright/test";
import { randomBytes } from "node:crypto";
import { NO_LABORATORIO, adm, apagarContas, criarConta, criarImovelPronto, entrar, novaSenha, novoSufixo } from "../fixtures/laboratorio";

/*
  T853 — E571 (decisão do Daniel, 04/11/2026): a busca mostra anúncios de teste para CONTAS DE TESTE logadas.
   1. logada como conta de teste: o anúncio de teste ativo (negociação ligada) aparece na busca de Uberlândia e o
      filtro "Aceita negociação" (?negocia=1) devolve ele, com o selo;
   2. deslogado: o mesmo anúncio não aparece, nem com o filtro;
   3. conta REAL logada: também não aparece.
*/
const senha = novaSenha();
const sufixo = novoSufixo();
const contas: (string | undefined)[] = [];
let imovel = "";
const emails = { dono: "", teste: "", real: "" };

test.describe("T853 — busca com anúncios de teste só para a conta de teste", () => {
  test.skip(!NO_LABORATORIO, "Só no laboratório (contas de teste).");
  test.describe.configure({ mode: "serial" });
  test.setTimeout(120_000);

  test.beforeAll(async () => {
    const tag = `${randomBytes(3).toString("hex")}.${sufixo}`;
    emails.dono = `dono.t853.${tag}@lab.vivanomads.test`;
    emails.teste = `teste.t853.${tag}@lab.vivanomads.test`;
    emails.real = `real.t853.${tag}@lab.vivanomads.test`;
    const dono = await criarConta({ email: emails.dono, nome: "Dona T853 Sobrenome", role: "owner" }, senha);
    const teste = await criarConta({ email: emails.teste, nome: "Tina T853 Sobrenome", role: "tenant" }, senha);
    const real = await criarConta({ email: emails.real, nome: "Rita T853 Sobrenome", role: "tenant" }, senha);
    contas.push(dono, teste, real);
    await adm().from("profiles").update({ is_teste: true }).in("id", [dono, teste]);
    await adm().from("profiles").update({ is_teste: false }).eq("id", real);
    imovel = await criarImovelPronto(dono, `Casa T853 negocia ${tag}`, { ativo: true, preco: 3100 });
    await adm()
      .from("properties")
      .update({ negociacao: { aceita: true, itens: ["valor_mensal"], descontos: [] } })
      .eq("id", imovel);
  });

  test.afterAll(async () => {
    await apagarContas(contas);
  });

  const cartao = (page: import("@playwright/test").Page) => page.locator(`a[href="/imoveis/${imovel}"]`).first();

  test("1. conta de teste logada: aparece em Uberlândia e no filtro 'Aceita negociação', com o selo", async ({ browser }) => {
    const page = await entrar(browser, emails.teste, senha);
    await page.goto("/buscar?local=Uberl%C3%A2ndia", { waitUntil: "domcontentloaded" });
    await expect(cartao(page)).toBeVisible({ timeout: 20_000 });
    await page.goto("/buscar?local=Uberl%C3%A2ndia&negocia=1", { waitUntil: "domcontentloaded" });
    await expect(cartao(page)).toBeVisible({ timeout: 20_000 });
    await expect(page.locator('[data-testid="cartao-imovel"]', { has: cartao(page) }).getByTestId("cartao-negocia")).toBeVisible();
    await page.context().close();
  });

  test("2. deslogado: o anúncio de teste não aparece, nem com o filtro", async ({ page }) => {
    await page.goto("/buscar?local=Uberl%C3%A2ndia", { waitUntil: "networkidle" });
    await expect(cartao(page)).toHaveCount(0);
    await page.goto("/buscar?local=Uberl%C3%A2ndia&negocia=1", { waitUntil: "networkidle" });
    await expect(cartao(page)).toHaveCount(0);
    expect(await page.content()).not.toContain(imovel);
  });

  test("3. conta real logada: o anúncio de teste não aparece", async ({ browser }) => {
    const page = await entrar(browser, emails.real, senha);
    await page.goto("/buscar?local=Uberl%C3%A2ndia&negocia=1", { waitUntil: "networkidle" });
    await expect(cartao(page)).toHaveCount(0);
    expect(await page.content()).not.toContain(imovel);
    await page.context().close();
  });
});
