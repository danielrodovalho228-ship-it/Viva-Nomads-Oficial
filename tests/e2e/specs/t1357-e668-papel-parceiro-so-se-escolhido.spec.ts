import { test, expect, type Page } from "@playwright/test";
import { NO_LABORATORIO, adm, apagarContas, cpfAleatorio, criarConta, entrar, novaSenha, novoSufixo } from "../fixtures/laboratorio";

/*
  T1357 — E668 (draft #3134, migração 0318): o morador que também tem parceria abre a casca como MORADOR; o papel
  "parceiro" gravado só vale quando foi ESCOLHIDO (carimbo profiles.papel_ativo_escolhido_em). Conta com
  papel_ativo = parceiro SEM carimbo (valor antigo gravado pela área) e preferred_mode = tenant, parceria em rascunho:
   1. sem carimbo → a navegação abre como "morador" em /dashboard (390 e 1280 px) e o papel gravado não vira parceiro;
   2. com o carimbo (escolha feita) → a mesma conta abre como "parceiro".
  Spec preparada sobre a branch do draft; só roda verde com a migração 0318 e o E668 presentes.
*/
const senha = novaSenha();
const sufixo = novoSufixo();
const conta = { email: `lucas.t1357.${sufixo}@lab.vivanomads.test`, nome: "Lucas Morador Parceiro", role: "tenant" as const };
const ids: { conta?: string } = {};
const nav = (p: Page) => p.locator("header[data-papel], nav[data-papel]").filter({ visible: true }).first();
const gravado = async () => (await adm().from("profiles").select("papel_ativo").eq("id", ids.conta!).single()).data?.papel_ativo ?? null;

test.describe("T1357 — E668: o papel parceiro só vale se foi escolhido", () => {
  test.skip(!NO_LABORATORIO, "Só no laboratório.");
  test.describe.configure({ mode: "serial", timeout: 150_000 });

  test.beforeAll(async () => {
    ids.conta = await criarConta(conta, senha);
    await adm().from("profiles").update({ papel_ativo: "parceiro", preferred_mode: "tenant", papel_ativo_escolhido_em: null }).eq("id", ids.conta);
    const { error } = await adm().from("parceiros").insert({ user_id: ids.conta, tipo_pessoa: "pj", documento: "11222333000181", nome_publico: `Lucas Parceiro ${sufixo}`, slug: `t1357-${sufixo}`, categorias: ["limpeza"], cidades: ["Uberlândia"], status: "rascunho" });
    if (error) throw error;
  });
  test.afterAll(async () => {
    if (ids.conta) await adm().from("parceiros").delete().eq("user_id", ids.conta);
    await apagarContas([ids.conta]);
  });

  for (const w of [390, 1280] as const) {
    test(`1. a ${w} px: sem carimbo a conta abre como morador`, async ({ browser }) => {
      await adm().from("profiles").update({ papel_ativo: "parceiro", papel_ativo_escolhido_em: null }).eq("id", ids.conta!);
      const p = await entrar(browser, conta.email, senha);
      await p.setViewportSize({ width: w, height: w === 390 ? 844 : 900 });
      await p.goto("/dashboard", { waitUntil: "domcontentloaded" });
      await expect(nav(p)).toHaveAttribute("data-papel", "morador", { timeout: 25_000 });
      expect(await p.evaluate(() => document.documentElement.scrollWidth - innerWidth)).toBeLessThanOrEqual(1);
      expect(await gravado(), "abrir não grava papel").not.toBe("proprietario");
      await p.context().close();
    });
  }

  test("2. com o carimbo (escolha feita) a mesma conta abre como parceiro", async ({ browser }) => {
    await adm().from("profiles").update({ papel_ativo: "parceiro", papel_ativo_escolhido_em: new Date().toISOString() }).eq("id", ids.conta!);
    const p = await entrar(browser, conta.email, senha);
    await p.setViewportSize({ width: 1280, height: 900 });
    await p.goto("/dashboard", { waitUntil: "domcontentloaded" });
    await expect(nav(p)).toHaveAttribute("data-papel", "parceiro", { timeout: 25_000 });
    await p.context().close();
  });
});
