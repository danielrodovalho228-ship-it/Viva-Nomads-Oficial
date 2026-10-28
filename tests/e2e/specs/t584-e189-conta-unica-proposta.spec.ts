import { test, expect } from "@playwright/test";
import { NO_LABORATORIO, adm, apagarContas, criarConta, criarImovelPronto, criarLead, entrar, novaSenha, novoSufixo } from "../fixtures/laboratorio";

/*
  T584 — E189 (#1420), guarda permanente da Pista C, no que a t212 não cobre: a t212 confere o FORMATO da conta na
  lista do morador; aqui, que é a MESMA conta, texto a texto, nos três lugares:
   - o detalhe da proposta (data-testid "proposta-conta"), visto pelo dono a 1280;
   - a lista de propostas do morador ("proposta-inquilino-conta") a 390 e 1280;
   - a mensagem da conversa ("Proposta N enviada. Total do contrato: <conta>.").
  Imóvel com condomínio de R$ 350 (entra no mensal da conta), R$ 3.000 × 3 meses.
*/
const senha = novaSenha();
const sufixo = novoSufixo();
const dono = { email: `dono.t584.${sufixo}@lab.vivanomads.test`, nome: "Dina Conta", role: "owner" as const };
const inq = { email: `inq.t584.${sufixo}@lab.vivanomads.test`, nome: "Ian Conta", role: "tenant" as const };
const ids: Record<string, string> = {};
const TITULO = `Studio conta única t584 ${sufixo}`;
const emDias = (d: number) => new Date(Date.now() + d * 86_400_000).toISOString().slice(0, 10);
let conta = "";
let caminho = "";

test.describe("T584 — E189: a conta da proposta é a mesma no detalhe, na lista e na mensagem", () => {
  test.skip(!NO_LABORATORIO, "Só no laboratório.");
  test.describe.configure({ mode: "serial", timeout: 120_000 });

  test.beforeAll(async () => {
    ids.dono = await criarConta(dono, senha);
    ids.inq = await criarConta(inq, senha);
    ids.imovel = await criarImovelPronto(ids.dono, TITULO, { ativo: true, preco: 3000 });
    const { error } = await adm()
      .from("properties")
      .update({ negociacao: { aceita: true, itens: ["valor_mensal", "meses"], descontos: [] }, min_period_days: 30, max_period_days: 180, condo_fee: 350, utilities_mode: "real", prep_fee: 0, checkout_cleaning_enabled: false, limpeza_estadia: null })
      .eq("id", ids.imovel);
    if (error) throw error;
    ids.lead = await criarLead(ids.dono, ids.inq, ids.imovel);
  });
  test.afterAll(async () => {
    await adm().from("propostas").delete().eq("property_id", ids.imovel ?? "");
    await adm().from("messages").delete().eq("property_id", ids.imovel ?? "");
    await adm().from("leads").delete().eq("owner_id", ids.dono ?? "");
    await apagarContas([ids.dono, ids.inq]);
  });

  test("1. 1280 — o dono envia R$ 3.000 × 3; o detalhe mostra a conta aberta", async ({ browser }) => {
    const p = await entrar(browser, dono.email, senha);
    await p.setViewportSize({ width: 1280, height: 900 });
    await p.goto(`/dashboard/orcamentos/nova?interessado=${ids.lead}`, { waitUntil: "domcontentloaded" });
    await expect(p.getByTestId("montagem-proposta")).toBeVisible({ timeout: 20_000 });
    await p.getByTestId("proposta-valor").fill("3000");
    await p.getByTestId("proposta-meses").selectOption("3");
    await p.getByTestId("proposta-data").fill(emDias(10));
    await p.getByTestId("enviar-proposta").click();
    await p.waitForURL(/\/dashboard\/propostas\/[0-9a-f-]{36}$/, { timeout: 20_000 });
    caminho = new URL(p.url()).pathname;
    const noDetalhe = p.getByTestId("proposta-conta").first();
    await expect(noDetalhe).toBeVisible({ timeout: 20_000 });
    conta = (await noDetalhe.innerText()).replace(/\s+/g, " ").trim();
    console.log(`t584 conta no detalhe: "${conta}"`);
    // O condomínio entra no mensal da conta ("3 × R$ 3.350 = R$ 10.050"); extras de uma vez entram como "+ …".
    expect(conta, "a conta aberta tem a multiplicação e o total").toMatch(/^3 × R\$\s?[\d.]+(,\d{2})?( \+ .+)? = R\$\s?[\d.]+(,\d{2})?$/);
    await p.screenshot({ path: "tests/laboratorio/saida/t584-detalhe-1280.png" });
    await p.context().close();
  });

  for (const w of [390, 1280] as const) {
    test(`2. ${w} — a lista do morador mostra a mesma conta, texto a texto`, async ({ browser }) => {
      test.skip(!conta, "depende do caso 1");
      const p = await entrar(browser, inq.email, senha);
      await p.setViewportSize({ width: w, height: w === 390 ? 844 : 900 });
      await p.goto("/dashboard/propostas", { waitUntil: "domcontentloaded" });
      const item = p.getByTestId("proposta-inquilino").filter({ hasText: TITULO }).first();
      await expect(item.getByTestId("proposta-inquilino-conta")).toHaveText(conta, { timeout: 25_000 });
      await p.screenshot({ path: `tests/laboratorio/saida/t584-lista-${w}.png`, fullPage: true });
      await p.context().close();
    });
  }

  test("3. 1280 — o morador vê no detalhe e na mensagem da conversa a mesma conta", async ({ browser }) => {
    test.skip(!conta, "depende do caso 1");
    const p = await entrar(browser, inq.email, senha);
    await p.setViewportSize({ width: 1280, height: 900 });
    await p.goto(caminho, { waitUntil: "domcontentloaded" });
    await expect(p.getByTestId("proposta-conta").first()).toHaveText(conta, { timeout: 20_000 });
    // A mensagem gravada pelo servidor usa a mesma conta (contaDaProposta).
    await expect
      .poll(async () => {
        const { data } = await adm().from("messages").select("body").eq("property_id", ids.imovel);
        return (data ?? []).map((m) => (m.body as string).replace(/\s+/g, " ")).find((b) => b.includes("Total do contrato:")) ?? "";
      }, { timeout: 20_000, message: "mensagem da proposta na conversa" })
      .toContain(`Total do contrato: ${conta}.`);
    await p.goto("/dashboard/mensagens", { waitUntil: "domcontentloaded" });
    await p.getByRole("button", { name: new RegExp(TITULO) }).first().click();
    await expect(p.locator("main")).toContainText(`Total do contrato: ${conta}`, { timeout: 25_000 });
    await p.screenshot({ path: "tests/laboratorio/saida/t584-mensagem-1280.png" });
    await p.context().close();
  });
});
