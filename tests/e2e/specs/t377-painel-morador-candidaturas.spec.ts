import { test, expect } from "@playwright/test";
import { NO_LABORATORIO, adm, apagarContas, criarConta, criarImovelPronto, entrar, novaSenha, novoSufixo } from "../fixtures/laboratorio";

/**
 * T377 — E72 (QA do Muse, 24/10, conta inquilino1): o cartão "Candidaturas" do painel do morador mostrava 0 com 3
 * candidaturas na lista. Um número, uma fonte: o cartão conta a mesma lista de /dashboard/candidaturas.
 *   1. Sem candidatura: cartão 0 e a lista vazia.
 *   2. Com 3 candidaturas (datas diferentes): cartão 3 e a lista com 3 (390 px).
 */
const senha = novaSenha();
const sufixo = novoSufixo();
const dono = { email: `dono.t377.${sufixo}@lab.vivanomads.test`, nome: "Rui Dono Lima", role: "owner" as const };
const morador = { email: `morador.t377.${sufixo}@lab.vivanomads.test`, nome: "Lia Morador Costa", role: "tenant" as const };
const ids: { dono?: string; morador?: string; imoveis: string[] } = { imoveis: [] };

test.describe("T377 — E72: cartão Candidaturas do painel do morador = lista de candidaturas", () => {
  test.skip(!NO_LABORATORIO, "Só no laboratório.");
  test.describe.configure({ mode: "serial" });
  test.use({ actionTimeout: 15_000, navigationTimeout: 30_000, viewport: { width: 390, height: 844 } });

  test.beforeAll(async () => {
    ids.dono = await criarConta(dono, senha);
    ids.morador = await criarConta(morador, senha);
    for (const n of [1, 2, 3]) ids.imoveis.push(await criarImovelPronto(ids.dono, `Apto T377 ${n} ${sufixo}`, { ativo: true, preco: 2500 + n * 100 }));
  });
  test.afterAll(async () => {
    if (!NO_LABORATORIO) return;
    await adm().from("leads").delete().eq("tenant_id", ids.morador!);
    await apagarContas([ids.dono, ids.morador]);
  });

  const cartao = (p: import("@playwright/test").Page) => p.locator('main a[href="/dashboard/candidaturas"]').filter({ hasText: "Candidaturas" }).first();

  test("1. sem candidatura: cartão 0, lista vazia", async ({ browser }) => {
    const p = await entrar(browser, morador.email, senha);
    await p.goto("/dashboard", { waitUntil: "domcontentloaded" });
    await expect(cartao(p)).toContainText("0", { timeout: 30_000 });
    await p.goto("/dashboard/candidaturas", { waitUntil: "domcontentloaded" });
    await expect(p.getByText("Você ainda não se candidatou")).toBeVisible({ timeout: 30_000 });
    await p.context().close();
  });

  test("2. três candidaturas: cartão 3, lista 3", async ({ browser }) => {
    const datas = ["2026-10-19T14:00:00Z", "2026-10-19T15:00:00Z", "2026-10-12T10:00:00Z"];
    for (const [i, imovel] of ids.imoveis.entries()) {
      const { error } = await adm().from("leads").insert({ owner_id: ids.dono, tenant_id: ids.morador, property_id: imovel, status: "new", created_at: datas[i] });
      if (error) throw error;
    }
    const p = await entrar(browser, morador.email, senha);
    await p.goto("/dashboard", { waitUntil: "domcontentloaded" });
    await expect(cartao(p)).toContainText("3", { timeout: 30_000 });
    await expect(cartao(p)).not.toContainText(/\b0\b/);
    await cartao(p).click();
    await expect(p).toHaveURL(/\/dashboard\/candidaturas/);
    await expect(p.getByText(/^Enviada em /)).toHaveCount(3, { timeout: 30_000 });
    await p.context().close();
  });
});
