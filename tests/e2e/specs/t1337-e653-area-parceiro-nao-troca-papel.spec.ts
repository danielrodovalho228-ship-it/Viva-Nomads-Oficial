import { test, expect, type Page } from "@playwright/test";
import { NO_LABORATORIO, adm, apagarContas, cpfAleatorio, criarConta, criarImovelPronto, entrar, novaSenha, novoSufixo } from "../fixtures/laboratorio";

/*
  T1337 — E653 (#3038): a casca logada não troca o papel sozinha. Um proprietário com parceria publicada visita a área do
  parceiro (/dashboard/parceiro) e volta: o papel guardado (profiles.papel_ativo) segue "proprietario", a navegação
  (data-papel) segue do proprietário em /dashboard, /dashboard/imoveis e depois da visita, e a home do dono não vira a do
  morador. Antes do conserto abrir a área do parceiro gravava papel_ativo = "parceiro". Laboratório, 390 e 1280 px.
*/
const senha = novaSenha();
const sufixo = novoSufixo();
const conta = { email: `dono.t1337.${sufixo}@lab.vivanomads.test`, nome: "Dora Dona Parceira", role: "owner" as const };
const ids: { conta?: string; imovel?: string } = {};
const gravado = async () => (await adm().from("profiles").select("papel_ativo").eq("id", ids.conta!).single()).data?.papel_ativo ?? null;
const nav = (p: Page) => p.locator("header[data-papel], nav[data-papel]").filter({ visible: true }).first();

test.describe("T1337 — E653: abrir a área do parceiro não troca o papel do proprietário", () => {
  test.skip(!NO_LABORATORIO, "Só no laboratório.");
  test.describe.configure({ mode: "serial", timeout: 150_000 });

  test.beforeAll(async () => {
    ids.conta = await criarConta(conta, senha);
    ids.imovel = await criarImovelPronto(ids.conta, `Studio T1337 ${sufixo}`, { ativo: true });
    await adm().from("profiles").update({ papel_ativo: "proprietario", preferred_mode: "owner" }).eq("id", ids.conta);
    const { error } = await adm().from("parceiros").insert({
      user_id: ids.conta, tipo_pessoa: "pf", documento: cpfAleatorio(), nome_publico: `Dora Parceira ${sufixo}`,
      slug: `t1337-${sufixo}`, categorias: ["limpeza"], cidades: ["Uberlândia"], status: "publicado",
    });
    if (error) throw error;
  });
  test.afterAll(async () => {
    if (ids.conta) await adm().from("parceiros").delete().eq("user_id", ids.conta);
    await apagarContas([ids.conta]);
  });

  for (const w of [390, 1280] as const) {
    test(`a ${w} px: visitar a área do parceiro e voltar mantém o papel de proprietário`, async ({ browser }) => {
      const p = await entrar(browser, conta.email, senha);
      await p.setViewportSize({ width: w, height: w === 390 ? 844 : 900 });
      await p.goto("/dashboard", { waitUntil: "domcontentloaded" });
      await expect(nav(p)).toHaveAttribute("data-papel", "proprietario", { timeout: 20_000 });

      await p.goto("/dashboard/parceiro", { waitUntil: "domcontentloaded" });
      await expect(p.locator("main").first()).toBeVisible({ timeout: 20_000 });
      expect(await gravado(), "abrir a área do parceiro não grava o papel").toBe("proprietario");

      await p.goto("/dashboard", { waitUntil: "domcontentloaded" });
      await expect(nav(p)).toHaveAttribute("data-papel", "proprietario", { timeout: 20_000 });
      await p.goto("/dashboard/imoveis", { waitUntil: "domcontentloaded" });
      await expect(nav(p)).toHaveAttribute("data-papel", "proprietario", { timeout: 20_000 });
      expect(await gravado()).toBe("proprietario");
      // A home do dono continua a do dono: o anúncio dele aparece em Meus imóveis.
      await expect(p.getByText(`Studio T1337 ${sufixo}`).first()).toBeVisible({ timeout: 20_000 });
      expect(await p.evaluate(() => document.documentElement.scrollWidth - innerWidth)).toBeLessThanOrEqual(1);
      await p.context().close();
    });
  }
});
