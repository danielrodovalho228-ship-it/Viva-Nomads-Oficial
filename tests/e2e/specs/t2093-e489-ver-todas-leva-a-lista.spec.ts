import { test, expect } from "@playwright/test";
import { NO_LABORATORIO, adm, apagarContas, criarConta, entrar, novaSenha, novoSufixo } from "../fixtures/laboratorio";

/*
  T2093 — E489 (Pista 3; varredura "sem spec" das 142, lote B) @E489 — sem @ao-vivo-seguro: precisa de sessão e do
  laboratório (VERMELHO PENDENTE DE LABORATÓRIO).
  Regra decidida (E489): o "Ver todas" do sino (/dashboard/notificacoes#avisos) leva à LISTA de avisos, não às
  preferências: ao chegar com #avisos, a seção da lista rola para a vista dentro do container que rola (o <main> do
  painel no computador) e o foco vai para o título "Avisos recentes". O unitário e489-ver-todas.test.ts fixa o link e o
  componente; esta spec prova na tela, a 1280 px (onde o defeito vivia) e a 390 px.
*/
const senha = novaSenha();
const sufixo = novoSufixo();
const dono = { email: `dono.t2093.${sufixo}@lab.vivanomads.test`, nome: "Dalva Avisos", role: "owner" as const };
const ids: Record<string, string> = {};

test.describe("T2093 — E489: Ver todas do sino leva à lista de avisos @E489", () => {
  test.skip(!NO_LABORATORIO, "Só no laboratório (precisa de sessão e da chave de serviço).");
  test.describe.configure({ mode: "serial", timeout: 120_000 });
  test.beforeAll(async () => {
    ids.dono = await criarConta(dono, senha);
    await adm().from("profiles").update({ preferred_mode: "owner", papel_ativo: "proprietario" }).eq("id", ids.dono);
  });
  test.afterAll(async () => {
    await apagarContas([ids.dono]);
  });

  for (const largura of [1280, 390]) {
    test(`${largura} px — /dashboard/notificacoes#avisos: o título "Avisos recentes" à vista e com o foco`, async ({ browser }) => {
      const p = await entrar(browser, dono.email, senha);
      await p.setViewportSize({ width: largura, height: largura === 390 ? 844 : 900 });
      await p.goto("/dashboard/notificacoes#avisos", { waitUntil: "domcontentloaded" });
      const titulo = p.locator("#h-avisos");
      await expect(titulo).toHaveText(/Avisos recentes/, { timeout: 30_000 });
      await expect(titulo).toBeFocused({ timeout: 15_000 });
      // À vista: o topo do título dentro da janela (no computador, quem rola é o <main> do painel).
      await expect
        .poll(() => titulo.evaluate((h) => { const r = h.getBoundingClientRect(); return r.top >= 0 && r.top < innerHeight - 40; }), { timeout: 10_000 })
        .toBe(true);
      await p.context().close();
    });
  }
});
