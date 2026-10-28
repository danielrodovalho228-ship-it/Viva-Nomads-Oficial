import { test, expect } from "@playwright/test";
import { NO_LABORATORIO, adm, apagarContas, criarConta, criarImovelPronto, criarLead, entrar, novaSenha, novoSufixo } from "../fixtures/laboratorio";

/*
  T556 — E178 (#1406), guarda permanente da Pista C, no que a t487 da Pista A não cobre: os tamanhos trocados (o dono
  a 390, o interessado a 1280) e um segundo cenário, SEM extras (sem condomínio, sem preparação, sem limpeza de saída):
  o "1º pagamento" do detalhe da proposta é só o valor mensal — R$ 2.900 —, nunca a soma de um extra que o imóvel não tem.
*/
const SAIDA = "tests/laboratorio/saida";
const senha = novaSenha();
const sufixo = novoSufixo();
const dono = { email: `dono.t556.${sufixo}@lab.vivanomads.test`, nome: "Duda Proposta", role: "owner" as const };
const inq = { email: `inq.t556.${sufixo}@lab.vivanomads.test`, nome: "Igor Proposta", role: "tenant" as const };
const ids: Record<string, string> = {};
const emDias = (d: number) => new Date(Date.now() + d * 86_400_000).toISOString().slice(0, 10);
const VALOR = /R\$\s?2\.900(?!\d)/;

test.describe("T556 — E178: 1º pagamento sem extras, dono a 390 e interessado a 1280", () => {
  test.skip(!NO_LABORATORIO, "Só no laboratório.");
  test.describe.configure({ mode: "serial", timeout: 120_000 });

  test.beforeAll(async () => {
    ids.dono = await criarConta(dono, senha);
    ids.inq = await criarConta(inq, senha);
    ids.imovel = await criarImovelPronto(ids.dono, `Studio t556 ${sufixo}`, { ativo: true, preco: 2900 });
    const { error } = await adm()
      .from("properties")
      .update({ negociacao: { aceita: true, itens: ["valor_mensal", "meses"], descontos: [] }, min_period_days: 30, max_period_days: 180, condo_fee: 0, utilities_mode: "real", prep_fee: 0, checkout_cleaning_enabled: false, limpeza_estadia: null })
      .eq("id", ids.imovel);
    if (error) throw error;
    ids.lead = await criarLead(ids.dono, ids.inq, ids.imovel);
  });
  test.afterAll(async () => {
    await adm().from("propostas").delete().eq("property_id", ids.imovel ?? "");
    await adm().from("leads").delete().eq("owner_id", ids.dono ?? "");
    await apagarContas([ids.dono, ids.inq]);
  });

  test("o dono (390) envia R$ 2.900 × 3; o 1º pagamento é R$ 2.900 para os dois lados; o interessado vê a 1280", async ({ browser }) => {
    const page = await entrar(browser, dono.email, senha);
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto(`/dashboard/orcamentos/nova?interessado=${ids.lead}`, { waitUntil: "domcontentloaded" });
    await expect(page.getByTestId("montagem-proposta")).toBeVisible({ timeout: 20_000 });
    await page.getByTestId("proposta-valor").fill("2900");
    await page.getByTestId("proposta-meses").selectOption("3");
    await page.getByTestId("proposta-data").fill(emDias(10));
    await page.getByTestId("enviar-proposta").click();
    await page.waitForURL(/\/dashboard\/propostas\/[0-9a-f-]{36}$/, { timeout: 20_000 });
    const caminho = new URL(page.url()).pathname;
    const linha = page.getByTestId("proposta-atual").getByTestId("proposta-primeiro-pagamento");
    await expect(linha).toContainText("1º pagamento");
    await expect(linha).toContainText(VALOR);
    console.log(`t556 dono 390: "${(await linha.innerText()).replace(/\s+/g, " ")}"`);
    await linha.scrollIntoViewIfNeeded();
    await page.screenshot({ path: `${SAIDA}/t556-primeiro-pagamento-dono-390.png` });
    await page.context().close();

    const p2 = await entrar(browser, inq.email, senha);
    await p2.setViewportSize({ width: 1280, height: 900 });
    await p2.goto(caminho, { waitUntil: "domcontentloaded" });
    const linha2 = p2.getByTestId("proposta-atual").getByTestId("proposta-primeiro-pagamento");
    await expect(linha2).toContainText(VALOR, { timeout: 20_000 });
    await linha2.scrollIntoViewIfNeeded();
    await p2.screenshot({ path: `${SAIDA}/t556-primeiro-pagamento-interessado-1280.png` });
    await p2.context().close();
  });
});
