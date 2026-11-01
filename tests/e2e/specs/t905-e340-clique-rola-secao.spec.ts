import { test, expect, type Page } from "@playwright/test";
import { randomBytes } from "node:crypto";
import { NO_LABORATORIO, adm, apagarContas, cpfAleatorio, criarConta, entrar, novaSenha, novoSufixo } from "../fixtures/laboratorio";

/*
  T905 — E340, acompanhamento 3 (#1970, Pista A): no painel do parceiro (página única com #pedidos, #agenda e #ganhos),
  CLICAR numa aba leva a seção à vista (scrollIntoView no início da seção) e acende a aba dela. A t776 cobre a aba acesa
  pela rolagem e pelo clique; aqui, o que o #1970 acrescentou: depois do clique, a seção clicada está DENTRO da tela.
  Ordem Ganhos → Agenda → Pedidos → Ganhos (cada clique sai de uma seção diferente), a 390 (barra de baixo) e a 1280
  (topo). Parceiro próprio, apagado no fim.
*/
const SAIDA = "tests/laboratorio/saida";
const senha = novaSenha();
const sufixo = novoSufixo();
const ids: string[] = [];
const slug = `clique-e340-${sufixo}`.toLowerCase().replace(/[^a-z0-9-]/g, "");

const acesas = (page: Page) =>
  page.evaluate(() =>
    [...document.querySelectorAll('a[aria-current="page"][href^="/dashboard/parceiro#"]')]
      .filter((a) => (a as HTMLElement).offsetParent !== null)
      .map((a) => a.getAttribute("href")),
  );

test.describe("T905 — E340 (#1970): clicar na aba leva a seção à vista e acende a aba", () => {
  test.skip(!NO_LABORATORIO, "Só no laboratório (contas de teste).");
  test.describe.configure({ mode: "serial", timeout: 150_000 });
  let email = "";

  test.beforeAll(async () => {
    email = `owner.${randomBytes(3).toString("hex")}.${sufixo}@lab.vivanomads.test`;
    const id = await criarConta({ email, nome: `Clara Clique E340 ${sufixo}`, role: "owner" }, senha);
    ids.push(id);
    await adm().from("profiles").update({ is_teste: true }).eq("id", id);
    const { error } = await adm()
      .from("parceiros")
      .insert({ user_id: id, tipo_pessoa: "pf", documento: cpfAleatorio(), nome_publico: `Faxina Clique ${sufixo}`, slug, categorias: ["limpeza"], cidades: ["Uberlândia"], descricao_curta: "Parceiro de laboratório.", status: "publicado", publicado_em: new Date().toISOString() });
    if (error) throw error;
  });
  test.afterAll(async () => {
    await adm().from("parceiros").delete().eq("slug", slug);
    await apagarContas(ids);
  });

  for (const largura of [390, 1280] as const) {
    test(`clique em cada aba: a seção fica na tela e a aba acende (${largura} px)`, async ({ browser }) => {
      const page = await entrar(browser, email, senha);
      await page.setViewportSize({ width: largura, height: 800 });
      await page.goto("/dashboard/parceiro", { waitUntil: "domcontentloaded" });
      await expect(page.getByTestId("parceiro-ganhos")).toBeAttached({ timeout: 30_000 });
      await page.waitForLoadState("networkidle", { timeout: 15_000 }).catch(() => {});
      const aba = (s: string) => page.locator(`a[href="/dashboard/parceiro#${s}"]`).filter({ visible: true }).first();
      for (const secao of ["ganhos", "agenda", "pedidos", "ganhos"]) {
        await aba(secao).click();
        await expect(page.locator(`[id="${secao}"]`), `clique em ${secao}: a seção à vista`).toBeInViewport({ timeout: 10_000 });
        await expect.poll(() => acesas(page), { timeout: 10_000, message: `clique em ${secao}: a aba acesa` }).toEqual([`/dashboard/parceiro#${secao}`]);
        const topo = await page.locator(`[id="${secao}"]`).evaluate((e) => Math.round(e.getBoundingClientRect().top));
        console.log(`t905|${largura}|${secao}|topo=${topo}|scrollY=${await page.evaluate(() => Math.round(window.scrollY))}`);
      }
      await page.screenshot({ path: `${SAIDA}/t905-clique-${largura}.png` });
      await page.context().close();
    });
  }
});
