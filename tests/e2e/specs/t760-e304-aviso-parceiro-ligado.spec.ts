import { test, expect } from "@playwright/test";
import { NO_LABORATORIO, apagarContas, criarConta, entrar, novaSenha, novoSufixo } from "../fixtures/laboratorio";

/*
  T760 — E304 (vigia 31/10): no estado vazio da busca de parceiros, o "Quero ser avisado" fica LIGADO com cidade OU
  categoria. Só categoria: cidade e estado no próprio cartão. Cidade ambígua ("Bom Jesus"): escolhe-se o estado entre
  os que têm essa cidade. "Indique um profissional" manda o link do pedido de parceria.
*/
const SAIDA = "tests/laboratorio/saida";
const senha = novaSenha();
const sufixo = novoSufixo();
const morador = { email: `mor.t760.${sufixo}@lab.vivanomads.test`, nome: "Rita Aviso", role: "tenant" as const };
const ids: { morador?: string } = {};

test.describe("T760 — E304: aviso de parceiro sempre com botão ligado", () => {
  test.skip(!NO_LABORATORIO, "Só no laboratório.");
  test.describe.configure({ mode: "serial", timeout: 120_000 });
  test.use({ actionTimeout: 15_000, navigationTimeout: 30_000 });

  test.beforeAll(async () => {
    ids.morador = await criarConta(morador, senha);
  });
  test.afterAll(async () => {
    await apagarContas([ids.morador]);
  });

  for (const largura of [390, 1280] as const) {
    test(`${largura} px`, async ({ browser }) => {
      const p = await entrar(browser, morador.email, senha);
      await p.setViewportSize({ width: largura, height: largura === 390 ? 844 : 900 });

      // Só categoria: botão ligado; sem cidade, ele pede a cidade e o estado; com os dois, grava.
      await p.goto("/parceiros/buscar?categoria=montagem", { waitUntil: "domcontentloaded" });
      const vazia = p.getByTestId("busca-parceiros-vazia");
      await expect(vazia).toBeVisible({ timeout: 30_000 });
      const aviso = vazia.getByTestId("aviso-fotografo");
      const botao = aviso.getByTestId("aviso-fotografo-enviar");
      await expect(botao).toBeEnabled();
      await botao.click();
      await expect(aviso.getByRole("alert")).toContainText("Informe a cidade e o estado");
      await aviso.getByTestId("aviso-cidade").fill("Uberlândia");
      await aviso.getByTestId("aviso-uf").selectOption("MG");
      await botao.click();
      await expect(aviso.getByTestId("aviso-fotografo-ok")).toContainText("Uberlândia", { timeout: 20_000 });
      await expect(vazia.getByTestId("indicar-profissional")).toHaveAttribute("data-href", /parceir/);
      await p.screenshot({ path: `${SAIDA}/t760-so-categoria-${largura}.png` });

      // Cidade ambígua: só os estados que têm "Bom Jesus"; botão ligado.
      await p.goto("/parceiros/buscar?categoria=limpeza&cidade=Bom%20Jesus", { waitUntil: "domcontentloaded" });
      const aviso2 = p.getByTestId("busca-parceiros-vazia").getByTestId("aviso-fotografo");
      await expect(aviso2.getByTestId("aviso-fotografo-enviar")).toBeEnabled({ timeout: 30_000 });
      const opcoes = await aviso2.getByTestId("aviso-uf").locator("option").count();
      expect(opcoes - 1, "mais de um estado e menos que todos").toBeGreaterThan(1);
      expect(opcoes - 1).toBeLessThan(27);
      await p.screenshot({ path: `${SAIDA}/t760-cidade-ambigua-${largura}.png` });
      await p.context().close();
    });
  }
});
