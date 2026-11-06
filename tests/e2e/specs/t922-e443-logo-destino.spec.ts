import { test, expect } from "@playwright/test";
import { NO_LABORATORIO, adm, apagarContas, criarConta, entrarNaPagina, novaSenha, novoSufixo } from "../fixtures/laboratorio";

/*
  T922 — E443: o LOGO do cabeçalho logado é a saída do painel (página inicial pública) e o "Início" do menu leva ao painel.
  Antes, no computador, o logo apontava para o próprio /dashboard ("só fica nesta página", lia como botão morto). Sessão real
  (morador e proprietário), a 1280 (topo do painel) e a 390 (topo do celular): do /dashboard e de outras páginas logadas,
  o logo aponta para "/", clicar nele abre a página inicial e o "Início" abre o painel. Só no laboratório.
*/
const senha = novaSenha();
const sufixo = novoSufixo();
const contas = {
  morador: { email: `mor.t922.${sufixo}@lab.vivanomads.test`, nome: "Lia Logo", role: "tenant" as const },
  dono: { email: `dono.t922.${sufixo}@lab.vivanomads.test`, nome: "Davi Logo", role: "owner" as const },
};
const ids: string[] = [];
const PAGINAS = ["/dashboard", "/dashboard/mensagens", "/dashboard/conta", "/dashboard/notificacoes"];

test.describe("T922 — E443: logo e Início do cabeçalho logado", () => {
  test.skip(!NO_LABORATORIO, "Só no laboratório.");
  test.describe.configure({ mode: "serial", timeout: 180_000 });
  test.beforeAll(async () => {
    for (const [k, c] of Object.entries(contas)) {
      const id = await criarConta(c, senha);
      ids.push(id);
      await adm().from("profiles").update(k === "morador" ? { is_teste: true, preferred_mode: "tenant", papel_ativo: "morador" } : { is_teste: true, preferred_mode: "owner", papel_ativo: "proprietario" }).eq("id", id);
    }
  });
  test.afterAll(async () => {
    await apagarContas(ids);
  });

  for (const [papel, prefixo] of [["morador", "morador"], ["dono", "dono"]] as const) {
    for (const w of [1280, 390] as const) {
      test(`${papel} a ${w} px`, async ({ browser }) => {
        const ctx = await browser.newContext({ viewport: { width: w, height: w === 390 ? 844 : 900 } });
        const p = await entrarNaPagina(await ctx.newPage(), contas[papel].email, senha);
        const topo = w === 1280 ? p.getByTestId(`topo-${prefixo}`) : p.getByTestId("topo-celular");
        for (const rota of PAGINAS) {
          await p.goto(rota, { waitUntil: "domcontentloaded" });
          const logo = topo.locator("a[data-logo]").first();
          await expect(logo, `${rota}: logo no cabeçalho`).toBeVisible({ timeout: 30_000 });
          expect(new URL((await logo.getAttribute("href"))!, p.url()).pathname, `${rota}: o logo leva à página inicial`).toBe("/");
        }
        // Clicar no logo a partir do painel sai dele: abre a página inicial pública.
        await p.goto("/dashboard", { waitUntil: "domcontentloaded" });
        await topo.locator("a[data-logo]").first().click();
        await expect(p).toHaveURL(/\/$/, { timeout: 30_000 });
        await expect(p.getByRole("heading", { level: 1 })).toContainText("Imóveis mobiliados", { timeout: 30_000 });
        // O "Início" do menu leva ao painel (aba no topo do computador; barra de baixo no celular).
        await p.goto("/dashboard/conta", { waitUntil: "domcontentloaded" });
        const inicio = w === 1280 ? p.getByTestId(`aba-${prefixo}-inicio`) : p.getByRole("navigation", { name: "Navegação principal" }).getByRole("link", { name: "Início" });
        await inicio.click();
        await expect(p).toHaveURL(/\/dashboard\/?$/, { timeout: 30_000 });
        await p.screenshot({ path: `tests/laboratorio/saida/t922-${papel}-${w}.png` });
        await ctx.close();
      });
    }
  }
});
