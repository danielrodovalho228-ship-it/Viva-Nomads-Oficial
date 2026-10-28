import { test, expect } from "@playwright/test";
import { NO_LABORATORIO, adm, apagarContas, criarConta, criarImovelPronto, entrar, novaSenha, novoSufixo } from "../fixtures/laboratorio";

/*
  T561 — E192 (reteste 26/10): a conta como a inquilino1 de produção — cadastro de MORADOR, com um imóvel anunciado e
  o MODO PROPRIETÁRIO salvo — vê o cartão (E192-B: com o "Salvar" secundário, um primário por tela) "Por que estou na cidade" na Conta → Perfil. Antes, o painel do morador só
  existia no modo morador e a tela não mostrava nada. Dono puro (cadastro de proprietário) no modo proprietário segue
  sem o cartão.
*/
const SAIDA = "tests/laboratorio/saida";
const senha = novaSenha();
const sufixo = novoSufixo();
const lucas = { email: `lucas.t561.${sufixo}@lab.vivanomads.test`, nome: "Lucas Morador", role: "tenant" as const };
const dono = { email: `dono.t561.${sufixo}@lab.vivanomads.test`, nome: "Dora Dona", role: "owner" as const };
const ids: Record<string, string> = {};

test.describe("T561 — E192: 'Por que estou na cidade' no Perfil", () => {
  test.skip(!NO_LABORATORIO, "Só no laboratório.");
  test.describe.configure({ mode: "serial", timeout: 120_000 });

  test.beforeAll(async () => {
    ids.lucas = await criarConta(lucas, senha);
    ids.dono = await criarConta(dono, senha);
    ids.imovel = await criarImovelPronto(ids.lucas, `Anúncio do Lucas t561 ${sufixo}`, { ativo: true });
    await adm().from("profiles").update({ preferred_mode: "owner", papel_ativo: "proprietario" }).eq("id", ids.lucas);
    await adm().from("profiles").update({ preferred_mode: "owner", papel_ativo: "proprietario" }).eq("id", ids.dono);
  });
  test.afterAll(async () => {
    await apagarContas([ids.lucas, ids.dono]);
  });

  for (const largura of [1280, 390] as const) {
    test(`${largura} px — morador com imóvel, no modo proprietário: o cartão aparece e grava`, async ({ browser }) => {
      const p = await entrar(browser, lucas.email, senha);
      await p.setViewportSize({ width: largura, height: largura === 390 ? 844 : 900 });
      await p.goto(largura === 390 ? "/dashboard/conta/perfil" : "/dashboard/conta", { waitUntil: "domcontentloaded" });
      const cartao = p.getByTestId("por-que-na-cidade");
      await expect(cartao).toBeVisible({ timeout: 30_000 });
      await expect(p.getByText("Por que estou na cidade").first()).toBeVisible();
      // E192-B: um primário por tela — o "Salvar" do cartão é secundário; o primário é o "Salvar alterações".
      await expect(p.getByTestId("cidade-salvar")).toHaveAttribute("data-cta", "");
      expect(await p.locator('[data-cta="primary"]:visible').count()).toBeLessThanOrEqual(1);
      await cartao.scrollIntoViewIfNeeded();
      await p.screenshot({ path: `${SAIDA}/t561-perfil-${largura}.png`, fullPage: true });
      await p.context().close();
    });
  }

  test("1280 px — dono puro no modo proprietário: sem o painel do morador", async ({ browser }) => {
    const p = await entrar(browser, dono.email, senha);
    await p.setViewportSize({ width: 1280, height: 900 });
    await p.goto("/dashboard/conta", { waitUntil: "domcontentloaded" });
    await expect(p.getByTestId("perfil-cartao").first()).toBeVisible({ timeout: 30_000 });
    await expect(p.getByTestId("por-que-na-cidade")).toHaveCount(0);
    await p.context().close();
  });
});
