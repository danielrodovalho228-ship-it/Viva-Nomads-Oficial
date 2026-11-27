import { test, expect, type Page } from "@playwright/test";
import { NO_LABORATORIO, apagarContas, criarConta, entrar, novaSenha, novoSufixo } from "../fixtures/laboratorio";

/*
  T1612 — E818 (relato do Rogério, 12/11): no cadastro de vistoriador o CNPJ foi dado como inválido e o formulário voltou
  EM BRANCO. Regra (Daniel): erro de validação NUNCA limpa o formulário; o campo com erro fica em vermelho, com a mensagem
  junto dele; a página rola e foca o 1º campo com erro. Vale para o cadastro de parceiro em TODAS as categorias.
   • /dashboard/parceiro/avaliacao (FormAcao, ação do servidor): CNPJ inválido → os demais campos seguem preenchidos,
     o CNPJ fica marcado (aria-invalid + mensagem própria) e com o foco;
   • /parceiros (seja-parceiro-form), uma categoria por vez: o mesmo.
*/
const CNPJ_INVALIDO = "11.111.111/1111-11";
const senha = novaSenha();
const ids: (string | undefined)[] = [];

async function conta(browser: import("@playwright/test").Browser): Promise<Page> {
  const email = `e818.t1612.${novoSufixo()}@lab.vivanomads.test`;
  ids.push(await criarConta({ email, nome: "[TESTE QA] Rogério Vistorias", role: "tenant" }, senha));
  return entrar(browser, email, senha);
}

test.describe("T1612 — E818 erro de validação não limpa o formulário e aponta o campo", () => {
  test.skip(!NO_LABORATORIO, "Só no laboratório (banco local + chave de serviço).");
  test.afterAll(async () => {
    await apagarContas(ids);
  });

  test("vistoriador: CNPJ inválido mantém os campos, marca o CNPJ em vermelho e foca nele", async ({ browser }) => {
    const page = await conta(browser);
    await page.goto("/dashboard/parceiro/avaliacao", { waitUntil: "domcontentloaded" });
    const form = page.getByTestId("credenciamento-form").locator("form");
    await expect(form.locator('[name="nome"]')).toBeVisible({ timeout: 30_000 });
    // Espera a hidratação: antes dela, o envio é o nativo (recarrega a página) e não prova nada.
    await page.waitForLoadState("networkidle", { timeout: 15_000 }).catch(() => {});
    const valores = { nome: "Rogério Vistorias", documento: CNPJ_INVALIDO, cidade: "Uberlândia", experienciaLink: "https://exemplo.com.br/portfolio", relacoes: "Nenhuma relação com imobiliárias." };
    for (const [n, v] of Object.entries(valores)) await form.locator(`[name="${n}"]`).fill(v);
    await form.locator('[name="aceiteConduta"]').check();
    await page.getByTestId("credenciamento-enviar").click();

    const doc = form.locator('[name="documento"]');
    await expect(page.getByTestId("campo-erro-documento")).toHaveText("CNPJ inválido: confira os números.", { timeout: 30_000 });
    await expect(doc).toHaveAttribute("aria-invalid", "true");
    await expect(doc).toHaveClass(/border-red-600/);
    await expect(doc).toBeFocused();
    // (1) nada foi limpo — nem o campo com erro.
    for (const [n, v] of Object.entries(valores)) await expect(form.locator(`[name="${n}"]`)).toHaveValue(v);
    await expect(form.locator('[name="aceiteConduta"]')).toBeChecked();
    // Os outros campos não ficam marcados.
    await expect(form.locator('[name="nome"]')).not.toHaveAttribute("aria-invalid", "true");
    await page.context().close();
  });

  for (const categoria of ["limpeza", "fotografia", "mudanca", "manutencao", "outro"]) {
    test(`parceiro (${categoria}): CNPJ inválido mantém os campos, marca o CNPJ em vermelho e foca nele`, async ({ browser }) => {
      const page = await conta(browser);
      await page.goto("/parceiros#quero-ser-parceiro", { waitUntil: "domcontentloaded" });
      const form = page.getByTestId("seja-parceiro-form");
      await expect(page.getByTestId("sp-aceite")).toBeVisible({ timeout: 30_000 });
      await page.waitForLoadState("networkidle", { timeout: 15_000 }).catch(() => {});
      await form.locator("#sp-nome").fill("Ana Serviços");
      await form.locator("#sp-doc").fill(CNPJ_INVALIDO);
      await page.getByTestId("sp-emite-nota-sim").check({ force: true });
      const cat = page.getByTestId(`sp-cat-${categoria}`);
      if ((await cat.count()) === 0) test.skip(true, `categoria ${categoria} fora do catálogo`);
      await cat.check();
      await form.locator("#sp-cidades").fill("Uberlândia, Araguari");
      if (categoria === "fotografia") await form.locator("#sp-portfolio").fill("https://exemplo.com.br/fotos");
      if (categoria === "mudanca") {
        await form.locator("#sp-empresa").fill("Leva Já");
        await form.locator("#sp-veiculo").fill("Baú 3/4");
      }
      await form.locator("#sp-descricao").fill("Serviço com nota fiscal.");
      await form.locator("#sp-telefone").fill("(34) 99999-0000");
      await page.getByTestId("sp-aceite").check();
      await page.getByTestId("seja-parceiro-enviar").click();

      const doc = form.locator("#sp-doc");
      await expect(page.getByTestId("sp-erro-documento")).toContainText("CNPJ", { timeout: 20_000 });
      await expect(doc).toHaveAttribute("aria-invalid", "true");
      await expect(doc).toHaveClass(/border-red-600/);
      await expect(doc).toBeFocused();
      await expect(doc).toHaveValue(CNPJ_INVALIDO);
      await expect(form.locator("#sp-nome")).toHaveValue("Ana Serviços");
      await expect(form.locator("#sp-cidades")).toHaveValue("Uberlândia, Araguari");
      await expect(form.locator("#sp-descricao")).toHaveValue("Serviço com nota fiscal.");
      await expect(form.locator("#sp-telefone")).toHaveValue("(34) 99999-0000");
      await expect(cat).toBeChecked();
      await expect(page.getByTestId("sp-aceite")).toBeChecked();
      if (categoria === "mudanca") await expect(form.locator("#sp-empresa")).toHaveValue("Leva Já");
      if (categoria === "fotografia") await expect(form.locator("#sp-portfolio")).toHaveValue("https://exemplo.com.br/fotos");
      await page.context().close();
    });
  }
});
