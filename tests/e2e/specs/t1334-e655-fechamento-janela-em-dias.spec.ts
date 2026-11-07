import { test, expect } from "@playwright/test";
import { NO_LABORATORIO, adm, apagarContas, criarConta, criarImovelPronto, entrar, novaSenha, novoSufixo } from "../fixtures/laboratorio";

/*
  T1334 — E655 (#3061): candidatura de 45 dias SEM proposta ligada. O Fechamento abre com a janela exata da candidatura
  em dias ("45 dias (1 mês + 15 dias)"), não com os meses arredondados para cima ("2 meses" = 60 dias). O contrato gerado pela tela nasce com 45 dias. Laboratório, 390 e 1280 px, sessão real do dono.
*/
const senha = novaSenha();
const sufixo = novoSufixo();
const dono = { email: `dono.t1334.${sufixo}@lab.vivanomads.test`, nome: "Dora Dias Sobrenome", role: "owner" as const };
const inq = { email: `inq.t1334.${sufixo}@lab.vivanomads.test`, nome: "Iris Dias Sobrenome", role: "tenant" as const };
const ids: { dono?: string; inq?: string; imovel?: string; lead?: string } = {};
const emDias = (d: number) => new Date(Date.now() + d * 86_400_000).toISOString().slice(0, 10);

test.describe("T1334 — E655: Fechamento sem proposta respeita a janela da candidatura em dias", () => {
  test.skip(!NO_LABORATORIO, "Só no laboratório.");
  test.describe.configure({ mode: "serial", timeout: 120_000 });

  test.beforeAll(async () => {
    ids.dono = await criarConta(dono, senha);
    ids.inq = await criarConta(inq, senha);
    await adm().from("profiles").update({ is_teste: true }).in("id", [ids.dono, ids.inq]);
    ids.imovel = await criarImovelPronto(ids.dono, `[TESTE QA] Studio 45 dias ${sufixo}`, { ativo: true, preco: 2800 });
    const { error: e1 } = await adm().from("properties").update({ min_period_days: 30, max_period_days: 180 }).eq("id", ids.imovel);
    if (e1) throw e1;
    const { data, error } = await adm()
      .from("leads")
      .insert({ owner_id: ids.dono, tenant_id: ids.inq, property_id: ids.imovel, status: "accepted", inicio_desejado: emDias(30), fim_desejado: emDias(75) })
      .select("id")
      .single();
    if (error) throw error;
    ids.lead = data.id as string;
    for (const tipo of ["identidade", "vinculo"]) {
      const u = () => crypto.randomUUID();
      const { error: e2 } = await adm().from("documentos_inquilino").insert({ lead_id: ids.lead, tenant_id: ids.inq, tipo, caminho: `${u()}/${u()}/${u()}.pdf`, hash_sha256: "a".repeat(64) });
      if (e2) throw e2;
    }
  });
  test.afterAll(async () => {
    if (ids.lead) {
      await adm().from("cobrancas_fechamento").delete().eq("lead_id", ids.lead);
      await adm().from("contratos").delete().eq("lead_id", ids.lead);
      await adm().from("documentos_inquilino").delete().eq("lead_id", ids.lead);
      await adm().from("leads").delete().eq("id", ids.lead);
    }
    if (ids.imovel) await adm().from("messages").delete().eq("property_id", ids.imovel);
    await apagarContas([ids.dono, ids.inq]);
  });

  for (const w of [390, 1280] as const) {
    test(`a ${w} px: o prazo do Fechamento é "45 dias", não "2 meses"`, async ({ browser }) => {
      const page = await entrar(browser, dono.email, senha);
      await page.setViewportSize({ width: w, height: w === 390 ? 844 : 900 });
      await page.goto(`/dashboard/fechamento?c=${ids.lead}`, { waitUntil: "domcontentloaded" });
      await expect(page.getByRole("heading", { name: "Candidatura e verificação" })).toBeVisible({ timeout: 30_000 });
      const prazo = page.getByTestId("fechamento-prazo-dias");
      await expect(prazo).toBeVisible({ timeout: 30_000 });
      await expect(prazo).toContainText(/^45 dias \(/);
      await expect(prazo).not.toContainText(/2 meses|60 dias/);
      expect(await page.evaluate(() => document.documentElement.scrollWidth - innerWidth)).toBeLessThanOrEqual(1);
      if (w === 1280) {
        // Segue até gerar o contrato pela tela: ele nasce com os 45 dias da candidatura (não 2 meses = 60 dias).
        await page.getByRole("button", { name: /verificar identidade/i }).click();
        const continuar = page.getByRole("button", { name: /continuar/i });
        await expect(continuar).toBeEnabled({ timeout: 20_000 });
        await continuar.click();
        await page.getByRole("radio").and(page.locator(":not([disabled])")).first().click();
        await page.getByTestId("ciente-protecao").check({ timeout: 15_000 });
        await continuar.click();
        await expect(page.getByRole("heading", { name: /serviços adicionais/i })).toBeVisible({ timeout: 15_000 });
        await continuar.click();
        await page.getByRole("button", { name: /Seguir sem seguro patrimonial/ }).click();
        await continuar.click();
        await expect(page.getByTestId("marca-minuta")).toBeVisible({ timeout: 15_000 });
        await page.getByTestId("fechamento-gerar-contrato").click();
        await expect(page.getByTestId("fechamento-abrir-contrato")).toBeVisible({ timeout: 30_000 });
        const { data: c, error } = await adm().from("contratos").select("prazo_total_dias").eq("lead_id", ids.lead!).single();
        expect(error).toBeNull();
        expect(Number(c!.prazo_total_dias)).toBe(45);
      }
      await page.context().close();
    });
  }
});
