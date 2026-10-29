// Portão pós-#1500 (Pista C, 29/10): o E193 (#1496) trocou listas e caixas por pílulas e cartões no assistente e no editor; roda no lab-crítico deste PR.
import { test, expect, type Browser } from "@playwright/test";
import { NO_LABORATORIO, apagarContas, criarConta, entrar, novaSenha, novoSufixo } from "../fixtures/laboratorio";
import { abrirNoEndereco, irParaAntesDePublicar } from "../fixtures/cadastro";

/*
  T457 — E112 (reprova ao vivo do E104): na Revisão (Passo 10), o aviso "Documento do imóvel ainda não enviado" dizia
  "Enviar no passo Endereço", mas o Passo 3 não tem mais o envio. Só no laboratório (contas novas).
   1. Com o endereço completo: a seção "Documento do imóvel" do "Antes de publicar" (E251: acordeão) diz "falta ·
      Ainda não enviado" e o "Enviar documento" dela abre a escolha do arquivo ali mesmo. Nenhum "passo Endereço" na tela.
   2. Sem o número: o mesmo botão leva ao Passo 3 com o foco no número (o que falta para conferir o documento).
  A 390 e 1280 px, com prints do Passo 10.
*/
const senha = novaSenha();
const sufixo = novoSufixo();
const ids: string[] = [];
const SAIDA = "tests/laboratorio/saida";

async function dono(browser: Browser, largura: number, chave: string) {
  const email = `dono.t457.${chave}.${largura}.${sufixo}@lab.vivanomads.test`;
  ids.push(await criarConta({ email, nome: `Rui Documento ${chave}`, role: "owner" }, senha));
  const page = await entrar(browser, email, senha);
  await page.setViewportSize({ width: largura, height: largura === 390 ? 844 : 900 });
  return page;
}

test.describe("T457 — E112: o documento do imóvel se envia na própria Revisão", () => {
  test.skip(!NO_LABORATORIO, "Só no laboratório (contas novas, CEP simulado).");
  test.describe.configure({ mode: "serial" });
  test.setTimeout(180_000);
  test.afterAll(async () => {
    await apagarContas(ids);
  });

  for (const largura of [390, 1280] as const) {
    test(`1. ${largura}px — com endereço: o 'Enviar documento' da seção abre a escolha do arquivo no Passo 10`, async ({ browser }) => {
      const page = await dono(browser, largura, "com");
      await page.route("https://viacep.com.br/ws/**", (r) =>
        r.fulfill({ json: { cep: "38400-100", logradouro: "Rua do Laboratório", bairro: "Centro", localidade: "Uberlândia", uf: "MG" } }),
      );
      await abrirNoEndereco(page);
      await page.getByTestId("cadastro-cep").fill("38400100");
      await expect(page.getByTestId("cadastro-rua")).toHaveValue("Rua do Laboratório", { timeout: 10_000 });
      await page.getByTestId("cadastro-numero").fill("102");
      await page.waitForTimeout(2_500);
      await expect(page.getByText(/Salvo/).first()).toBeVisible({ timeout: 15_000 });
      await irParaAntesDePublicar(page);

      // E251: o estado do documento é a linha da própria seção do acordeão (aberta pelo irParaAntesDePublicar).
      const secao = page.getByTestId("antes-secao-documento");
      await expect(secao).toHaveAttribute("data-estado", "falta");
      await expect(secao.getByTestId("antes-secao-documento-abrir")).toContainText("Ainda não enviado");
      const botao = secao.getByTestId("documento-enviar");
      await expect(botao).toBeVisible();
      expect((await botao.boundingBox())!.height, "toque de 44 px").toBeGreaterThanOrEqual(44);
      await expect(page.locator("main")).not.toContainText("passo Endereço");
      await secao.scrollIntoViewIfNeeded();
      await page.screenshot({ path: `${SAIDA}/t457-revisao-documento-${largura}.png` });

      const [escolha] = await Promise.all([page.waitForEvent("filechooser", { timeout: 5_000 }), botao.click()]);
      expect(escolha).toBeTruthy();
      // Continua no Passo 10, com o cartão do envio à vista.
      await expect(page.getByTestId("passo-texto")).toHaveText("Passo 10 de 10");
      await expect(page.getByTestId("documento-vinculo")).toBeInViewport();
      await page.screenshot({ path: `${SAIDA}/t457-revisao-envio-${largura}.png` });
      await page.context().close();
    });

    test(`2. ${largura}px — sem o número: o botão leva ao Passo 3 com o foco no número`, async ({ browser }) => {
      const page = await dono(browser, largura, "sem");
      await page.route("https://viacep.com.br/ws/**", (r) =>
        r.fulfill({ json: { cep: "38400-100", logradouro: "Rua do Laboratório", bairro: "Centro", localidade: "Uberlândia", uf: "MG" } }),
      );
      // O mesmo começo do teste 1 (o rascunho salvo); depois o número sai — falta ele para conferir o documento.
      await abrirNoEndereco(page);
      await page.getByTestId("cadastro-cep").fill("38400100");
      await expect(page.getByTestId("cadastro-rua")).toHaveValue("Rua do Laboratório", { timeout: 10_000 });
      await page.getByTestId("cadastro-numero").fill("102");
      await page.waitForTimeout(2_500);
      await expect(page.getByText(/Salvo/).first()).toBeVisible({ timeout: 15_000 });
      await page.getByTestId("cadastro-numero").fill("");
      await page.waitForTimeout(3_500);
      await expect(page.getByText(/Salvo/).first()).toBeVisible({ timeout: 15_000 });
      await irParaAntesDePublicar(page);
      const botao = page.getByTestId("antes-secao-documento").getByTestId("documento-enviar");
      await botao.click();
      await expect(page.getByTestId("passo-texto")).toHaveText("Passo 3 de 10", { timeout: 10_000 });
      await expect(page.getByTestId("cadastro-numero")).toBeFocused({ timeout: 10_000 });
      await page.context().close();
    });
  }
});
