import { test, expect } from "@playwright/test";
import { NO_LABORATORIO, adm, apagarContas, criarConta, criarImovelPronto, entrar, novaSenha, novoSufixo } from "../fixtures/laboratorio";

/*
  T562 — E190: quem é dono e está no modo morador numa tela só de morador (Favoritos) troca para "Modo proprietário"
  com UM toque no menu da Conta: cai no Início do proprietário, sem voltar ao morador.
*/
const SAIDA = "tests/laboratorio/saida";
const senha = novaSenha();
const sufixo = novoSufixo();
const dono = { email: `dono.t562.${sufixo}@lab.vivanomads.test`, nome: "Rui Dois Modos", role: "owner" as const };
const ids: Record<string, string> = {};

test.describe("T562 — E190: Modo proprietário em 1 toque", () => {
  test.skip(!NO_LABORATORIO, "Só no laboratório.");
  test.describe.configure({ mode: "serial", timeout: 120_000 });

  test.beforeAll(async () => {
    ids.dono = await criarConta(dono, senha);
    ids.imovel = await criarImovelPronto(ids.dono, `Modos t562 ${sufixo}`, { ativo: true });
  });
  test.afterAll(async () => {
    await apagarContas([ids.dono]);
  });

  for (const largura of [1280, 390] as const) {
    test(`${largura} px — de Favoritos (modo morador), um toque em 'Modo proprietário'`, async ({ browser }) => {
      await adm().from("profiles").update({ preferred_mode: "tenant", papel_ativo: "morador" }).eq("id", ids.dono);
      const p = await entrar(browser, dono.email, senha);
      await p.setViewportSize({ width: largura, height: largura === 390 ? 844 : 900 });
      await p.goto("/dashboard/favoritos", { waitUntil: "domcontentloaded" });
      const id = largura === 390 ? "conta-morador-celular" : "conta-morador";
      const botao = largura === 390 ? p.getByTestId("topo-celular").getByTestId(id) : p.getByTestId(id);
      await expect(botao).toBeVisible({ timeout: 30_000 });
      await botao.click();
      await p.getByTestId(`${id}-modo-proprietario`).click();
      await expect(p).toHaveURL(/\/dashboard\/?$/, { timeout: 30_000 });
      const abasDono = largura === 390 ? p.getByRole("navigation", { name: "Navegação principal" }) : p.getByTestId("abas-dono");
      await expect(abasDono.locator("a").filter({ hasText: "Anúncios" })).toHaveCount(1, { timeout: 30_000 });
      // E continua proprietário (a guarda não desfaz a troca).
      await p.waitForTimeout(2_000);
      await expect(abasDono.locator("a").filter({ hasText: "Anúncios" })).toHaveCount(1);
      await p.screenshot({ path: `${SAIDA}/t562-modo-proprietario-${largura}.png` });
      await p.context().close();
    });
  }
});
