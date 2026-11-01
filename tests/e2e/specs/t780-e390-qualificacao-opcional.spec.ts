import { test, expect } from "@playwright/test";
import { NO_LABORATORIO, adm, apagarContas, criarConta, entrar, novaSenha, novoSufixo } from "../fixtures/laboratorio";

/*
  T780 — E390 (01/11): a etapa 1 da Qualificação avançava com "Continuar" sem resposta, em silêncio. A etapa é
  opcional por desenho: a tela diz isso ("Opcional: …") e, sem resposta na tela, o botão diz "Pular"; com uma resposta,
  "Continuar". A 360 px o texto do rodapé não fica por baixo do botão. 360, 390 e 1280.
*/
const SAIDA = "tests/laboratorio/saida";
const senha = novaSenha();
const sufixo = novoSufixo();
const dono = { email: `dono.t780.${sufixo}@lab.vivanomads.test`, nome: "Olga Opcional", role: "owner" as const };
const ids: Record<string, string> = {};

test.describe("T780 — E390: Qualificação opcional, declarada na tela", () => {
  test.skip(!NO_LABORATORIO, "Só no laboratório.");
  test.describe.configure({ mode: "serial", timeout: 150_000 });
  test.beforeAll(async () => {
    ids.dono = await criarConta(dono, senha);
    await adm().from("profiles").update({ is_teste: true }).eq("id", ids.dono);
  });
  test.afterAll(async () => {
    await apagarContas([ids.dono]);
  });

  for (const largura of [360, 390, 1280] as const) {
    test(`${largura} px — "Opcional", "Pular" sem resposta e "Continuar" com resposta`, async ({ browser }) => {
      const p = await entrar(browser, dono.email, senha);
      await p.setViewportSize({ width: largura, height: largura === 1280 ? 900 : 844 });
      await p.goto("/dashboard/imoveis/novo", { waitUntil: "domcontentloaded" });
      const comecarOutro = p.getByRole("button", { name: "Começar outro" });
      await expect(p.getByTestId("qualificacao").or(comecarOutro).first()).toBeVisible({ timeout: 30_000 });
      if (await comecarOutro.isVisible()) await comecarOutro.click();
      await expect(p.getByTestId("qualificacao-opcional")).toHaveText(/^Opcional: /);
      const botao = p.getByTestId("qualificacao-continuar");
      await expect(botao).toHaveText(/^Pular/);
      const texto = await p.getByTestId("passo-texto").boundingBox();
      expect(texto!.x + texto!.width).toBeLessThanOrEqual((await botao.boundingBox())!.x);
      await p.screenshot({ path: `${SAIDA}/t780-pular-${largura}.png` });
      await p.getByTestId("qualificacao-opcao-cama-nao").click();
      await expect(botao).toHaveText(/^Continuar/);
      expect((await p.getByTestId("passo-texto").boundingBox())!.x + (await p.getByTestId("passo-texto").boundingBox())!.width).toBeLessThanOrEqual((await botao.boundingBox())!.x);
      await botao.click();
      await expect(p.getByTestId("qualificacao")).toHaveAttribute("data-tela", "2");
      await expect(botao).toHaveText(/^Pular/);
      await p.context().close();
    });
  }
});
