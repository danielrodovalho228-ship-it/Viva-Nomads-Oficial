import { test, expect } from "@playwright/test";
import { NO_LABORATORIO, adm, apagarContas, criarConta, entrar, novaSenha, novoSufixo } from "../fixtures/laboratorio";

/*
  T2092 — E720 (Pista 3; varredura "sem spec" do mapa das 142, ronda 08:24Z) @E720 — sem @ao-vivo-seguro: precisa de
  sessão e do laboratório (VERMELHO PENDENTE DE LABORATÓRIO).
  Regra decidida (E720): as telas internas do painel SEM voltar próprio mostram o "Voltar" do painel (para o início do
  painel quando abertas direto); o início do painel e as telas com voltar próprio (Conta, Notificações…) não o duplicam.
  O unitário voltar-painel.test.ts fixa a lista; esta spec prova na tela, a 390 e 1280 px.
*/
const senha = novaSenha();
const sufixo = novoSufixo();
const dono = { email: `dono.t2092.${sufixo}@lab.vivanomads.test`, nome: "Davi Voltar", role: "owner" as const };
const ids: Record<string, string> = {};

const COM = ["/dashboard/imoveis", "/dashboard/visitas", "/dashboard/contratos", "/dashboard/pedidos"];
const SEM = ["/dashboard", "/dashboard/conta/perfil", "/dashboard/notificacoes"];

test.describe("T2092 — E720: o Voltar do painel nas telas internas sem voltar próprio @E720", () => {
  test.skip(!NO_LABORATORIO, "Só no laboratório (precisa de sessão e da chave de serviço).");
  test.describe.configure({ mode: "serial", timeout: 180_000 });
  test.beforeAll(async () => {
    ids.dono = await criarConta(dono, senha);
    await adm().from("profiles").update({ preferred_mode: "owner", papel_ativo: "proprietario" }).eq("id", ids.dono);
  });
  test.afterAll(async () => {
    await apagarContas([ids.dono]);
  });

  for (const largura of [390, 1280]) {
    test(`${largura} px — Voltar nas telas internas; nunca no início nem nas telas com voltar próprio`, async ({ browser }) => {
      const p = await entrar(browser, dono.email, senha);
      await p.setViewportSize({ width: largura, height: largura === 390 ? 844 : 900 });
      for (const rota of COM) {
        await p.goto(rota, { waitUntil: "domcontentloaded" });
        const voltar = p.getByTestId("voltar-painel");
        await expect(voltar, `${rota}: tem o Voltar do painel`).toBeVisible({ timeout: 30_000 });
        await expect(voltar).toHaveText(/Voltar/);
        await expect(voltar).toHaveAttribute("href", "/dashboard");
      }
      for (const rota of SEM) {
        await p.goto(rota, { waitUntil: "domcontentloaded" });
        await expect(p.locator("main[data-painel-main]")).toBeVisible({ timeout: 30_000 });
        await p.waitForLoadState("networkidle", { timeout: 10_000 }).catch(() => {});
        await expect(p.getByTestId("voltar-painel"), `${rota}: sem o Voltar do painel (não duplica)`).toHaveCount(0);
      }
      // Aberto direto, o Voltar leva ao início do painel.
      await p.goto("/dashboard/imoveis", { waitUntil: "domcontentloaded" });
      await p.getByTestId("voltar-painel").click();
      await p.waitForURL(/\/dashboard\/?$/, { timeout: 20_000 });
      await p.context().close();
    });
  }
});
