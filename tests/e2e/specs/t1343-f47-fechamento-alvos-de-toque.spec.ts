import { test, expect } from "@playwright/test";
import { NO_LABORATORIO, adm, apagarContas, criarConta, criarImovelPronto, entrar, novaSenha, novoSufixo } from "../fixtures/laboratorio";

/*
  T1343 — F47 (draft #3096, Pista A): no Fechamento do dono, as pílulas do passo a passo, o campo "Número de ocupantes" e o
  seletor de prazo têm alvo de toque de pelo menos 44 px de altura, a 390 e a 1280 px, e a tela não estoura na horizontal.
  Candidatura aceita SEM janela de datas (aí o prazo é o seletor de meses, não o texto em dias). Spec preparada sobre a
  branch do draft; só roda verde com o conserto presente.
*/
const senha = novaSenha();
const sufixo = novoSufixo();
const dono = { email: `dono.t1343.${sufixo}@lab.vivanomads.test`, nome: "Dora Dona Alvos", role: "owner" as const };
const inq = { email: `inq.t1343.${sufixo}@lab.vivanomads.test`, nome: "Iris Alvos Sobrenome", role: "tenant" as const };
const ids: { dono?: string; inq?: string; imovel?: string; lead?: string } = {};

test.describe("T1343 — F47: alvos de toque do Fechamento", () => {
  test.skip(!NO_LABORATORIO, "Só no laboratório.");
  test.describe.configure({ mode: "serial", timeout: 120_000 });

  test.beforeAll(async () => {
    ids.dono = await criarConta(dono, senha);
    ids.inq = await criarConta(inq, senha);
    await adm().from("profiles").update({ is_teste: true }).in("id", [ids.dono, ids.inq]);
    ids.imovel = await criarImovelPronto(ids.dono, `[TESTE QA] Studio alvos ${sufixo}`, { ativo: true, preco: 2800 });
    const { data, error } = await adm().from("leads").insert({ owner_id: ids.dono, tenant_id: ids.inq, property_id: ids.imovel, status: "accepted" }).select("id").single();
    if (error) throw error;
    ids.lead = data.id as string;
  });
  test.afterAll(async () => {
    if (ids.lead) await adm().from("leads").delete().eq("id", ids.lead);
    if (ids.imovel) await adm().from("messages").delete().eq("property_id", ids.imovel);
    await apagarContas([ids.dono, ids.inq]);
  });

  for (const w of [390, 1280] as const) {
    test(`a ${w} px: pílulas, ocupantes e prazo medem pelo menos 44 px`, async ({ browser }) => {
      const page = await entrar(browser, dono.email, senha);
      await page.setViewportSize({ width: w, height: w === 390 ? 844 : 900 });
      await page.goto(`/dashboard/fechamento?c=${ids.lead}`, { waitUntil: "domcontentloaded" });
      await expect(page.getByRole("heading", { name: "Candidatura e verificação" })).toBeVisible({ timeout: 30_000 });
      const alturas = async (loc: ReturnType<typeof page.locator>) => (await loc.evaluateAll((els) => els.map((e) => Math.round(e.getBoundingClientRect().height))));
      const pilulas = page.locator("button").filter({ hasText: /^\s*(\d\s*)?(Candidatura & verificação|Garantia|Serviços|Patrimonial|Contrato|Resumo)\s*$/ });
      expect(await pilulas.count(), "as 6 pílulas do passo a passo").toBe(6);
      for (const h of await alturas(pilulas)) expect(h).toBeGreaterThanOrEqual(44);
      const ocupantes = page.getByLabel("Número de ocupantes");
      await expect(ocupantes).toBeVisible();
      expect((await alturas(ocupantes))[0]).toBeGreaterThanOrEqual(44);
      const prazo = page.getByLabel("Prazo total em meses");
      await expect(prazo).toBeVisible();
      expect((await alturas(prazo))[0]).toBeGreaterThanOrEqual(44);
      expect(await page.evaluate(() => document.documentElement.scrollWidth - innerWidth)).toBeLessThanOrEqual(1);
      await page.context().close();
    });
  }
});
