import { test, expect } from "@playwright/test";
import { conversationId } from "../../../src/lib/messages/conversation-id";
import { NO_LABORATORIO, apagarContas, criarConta, criarImovelPronto, criarLead, entrar, gravarMensagem, novaSenha, novoSufixo } from "../fixtures/laboratorio";

/*
  T763 — E314 (devolução de 31/10): o cartão da candidatura "Em análise" (o proprietário já mandou mensagem) traz o
  próximo passo E o prazo oficial "em até 1 dia útil". A 390 e a 1280.
*/
const SAIDA = "tests/laboratorio/saida";
const senha = novaSenha();
const sufixo = novoSufixo();
const morador = { email: `mor.t763.${sufixo}@lab.vivanomads.test`, nome: "Iara Prazo", role: "tenant" as const };
const dono = { email: `dono.t763.${sufixo}@lab.vivanomads.test`, nome: "Otto Dono", role: "owner" as const };
const ids: { morador?: string; dono?: string } = {};

test.describe("T763 — E314: prazo no cartão 'Em análise'", () => {
  test.skip(!NO_LABORATORIO, "Só no laboratório.");
  test.describe.configure({ mode: "serial", timeout: 120_000 });
  test.use({ actionTimeout: 15_000, navigationTimeout: 30_000 });

  test.beforeAll(async () => {
    ids.morador = await criarConta(morador, senha);
    ids.dono = await criarConta(dono, senha);
    const imovel = await criarImovelPronto(ids.dono, `Studio t763 ${sufixo}`, { ativo: true });
    await criarLead(ids.dono, ids.morador, imovel);
    // O proprietário já falou com o morador sobre o imóvel → "Em análise".
    await gravarMensagem(ids.dono, ids.morador, imovel, "Oi! Vi sua candidatura.", conversationId(ids.morador, ids.dono, imovel));
  });
  test.afterAll(async () => {
    await apagarContas([ids.morador, ids.dono]);
  });

  for (const largura of [1280, 390] as const) {
    test(`${largura} px`, async ({ browser }) => {
      const p = await entrar(browser, morador.email, senha);
      await p.setViewportSize({ width: largura, height: largura === 390 ? 844 : 900 });
      await p.goto("/dashboard/candidaturas", { waitUntil: "domcontentloaded" });
      const cartao = p.getByTestId("candidatura-item").first();
      await expect(cartao).toContainText("Em análise", { timeout: 30_000 });
      const passo = cartao.getByTestId("candidatura-proximo-passo");
      await expect(passo).toContainText("O proprietário já viu a sua candidatura e está avaliando.");
      await expect(passo).toContainText("em até 1 dia útil");
      await expect(passo.getByTestId("candidatura-proximo-passo-acao")).toHaveAttribute("href", "/dashboard/mensagens");
      await cartao.screenshot({ path: `${SAIDA}/t763-em-analise-${largura}.png` });
      await p.context().close();
    });
  }
});
