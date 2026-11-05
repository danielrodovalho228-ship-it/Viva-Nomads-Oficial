import { test, expect, type Page } from "@playwright/test";
import { NO_LABORATORIO, adm, apagarContas, criarConta, criarImovelPronto, entrar, novaSenha, novoSufixo } from "../fixtures/laboratorio";

/*
  T863 — E562 (REPROVA de 05/11): estadia em DIAS exatos, de ponta a ponta, com uma proposta ENVIADA de verdade.
  Caso do QA (VN-4A693A): aluguel R$ 2.800 + contas R$ 250 = R$ 3.050/mês, preparação R$ 300; candidatura de 43 dias.
   1. Montagem: abre com a saída da candidatura e "Total da estadia (43 dias)" = R$ 4.671,67 (3.050 × 43 ÷ 30 + 300) —
      nada de "Número de meses"; o dono ENVIA a proposta pela tela; a versão gravada tem dias = 43 e o mesmo total.
   2. A interessada vê a proposta e aceita; o Fechamento abre com o prazo "43 dias (1 mês + 13 dias)" e o total R$ 4.671,67.
   3. O dono gera o contrato pela tela: o contrato nasce com prazo_total_dias = 43 (não 2 meses = 60 dias) e a taxa de
      serviço gravada é a do total proporcional (aluguel × 43 ÷ 30 × taxa = R$ 481,60 a 12%), não a de 1 ou 2 meses.
  Regressão permanente do E562 (Relay 67: a proposta guarda DIAS e o contrato usa o prazo em dias). Laboratório; não é
  prova ao vivo no site.
*/
const senha = novaSenha();
const sufixo = novoSufixo();
const dono = { email: `dono.t863.${sufixo}@lab.vivanomads.test`, nome: "Dora Dias Sobrenome", role: "owner" as const };
const inq = { email: `inq.t863.${sufixo}@lab.vivanomads.test`, nome: "Iris Dias Sobrenome", role: "tenant" as const };
const ids: { dono?: string; inq?: string; imovel?: string; lead?: string; proposta?: string } = {};
const SAIDA = "tests/laboratorio/saida";

const emDias = (d: number) => new Date(Date.now() + d * 86_400_000).toISOString().slice(0, 10);
const ENTRADA = emDias(30);
const SAIDA_DATA = emDias(73); // 43 dias

/** E601: o valor da caução que o dono viu no formulário (passo 1), conferido na tela da moradora (passo 2). */
let caucaoDoDono = "";

async function abrir(page: Page, rota: string) {
  await page.goto(rota, { waitUntil: "domcontentloaded" });
  await page.locator("main").first().waitFor();
  await page.waitForLoadState("networkidle", { timeout: 10_000 }).catch(() => {});
}

test.describe("T863 — E562: candidatura de 43 dias → proposta enviada → aceite → contrato em dias", () => {
  test.skip(!NO_LABORATORIO, "Só no laboratório.");
  test.describe.configure({ mode: "serial" });
  test.setTimeout(240_000);

  test.beforeAll(async () => {
    ids.dono = await criarConta(dono, senha);
    ids.inq = await criarConta(inq, senha);
    // Contas de teste: o contrato sai no modo TESTE (sem assinatura digital real).
    await adm().from("profiles").update({ is_teste: true }).in("id", [ids.dono, ids.inq]);
    ids.imovel = await criarImovelPronto(ids.dono, `[TESTE QA] Studio 43 dias ${sufixo}`, { ativo: true, preco: 2800 });
    const { error: e1 } = await adm()
      .from("properties")
      .update({ condo_fee: 0, utilities_mode: "fixed", utilities_estimate: 250, prep_fee: 300, checkout_cleaning_enabled: false, checkout_cleaning_fee: 0, limpeza_estadia: null, min_period_days: 30, max_period_days: 180 })
      .eq("id", ids.imovel);
    if (e1) throw e1;
    // A candidatura de 43 dias (entrada → saída), como o pedido do morador grava.
    const { data, error } = await adm()
      .from("leads")
      .insert({ owner_id: ids.dono, tenant_id: ids.inq, property_id: ids.imovel, status: "new", inicio_desejado: ENTRADA, fim_desejado: SAIDA_DATA })
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
      await adm().from("propostas").delete().eq("lead_id", ids.lead);
    }
    if (ids.imovel) await adm().from("messages").delete().eq("property_id", ids.imovel);
    await apagarContas([ids.dono, ids.inq]);
  });

  test("1. montagem em dias e proposta ENVIADA: dias = 43, total R$ 4.671,67", async ({ browser }) => {
    const page = await entrar(browser, dono.email, senha);
    await page.setViewportSize({ width: 1280, height: 900 });
    await abrir(page, `/dashboard/orcamentos/nova?interessado=${ids.lead}`);
    await expect(page.getByTestId("montagem-proposta")).toBeVisible({ timeout: 20_000 });
    await expect(page.getByText("Número de meses")).toHaveCount(0);
    // O campo de data do computador mostra dd/mm/aaaa (máscara da main); no celular, o campo nativo guarda ISO.
    await expect(page.getByTestId("proposta-saida")).toHaveValue(new RegExp(`^(${SAIDA_DATA}|${SAIDA_DATA.split("-").reverse().join("/")})$`));
    await expect(page.getByTestId("proposta-dias")).toContainText("43 dias");
    await expect(page.getByTestId("resumo-rotulo-total")).toHaveText("Total da estadia (43 dias)");
    await expect(page.getByTestId("resumo-total-contrato")).toContainText("4.671,67");
    // E601: a caução que o dono vê ao montar (a moradora tem de ver a mesma na proposta).
    caucaoDoDono = (await page.getByTestId("resumo-caucao").innerText()).trim();
    expect(caucaoDoDono).toMatch(/R\$/);
    await page.getByTestId("proposta-validade").selectOption("7");
    await page.screenshot({ path: `${SAIDA}/t863-1-montagem.png`, fullPage: true });
    await page.getByTestId("enviar-proposta").click();
    await page.waitForURL(/\/dashboard\/propostas\/[0-9a-f-]{36}$/, { timeout: 30_000 });
    ids.proposta = page.url().split("/").pop()!;

    const { data: v, error } = await adm().from("proposta_versoes").select("dias, meses, total_contrato, data_entrada").eq("proposta_id", ids.proposta).eq("versao", 1).single();
    expect(error).toBeNull();
    expect(Number(v!.dias)).toBe(43);
    expect(Number(v!.total_contrato)).toBeCloseTo(4671.67, 2);
    expect(String(v!.data_entrada).slice(0, 10)).toBe(ENTRADA);
    await page.context().close();
  });

  test("2. a interessada aceita; o Fechamento abre em dias (43 dias, R$ 4.671,67)", async ({ browser }) => {
    const pi = await entrar(browser, inq.email, senha);
    await abrir(pi, `/dashboard/propostas/${ids.proposta}`);
    await expect(pi.getByTestId("proposta-aceitar")).toBeVisible({ timeout: 20_000 });
    await pi.getByTestId("proposta-aceitar").click();
    await expect.poll(async () => (await adm().from("propostas").select("status").eq("id", ids.proposta!).single()).data?.status, { timeout: 20_000 }).toBe("aceita");
    // E601: a moradora vê na proposta a mesma caução do formulário do dono.
    await abrir(pi, `/dashboard/propostas/${ids.proposta}`);
    await expect(pi.getByTestId("proposta-atual").getByTestId("proposta-caucao")).toContainText(caucaoDoDono, { timeout: 20_000 });
    await pi.context().close();

    const pd = await entrar(browser, dono.email, senha);
    await pd.setViewportSize({ width: 1280, height: 900 });
    await abrir(pd, `/dashboard/fechamento?c=${ids.lead}`);
    await expect(pd.getByTestId("fechamento-proposta-contrato")).toContainText("4.671,67", { timeout: 20_000 });
    await expect(pd.getByTestId("fechamento-prazo-dias")).toHaveText("43 dias (1 mês + 13 dias)");
    await pd.screenshot({ path: `${SAIDA}/t863-2-fechamento.png`, fullPage: true });
    await pd.context().close();
  });

  test("3. o contrato gerado pela tela nasce em dias: prazo_total_dias = 43", async ({ browser }) => {
    const page = await entrar(browser, dono.email, senha);
    await page.setViewportSize({ width: 1280, height: 900 });
    await abrir(page, `/dashboard/fechamento?c=${ids.lead}`);
    await expect(page.getByRole("heading", { name: "Candidatura e verificação" })).toBeVisible({ timeout: 20_000 });
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
    await page.screenshot({ path: `${SAIDA}/t863-3-contrato.png`, fullPage: true });

    const { data: c, error } = await adm().from("contratos").select("prazo_total_dias, comissao_valor, comissao_percent").eq("lead_id", ids.lead!).single();
    expect(error).toBeNull();
    expect(Number(c!.prazo_total_dias)).toBe(43);
    // A taxa incide sobre o total PROPORCIONAL do aluguel (2.800 × 43 ÷ 30), nunca sobre meses arredondados.
    const taxa = Number(c!.comissao_percent);
    expect(taxa).toBeGreaterThan(0);
    expect(Number(c!.comissao_valor)).toBeCloseTo(Math.round(((2800 * 43) / 30) * taxa * 100) / 100, 2);
    expect(Number(c!.comissao_valor)).not.toBeCloseTo(Math.round(2800 * 2 * taxa * 100) / 100, 2);
    expect(Number(c!.comissao_valor)).not.toBeCloseTo(Math.round(2800 * 1 * taxa * 100) / 100, 2);
    await page.context().close();
  });
});
