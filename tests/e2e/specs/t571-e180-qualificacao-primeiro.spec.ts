import { test, expect } from "@playwright/test";
import { NO_LABORATORIO, adm, apagarContas, criarConta, criarImovelPronto, entrar, novaSenha, novoSufixo } from "../fixtures/laboratorio";

/*
  T571 — E180 (decisão do Daniel: qualificação primeiro). Dono com um anúncio em andamento toca em "Novo anúncio": a
  tela abre na Qualificação (1 de 5), não no Passo 1; o aviso "Você tem um anúncio em andamento" fica dentro dela, com
  "Continuar o outro" (que abre o rascunho). A 390 e 1280 px.
*/
const SAIDA = "tests/laboratorio/saida";
const senha = novaSenha();
const sufixo = novoSufixo();
const dono = { email: `dono.t571.${sufixo}@lab.vivanomads.test`, nome: "Rita Rascunho", role: "owner" as const };
const ids: Record<string, string> = {};

test.describe("T571 — E180: 'Novo anúncio' abre na Qualificação mesmo com rascunho", () => {
  test.skip(!NO_LABORATORIO, "Só no laboratório.");
  test.describe.configure({ mode: "serial", timeout: 120_000 });

  test.beforeAll(async () => {
    ids.dono = await criarConta(dono, senha);
    await adm().from("profiles").update({ is_teste: true }).eq("id", ids.dono);
    ids.rascunho = await criarImovelPronto(ids.dono, `Rascunho t571 ${sufixo}`);
  });
  test.afterAll(async () => {
    await apagarContas([ids.dono]);
  });

  for (const largura of [1280, 390] as const) {
    test(`${largura} px — Qualificação primeiro, com o aviso de retomar dentro dela`, async ({ browser }) => {
      const p = await entrar(browser, dono.email, senha);
      await p.setViewportSize({ width: largura, height: largura === 390 ? 844 : 900 });
      await p.goto("/dashboard/imoveis/novo", { waitUntil: "domcontentloaded" });
      const qual = p.getByTestId("qualificacao");
      await expect(qual).toBeVisible({ timeout: 30_000 });
      const aviso = qual.getByTestId("rascunho-aviso");
      await expect(aviso).toBeVisible({ timeout: 30_000 });
      await expect(aviso).toContainText("Você tem um anúncio em andamento");
      await expect(aviso).toContainText("Este é um anúncio novo e começa pela qualificação.");
      await expect(p.getByTestId("qualificacao-progresso")).toContainText("1 de 5");
      // O Passo 1 não abre por cima da Qualificação.
      await expect(p.getByTestId("passo-titulo")).toHaveCount(0);
      await p.screenshot({ path: `${SAIDA}/t571-qualificacao-com-aviso-${largura}.png`, fullPage: true });
      await aviso.getByTestId("rascunho-continuar").click();
      await expect(p).toHaveURL(new RegExp(`draft=${ids.rascunho}`), { timeout: 30_000 });
      await p.context().close();
    });
  }
});
