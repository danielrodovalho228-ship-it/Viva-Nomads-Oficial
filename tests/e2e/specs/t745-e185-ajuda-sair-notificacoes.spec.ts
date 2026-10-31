import { test, expect, type Page } from "@playwright/test";
import { NO_LABORATORIO, apagarContas, criarConta, entrar, novaSenha, novoSufixo } from "../fixtures/laboratorio";

/*
  T745 — E185 (vigia, 31/10), pacote de menus aprovado (docs/e176-menus-spec.md), morador a 1280 e 390:
   1. "Ajuda" tem UM destino: o "Ajuda" do avatar abre a Ajuda da Conta (/dashboard/conta/ajuda), a mesma da Conta.
   2. "Sair" uma vez por tela: na Ajuda da Conta a tela tem "Sair da conta" e o avatar não repete "Sair"; fora dela, o
      avatar mantém os itens do D2 (Minha conta · Ajuda · Sair).
   3. "Notificações" é uma página só (/dashboard/notificacoes) e aparece UMA vez na tela da Conta (resíduo de 31/10).
*/
const SAIDA = "tests/laboratorio/saida";
const senha = novaSenha();
const sufixo = novoSufixo();
const morador = { email: `mor.t745.${sufixo}@lab.vivanomads.test`, nome: "Rita Menus", role: "tenant" as const };
const ids: { morador?: string } = {};

async function abrirAvatar(p: Page, largura: number) {
  const id = largura === 390 ? "conta-morador-celular" : "conta-morador";
  const botao = largura === 390 ? p.getByTestId("topo-celular").getByTestId(id) : p.getByTestId(id);
  await expect(botao).toBeVisible({ timeout: 30_000 });
  await botao.click();
  return p.getByTestId(`menu-${id}`);
}

test.describe("T745 — E185: Ajuda com um destino, Sair uma vez, Notificações uma página", () => {
  test.skip(!NO_LABORATORIO, "Só no laboratório.");
  test.describe.configure({ mode: "serial", timeout: 120_000 });
  test.use({ actionTimeout: 15_000, navigationTimeout: 30_000 });

  test.beforeAll(async () => {
    ids.morador = await criarConta(morador, senha);
  });
  test.afterAll(async () => {
    await apagarContas([ids.morador]);
  });

  for (const largura of [1280, 390] as const) {
    test(`${largura} px`, async ({ browser }) => {
      const p = await entrar(browser, morador.email, senha);
      await p.setViewportSize({ width: largura, height: largura === 390 ? 844 : 900 });
      await p.goto("/dashboard", { waitUntil: "domcontentloaded" });

      // Fora da Ajuda: os itens do D2, com "Sair"; o "Ajuda" leva à Ajuda da Conta.
      let menu = await abrirAvatar(p, largura);
      await expect(menu.getByRole("menuitem")).toHaveText(["Minha conta", "Ajuda", "Sair"]);
      await expect(menu.getByRole("menuitem", { name: "Ajuda" })).toHaveAttribute("href", "/dashboard/conta/ajuda");
      await menu.getByRole("menuitem", { name: "Ajuda" }).click();
      await expect(p).toHaveURL(/\/dashboard\/conta\/ajuda/, { timeout: 30_000 });
      await expect(p.getByTestId("ajuda-sair")).toHaveText("Sair da conta");

      // Na Ajuda: o avatar não repete o "Sair".
      menu = await abrirAvatar(p, largura);
      await expect(menu.getByRole("menuitem")).toHaveText(["Minha conta", "Ajuda"]);
      await expect(p.getByText(/^Sair( da conta)?$/).filter({ visible: true })).toHaveCount(1);
      await p.screenshot({ path: `${SAIDA}/t745-ajuda-avatar-${largura}.png` });
      await p.keyboard.press("Escape");

      // Notificações: uma página só, e UMA entrada visível na tela da Conta (E185 resíduo, 31/10): no celular o sino;
      // no computador o item do menu lateral da Conta (o topo não repete o sino nas telas da Conta).
      const notif = p.locator('a[href="/dashboard/notificacoes"]').filter({ visible: true });
      await expect(notif).toHaveCount(1);
      if (largura === 1280) await expect(notif).toHaveAttribute("data-testid", "conta-menu-notificacoes");
      else await expect(notif).toHaveAttribute("data-testid", "sino-morador-celular");
      await p.context().close();
    });
  }
});
