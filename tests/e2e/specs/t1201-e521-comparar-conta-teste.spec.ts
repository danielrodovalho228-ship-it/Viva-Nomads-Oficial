import { test, expect } from "@playwright/test";
import { randomBytes } from "node:crypto";
import { NO_LABORATORIO, apagarContas, adm, criarConta, criarImovelPronto, entrar, novaSenha, novoSufixo } from "../fixtures/laboratorio";

/*
  T1201 — E521 (reprova de 05/11, retestes-busca): "/comparar com 2 imóveis NUNCA renderiza a tabela".
  Causa: a busca mostra os anúncios de teste à conta de TESTE logada (E571), mas o /comparar lia a lista pública (sem
  eles) — os 2 marcados na busca não eram achados e a página caía em "Escolha de 2 a 3 imóveis".
   1. conta de teste logada: marca 2 anúncios de teste na busca → Comparar (2) → a tabela abre com as 2 colunas e a
      1ª linha é o total por mês (a mesma base da busca), com o aluguel rotulado à parte;
   2. deslogado: a mesma URL não mostra os anúncios de teste (estado vazio, como antes).
  Laboratório; não é prova ao vivo no site.
*/
const senha = novaSenha();
const sufixo = novoSufixo();
const contas: (string | undefined)[] = [];
const imoveis: string[] = [];
const emails = { dono: "", teste: "" };

test.describe("T1201 — /comparar abre a tabela para a conta de teste (mesma lista da busca)", () => {
  test.skip(!NO_LABORATORIO, "Só no laboratório (contas de teste).");
  test.describe.configure({ mode: "serial" });
  test.setTimeout(120_000);

  test.beforeAll(async () => {
    const tag = `${randomBytes(3).toString("hex")}.${sufixo}`;
    emails.dono = `dono.t1201.${tag}@lab.vivanomads.test`;
    emails.teste = `teste.t1201.${tag}@lab.vivanomads.test`;
    const dono = await criarConta({ email: emails.dono, nome: "Dona T1201 Sobrenome", role: "owner" }, senha);
    const teste = await criarConta({ email: emails.teste, nome: "Tina T1201 Sobrenome", role: "tenant" }, senha);
    contas.push(dono, teste);
    await adm().from("profiles").update({ is_teste: true }).in("id", [dono, teste]);
    imoveis.push(await criarImovelPronto(dono, `Studio T1201 A ${tag}`, { ativo: true, preco: 2000 }));
    imoveis.push(await criarImovelPronto(dono, `Studio T1201 B ${tag}`, { ativo: true, preco: 2100 }));
  });

  test.afterAll(async () => {
    await apagarContas(contas);
  });

  test("1. conta de teste: marca 2 na busca → a tabela abre, com o total por mês na 1ª linha", async ({ browser }) => {
    const page = await entrar(browser, emails.teste, senha);
    await page.goto("/buscar?local=Uberl%C3%A2ndia", { waitUntil: "domcontentloaded" });
    for (const id of imoveis) {
      // O "Comparar" fica no mesmo bloco do cartão (fora do cartao-imovel): o bloco mais interno que tem os dois.
      const bloco = page.locator("div", { has: page.locator(`a[href="/imoveis/${id}"]`) }).filter({ has: page.getByTestId("marcar-comparar") }).last();
      await expect(bloco).toBeVisible({ timeout: 20_000 });
      await bloco.getByTestId("marcar-comparar").check();
    }
    await expect(page.getByTestId("comparar-abrir")).toContainText("Comparar (2)");
    await page.getByTestId("comparar-abrir").click();
    await expect(page).toHaveURL(/\/comparar\?comparar=/);
    await expect(page.getByTestId("comparar-tabela")).toBeVisible({ timeout: 20_000 });
    await expect(page.getByTestId("comparar-vazio")).toHaveCount(0);
    await expect(page.getByTestId("comparar-coluna")).toHaveCount(2);
    const primeira = page.locator("tbody tr").first();
    await expect(primeira).toHaveAttribute("data-linha", "total");
    await expect(page.locator('tr[data-linha="mensal"] th')).toHaveText("Aluguel (só o valor mensal)");
    await page.screenshot({ path: "tests/laboratorio/saida/t1201-comparar-conta-teste.png", fullPage: true });
    await page.context().close();
  });

  test("2. deslogado: os anúncios de teste não entram na comparação (estado vazio)", async ({ page }) => {
    await page.goto(`/comparar?comparar=${imoveis.join(",")}`, { waitUntil: "networkidle" });
    await expect(page.getByTestId("comparar-vazio")).toBeVisible();
    await expect(page.getByTestId("comparar-tabela")).toHaveCount(0);
  });
});
