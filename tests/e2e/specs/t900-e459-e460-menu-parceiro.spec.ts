import { test, expect, type Page } from "@playwright/test";
import { NO_LABORATORIO, adm, apagarContas, cpfAleatorio, criarConta, entrarNaPagina, novaSenha, novoSufixo } from "../fixtures/laboratorio";

/*
  T900 — E459 + E460: menu do parceiro aprovado (topo do computador e barra do celular).
    E459: "Início" leva ao topo do painel do PARCEIRO (/dashboard/parceiro#inicio), não ao início do dono (/dashboard).
    E460: a aba acesa é a da área atual — no topo de /dashboard/parceiro, Início (antes: Pedidos); em
          /dashboard/parceiro/avaliacao, Início (a área do painel), nunca Pedidos.
  390 e 1280, sessão real.
*/
const senha = novaSenha();
const sufixo = novoSufixo();
const pessoa = { email: `menu.t900.${sufixo}@lab.vivanomads.test`, nome: "Paola Parceira", role: "tenant" as const };
const ids: Record<string, string> = {};

/** Rótulo e href da aba acesa (aria-current=page) no menu visível do parceiro. */
async function acesa(page: Page, largura: number): Promise<{ rotulo: string; href: string }[]> {
  const menu = largura === 1280 ? page.getByTestId("abas-parceiro") : page.getByRole("navigation", { name: "Navegação principal" });
  return menu.locator('a[aria-current="page"]').evaluateAll((as) => as.filter((a) => (a as HTMLElement).offsetParent).map((a) => ({ rotulo: (a.textContent ?? "").trim(), href: a.getAttribute("href") ?? "" })));
}

test.describe("T900 — menu do parceiro: Início certo e a área atual acesa", () => {
  test.skip(!NO_LABORATORIO, "Só no laboratório.");
  test.describe.configure({ mode: "serial", timeout: 120_000 });
  test.beforeAll(async () => {
    ids.pessoa = await criarConta(pessoa, senha);
    const { data, error } = await adm()
      .from("parceiros")
      .insert({ user_id: ids.pessoa, tipo_pessoa: "pf", documento: cpfAleatorio(), nome_publico: `Paola Limpeza ${sufixo}`, slug: `paola-t900-${sufixo}`, categorias: ["limpeza"], cidades: ["Uberlândia"], descricao_curta: "Parceiro de laboratório.", status: "publicado", publicado_em: new Date().toISOString() })
      .select("id")
      .single();
    if (error) throw error;
    ids.parceiro = data.id as string;
    await adm().from("profiles").update({ papel_ativo: "parceiro" }).eq("id", ids.pessoa);
  });
  test.afterAll(async () => {
    if (ids.parceiro) await adm().from("parceiros").delete().eq("id", ids.parceiro);
    await apagarContas([ids.pessoa]);
  });

  for (const w of [1280, 390] as const) {
    test(`a ${w} px`, async ({ browser }) => {
      const ctx = await browser.newContext({ viewport: { width: w, height: w === 390 ? 844 : 900 }, isMobile: w === 390 });
      const p = await entrarNaPagina(await ctx.newPage(), pessoa.email, senha);
      await p.goto("/dashboard/parceiro", { waitUntil: "domcontentloaded" });
      await expect(p.locator("#inicio")).toBeVisible({ timeout: 20_000 });
      // E460: no topo do painel, Início aceso (não Pedidos).
      await expect.poll(() => acesa(p, w), { timeout: 15_000 }).toEqual([{ rotulo: "Início", href: "/dashboard/parceiro#inicio" }]);
      await p.screenshot({ path: `tests/laboratorio/saida/t900-painel-${w}.png` });

      // E460: na avaliação (subpágina do painel), Início — nunca Pedidos.
      await p.goto("/dashboard/parceiro/avaliacao", { waitUntil: "domcontentloaded" });
      await expect.poll(() => acesa(p, w), { timeout: 15_000 }).toEqual([{ rotulo: "Início", href: "/dashboard/parceiro#inicio" }]);

      // E459: o Início leva ao topo do painel do parceiro, não ao /dashboard do dono.
      const menu = w === 1280 ? p.getByTestId("abas-parceiro") : p.getByRole("navigation", { name: "Navegação principal" });
      await menu.locator(`a[href="/dashboard/parceiro#inicio"]`).first().click();
      await expect(p).toHaveURL(/\/dashboard\/parceiro#inicio$/);
      await expect(p.locator("#inicio")).toBeInViewport();
      await ctx.close();
    });
  }
});
