import { test, expect } from "@playwright/test";
import { NO_LABORATORIO, adm, apagarContas, criarConta, entrar, novaSenha, novoSufixo } from "../fixtures/laboratorio";

/*
  T779 — E382 (01/11): na Qualificação do assistente, o medidor "Progresso do cadastro" sobe com as respostas na hora
  (antes ficava em 0 com as 3 perguntas da 1ª tela respondidas) e o rodapé mostra "N de 12 respondidas" numa 2ª linha,
  sob "Antes do Passo 1 · Qualificação 1 de 5". 390 e 1280.
*/
const SAIDA = "tests/laboratorio/saida";
const senha = novaSenha();
const sufixo = novoSufixo();
const dono = { email: `dono.t779.${sufixo}@lab.vivanomads.test`, nome: "Rita Resposta", role: "owner" as const };
const ids: Record<string, string> = {};
const barra = (p: import("@playwright/test").Page) => p.getByTestId("assistente-rodape").getByRole("progressbar");

test.describe("T779 — E382: o progresso da Qualificação reflete as respostas", () => {
  test.skip(!NO_LABORATORIO, "Só no laboratório.");
  test.describe.configure({ mode: "serial", timeout: 150_000 });
  test.beforeAll(async () => {
    ids.dono = await criarConta(dono, senha);
    await adm().from("profiles").update({ is_teste: true }).eq("id", ids.dono);
  });
  test.afterAll(async () => {
    await apagarContas([ids.dono]);
  });

  for (const largura of [390, 1280] as const) {
    test(`${largura} px — responder a 1ª tela move a barra e o rodapé`, async ({ browser }) => {
      const p = await entrar(browser, dono.email, senha);
      await p.setViewportSize({ width: largura, height: largura === 390 ? 844 : 900 });
      await p.goto("/dashboard/imoveis/novo", { waitUntil: "domcontentloaded" });
      const comecarOutro = p.getByRole("button", { name: "Começar outro" });
      await expect(p.getByTestId("qualificacao").or(comecarOutro).first()).toBeVisible({ timeout: 30_000 });
      if (await comecarOutro.isVisible()) await comecarOutro.click();
      await expect(barra(p)).toHaveAttribute("aria-valuenow", "0");
      await p.getByTestId("qualificacao-opcao-cama-sim").click();
      await expect(p.getByTestId("passo-detalhe")).toHaveText(/^1 de \d+ respondidas$/);
      await p.getByTestId("qualificacao-opcao-apoio-sim").click();
      await p.locator('[data-testid^="qualificacao-opcao-ventilacao-"]').first().click();
      await expect(p.getByTestId("passo-detalhe")).toHaveText(/^3 de \d+ respondidas$/);
      await expect(p.getByTestId("passo-texto")).toHaveText("Antes do Passo 1 · Qualificação 1 de 5");
      expect(Number(await barra(p).getAttribute("aria-valuenow"))).toBeGreaterThan(0);
      // A 2ª linha cabe ao lado do Continuar (não cortada).
      const det = await p.getByTestId("passo-detalhe").boundingBox();
      const btn = await p.getByTestId("qualificacao-continuar").boundingBox();
      expect(det!.x + det!.width).toBeLessThanOrEqual(btn!.x);
      await p.screenshot({ path: `${SAIDA}/t779-qualificacao-${largura}.png` });
      await p.context().close();
    });
  }
});
