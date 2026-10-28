import { test, expect } from "@playwright/test";
import { NO_LABORATORIO, adm, apagarContas, criarConta, criarImovelPronto, entrar, novaSenha, novoSufixo } from "../fixtures/laboratorio";

/*
  T572 — E196: uma "Qualificação" só. No cartão do rascunho (Meus imóveis), "Qualificação" abre as mesmas 5 telas do
  assistente, daquele rascunho; a página longa de requisitos e selo tem nome próprio ("Requisitos e selo"). 390 e 1280.
*/
const SAIDA = "tests/laboratorio/saida";
const senha = novaSenha();
const sufixo = novoSufixo();
const dono = { email: `dono.t572.${sufixo}@lab.vivanomads.test`, nome: "Quel Qualifica", role: "owner" as const };
const ids: Record<string, string> = {};

test.describe("T572 — E196: 'Qualificação' é o assistente de 5 telas; 'Requisitos e selo' é a página longa", () => {
  test.skip(!NO_LABORATORIO, "Só no laboratório.");
  test.describe.configure({ mode: "serial", timeout: 120_000 });

  test.beforeAll(async () => {
    ids.dono = await criarConta(dono, senha);
    await adm().from("profiles").update({ is_teste: true }).eq("id", ids.dono);
    ids.rascunho = await criarImovelPronto(ids.dono, `Rascunho t572 ${sufixo}`);
  });
  test.afterAll(async () => {
    await apagarContas([ids.dono]);
  });

  for (const largura of [1280, 390] as const) {
    test(`${largura} px — os dois botões do cartão e seus destinos`, async ({ browser }) => {
      const p = await entrar(browser, dono.email, senha);
      await p.setViewportSize({ width: largura, height: largura === 390 ? 844 : 900 });
      await p.goto("/dashboard/imoveis", { waitUntil: "domcontentloaded" });
      const qualificacao = p.getByTestId("rascunho-qualificacao").first();
      await expect(qualificacao).toHaveText("Qualificação", { timeout: 30_000 });
      await expect(p.getByTestId("rascunho-requisitos-selo").first()).toHaveText("Requisitos e selo");
      await p.screenshot({ path: `${SAIDA}/t572-cartao-${largura}.png`, fullPage: true });

      await qualificacao.click();
      await expect(p).toHaveURL(new RegExp(`draft=${ids.rascunho}`), { timeout: 30_000 });
      await expect(p.getByTestId("qualificacao")).toBeVisible({ timeout: 30_000 });
      await expect(p.getByTestId("qualificacao-progresso")).toContainText("1 de 5");
      await p.screenshot({ path: `${SAIDA}/t572-qualificacao-${largura}.png`, fullPage: true });
      // "Responder depois" volta ao rascunho, no assistente.
      await p.getByTestId("qualificacao-depois").click();
      await expect(p.getByTestId("passo-titulo")).toBeVisible({ timeout: 30_000 });

      await p.goto("/dashboard/imoveis", { waitUntil: "domcontentloaded" });
      await p.getByTestId("rascunho-requisitos-selo").first().click();
      await expect(p).toHaveURL(new RegExp(`/qualificar\\?imovel=${ids.rascunho}`), { timeout: 30_000 });
      await expect(p.getByRole("heading", { name: "Requisitos e selo" })).toBeVisible({ timeout: 30_000 });
      await expect(p.getByRole("heading", { name: "Qualificação do imóvel" })).toHaveCount(0);
      await p.context().close();
    });
  }
});
