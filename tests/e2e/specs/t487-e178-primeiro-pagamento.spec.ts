import { test, expect } from "@playwright/test";
import { NO_LABORATORIO, adm, apagarContas, criarConta, criarImovelPronto, criarLead, entrar, novaSenha, novoSufixo } from "../fixtures/laboratorio";

/*
  T487 — E178: o detalhe da proposta (Orçamentos) mostra o "1º pagamento" explícito — o total do 1º mês (valor mensal +
  condomínio + consumo + limpezas + taxa pet) mais a limpeza de preparação, a mesma conta do Fechamento. Os dois lados veem.
  Cenário: R$ 3.200 + condomínio R$ 450 + preparação R$ 200 → 1º pagamento R$ 3.850,00.
*/
const SAIDA = "tests/laboratorio/saida";
const senha = novaSenha();
const sufixo = novoSufixo();
const dono = { email: `dono.t487.${sufixo}@lab.vivanomads.test`, nome: "Dora Proposta", role: "owner" as const };
const inq = { email: `inq.t487.${sufixo}@lab.vivanomads.test`, nome: "Ivo Proposta", role: "tenant" as const };
const ids: Record<string, string> = {};
const emDias = (d: number) => new Date(Date.now() + d * 86_400_000).toISOString().slice(0, 10);

test.describe("T487 — E178: 1º pagamento no detalhe da proposta", () => {
  test.skip(!NO_LABORATORIO, "Só no laboratório.");
  test.describe.configure({ mode: "serial", timeout: 120_000 });

  test.beforeAll(async () => {
    ids.dono = await criarConta(dono, senha);
    ids.inq = await criarConta(inq, senha);
    ids.imovel = await criarImovelPronto(ids.dono, `Studio t487 ${sufixo}`, { ativo: true, preco: 3200 });
    await adm()
      .from("properties")
      .update({ negociacao: { aceita: true, itens: ["valor_mensal", "meses"], descontos: [] }, min_period_days: 30, max_period_days: 180, condo_fee: 450, utilities_mode: "real", prep_fee: 200, checkout_cleaning_enabled: false, limpeza_estadia: null })
      .eq("id", ids.imovel);
    ids.lead = await criarLead(ids.dono, ids.inq, ids.imovel);
  });
  test.afterAll(async () => {
    await adm().from("propostas").delete().eq("property_id", ids.imovel ?? "");
    await adm().from("leads").delete().eq("owner_id", ids.dono ?? "");
    await apagarContas([ids.dono, ids.inq]);
  });

  test("o dono envia R$ 3.200 × 4 e o detalhe mostra o 1º pagamento; o interessado vê o mesmo valor", async ({ browser }) => {
    const page = await entrar(browser, dono.email, senha);
    await page.setViewportSize({ width: 1280, height: 900 });
    await page.goto(`/dashboard/orcamentos/nova?interessado=${ids.lead}`, { waitUntil: "domcontentloaded" });
    await expect(page.getByTestId("montagem-proposta")).toBeVisible({ timeout: 20_000 });
    await page.getByTestId("proposta-valor").fill("3200");
    await page.getByTestId("proposta-meses").selectOption("4");
    await page.getByTestId("proposta-data").fill(emDias(10));
    await page.getByTestId("enviar-proposta").click();
    await page.waitForURL(/\/dashboard\/propostas\/[0-9a-f-]{36}$/, { timeout: 20_000 });
    const url = page.url();
    const linha = page.getByTestId("proposta-atual").getByTestId("proposta-primeiro-pagamento");
    await expect(linha).toContainText("1º pagamento");
    await expect(linha).toContainText("R$ 3.850,00");
    await linha.scrollIntoViewIfNeeded();
    await page.screenshot({ path: `${SAIDA}/t487-primeiro-pagamento-dono-1280.png` });
    await page.context().close();

    const p2 = await entrar(browser, inq.email, senha);
    await p2.setViewportSize({ width: 390, height: 844 });
    await p2.goto(new URL(url).pathname, { waitUntil: "domcontentloaded" });
    const linha2 = p2.getByTestId("proposta-atual").getByTestId("proposta-primeiro-pagamento");
    await expect(linha2).toContainText("R$ 3.850,00", { timeout: 20_000 });
    await linha2.scrollIntoViewIfNeeded();
    await p2.screenshot({ path: `${SAIDA}/t487-primeiro-pagamento-interessado-390.png` });
    await p2.context().close();
  });
});
