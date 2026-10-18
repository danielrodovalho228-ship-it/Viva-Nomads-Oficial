import { test, expect } from "@playwright/test";
import { authFile } from "../fixtures/auth";
import {
  NO_LABORATORIO,
  adm,
  apagarContas,
  criarConta,
  criarImovelPronto,
  criarLead,
  entrar,
  novaSenha,
  novoSufixo,
} from "../fixtures/laboratorio";

/**
 * T68 — ordem c54366b0 (complemento da b3c9d76e): a comissão incide sobre o VALOR
 * TOTAL do contrato (aluguel × meses). Páginas públicas e ferramentas do proprietário
 * não falam mais em "primeiro mês" / "1 aluguel".
 */
test.describe("T68 — Comissão sobre o valor total: páginas públicas", () => {
  test.use({ storageState: { cookies: [], origins: [] } });

  test("/precos, /termos, /para-proprietarios e home: valor total, nunca primeiro mês", async ({ page }) => {
    for (const rota of ["/precos", "/termos", "/para-proprietarios", "/"]) {
      await page.goto(rota, { waitUntil: "networkidle" });
      const texto = await page.locator("main").innerText();
      expect(texto, rota).toMatch(/valor total (do|de cada) contrato/i);
      expect(texto, rota).not.toMatch(/(comissão|taxa)[^.]{0,60}(primeiro (mês|aluguel)|1º (mês|aluguel)|de um aluguel)/i);
    }
  });
});

test.describe("T68 — Comissão sobre o valor total: ferramentas do proprietário", () => {
  test.use({ storageState: authFile("proprietario") });

  test("/dashboard/simulador e /dashboard/roi-imovel: % sobre o valor mensal × meses (rótulo único do prompt 27)", async ({ page }) => {
    await page.goto("/dashboard/simulador", { waitUntil: "networkidle" });
    let texto = await page.locator("main").innerText();
    expect(texto).toMatch(/sobre o valor mensal × meses/i);
    expect(texto).not.toMatch(/de 1 aluguel|de um aluguel|1º aluguel/i);
    await page.goto("/dashboard/roi-imovel", { waitUntil: "networkidle" });
    texto = await page.locator("main").innerText();
    expect(texto).toMatch(/sobre o valor mensal × meses/i);
    expect(texto).not.toMatch(/primeiro mês/i);
  });
});

/**
 * Ordem a319728b (P0): a cobrança da comissão lê aluguel, MESES e taxa do contrato
 * JÁ REGISTRADO. 3 meses × R$ 3.000 × 12% = R$ 1.080; o prazo enviado pelo navegador é ignorado.
 */

test.describe("T68 — Cobrança da comissão pelo contrato registrado", () => {
  test.skip(!NO_LABORATORIO, "Só no laboratório.");
  test.describe.configure({ mode: "serial" });
  const senha = novaSenha();
  const sufixo = novoSufixo();
  const dono = { email: `dono.com.${sufixo}@lab.vivanomads.test`, nome: "Dora Comissão", role: "owner" as const };
  const inq = { email: `inq.com.${sufixo}@lab.vivanomads.test`, nome: "Ivo Comissão", role: "tenant" as const };
  const ids: { dono?: string; inq?: string; imovel?: string; lead?: string } = {};

  test.beforeAll(async () => {
    ids.dono = await criarConta(dono, senha, true);
    ids.inq = await criarConta(inq, senha, true);
    ids.imovel = await criarImovelPronto(ids.dono, `Comissão total ${sufixo}`, { ativo: true, preco: 3000 });
    ids.lead = await criarLead(ids.dono, ids.inq, ids.imovel, true);
    await adm().from("leads").update({ accepted_commission_rate: 0.12, accepted_plan: "essential" }).eq("id", ids.lead);
    // Documentos do inquilino completos (a mesma trava do fechamento).
    const uuid = () => crypto.randomUUID();
    for (const tipo of ["identidade", "vinculo"]) {
      await adm().from("documentos_inquilino").insert({
        lead_id: ids.lead, tenant_id: ids.inq, tipo,
        caminho: `${uuid()}/${uuid()}/${uuid()}.pdf`, hash_sha256: "a".repeat(64),
      });
    }
  });

  test.afterAll(async () => {
    if (ids.lead) await adm().from("cobrancas_fechamento").delete().eq("lead_id", ids.lead);
    if (ids.lead) await adm().from("contratos").delete().eq("lead_id", ids.lead);
    await apagarContas([ids.dono, ids.inq]);
  });

  test("sem contrato registrado: 409; com contrato de 3 meses: R$ 1.080 mesmo com termMonths=1", async ({ browser }) => {
    test.setTimeout(120_000);
    const page = await entrar(browser, dono.email, senha);

    const sem = await page.request.post("/api/comissao", { data: { leadId: ids.lead, termMonths: 6 } });
    expect(sem.status()).toBe(409);
    expect((await sem.json()).error).toMatch(/Registre o contrato antes/);

    const { error } = await adm().from("contratos").insert({
      lead_id: ids.lead, property_id: ids.imovel, tenant_id: ids.inq, owner_plan: "essential", faixa: "media_estadia",
      prazo_total_dias: 90, aluguel_mensal: 3000, tamanho_bloco_meses: 3, comissao_percent: 0.12, comissao_valor: 1080,
      qtd_ocupantes: 1,
    });
    expect(error).toBeNull();

    const res = await page.request.post("/api/comissao", { data: { leadId: ids.lead, termMonths: 1 } });
    expect(res.status()).toBe(200);
    const corpo = await res.json();
    expect(corpo.platformCommission).toBe(1080);
    expect(corpo.baseAluguel).toBe(3000);
    await page.context().close();
  });
});
