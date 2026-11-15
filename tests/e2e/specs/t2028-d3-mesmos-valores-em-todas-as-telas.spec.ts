import { test, expect } from "@playwright/test";
import { NO_LABORATORIO, adm, apagarContas, novaSenha } from "../fixtures/laboratorio";
import { abrirComo, cenarioOrcamento, enviarPelaTela, texto, type CenarioOrcamento } from "../fixtures/orcamento-lab";

/*
  T2028 — Pista 3, lote 2, item D3 @E189 @E600   (sem @ao-vivo-seguro: valores de contrato).
  Regra: o orçamento aceito gera a proposta com os MESMOS valores em todas as telas. Com o condomínio do anúncio
  (R$ 300), R$ 3.200 × 120 dias: a mesma conta aberta na montagem, no detalhe do dono e do morador, nas duas listas,
  na mensagem da conversa e, depois do aceite, no Fechamento — e no banco. Vermelho: pendente de laboratório.
*/
const senha = novaSenha();
let c: CenarioOrcamento;

test.describe("T2028 — D3: os mesmos valores em todas as telas", () => {
  test.skip(!NO_LABORATORIO, "Só no laboratório.");
  test.describe.configure({ mode: "serial", timeout: 240_000 });
  test.beforeAll(async () => {
    c = await cenarioOrcamento("Telas", senha, { condominio: 300 });
  });
  test.afterAll(async () => {
    await adm().from("messages").delete().eq("property_id", c?.imovel ?? "");
    await apagarContas([c?.dono.id, ...(c?.moradores ?? []).map((m) => m.id)]);
  });

  test("montagem = detalhe (dono e morador) = listas = conversa = Fechamento = banco", async ({ browser }) => {
    const m = c.moradores[0];
    const dono = await abrirComo(browser, c.dono.email, senha);
    const { id, resumoConta } = await enviarPelaTela(dono, m.lead, { valor: 3200, dias: 120 });
    // O condomínio do anúncio entrou: R$ 3.500 por mês, R$ 14.000 no contrato.
    const conta = texto(await dono.getByTestId("proposta-conta").textContent());
    expect(conta).toMatch(/3\.500/);
    expect(conta).toMatch(/14\.000/);
    expect(resumoConta, "montagem = detalhe do dono").toBe(conta);
    await expect(dono.getByTestId("proposta-total-contrato")).toContainText("14.000");

    await dono.goto("/dashboard/orcamentos", { waitUntil: "domcontentloaded" });
    await expect(dono.getByTestId("orcamento-conta").first()).toContainText(conta, { timeout: 20_000 });

    const inq = await abrirComo(browser, m.email, senha);
    await inq.goto(`/dashboard/propostas/${id}`, { waitUntil: "domcontentloaded" });
    expect(texto(await inq.getByTestId("proposta-conta").textContent()), "detalhe do morador").toBe(conta);
    await expect(inq.getByTestId("proposta-total-contrato")).toContainText("14.000");
    await inq.goto("/dashboard/propostas", { waitUntil: "domcontentloaded" });
    expect(texto(await inq.getByTestId("proposta-inquilino-conta").first().textContent()), "lista do morador").toBe(conta);

    // A mensagem da proposta na conversa traz a mesma conta.
    const { data: msgs } = await adm().from("messages").select("body").eq("property_id", c.imovel);
    expect((msgs ?? []).some((x) => texto(x.body as string).includes(conta)), "mensagem da conversa").toBe(true);

    // O morador aceita; o Fechamento do dono abre com a MESMA conta.
    await inq.goto(`/dashboard/propostas/${id}`, { waitUntil: "domcontentloaded" });
    await inq.getByTestId("proposta-aceitar").click();
    await expect(inq.getByTestId("proposta-status")).toHaveText(/^Aceita/, { timeout: 30_000 });
    expect(texto(await inq.getByTestId("proposta-conta").textContent()), "detalhe depois do aceite").toBe(conta);
    await dono.goto(`/dashboard/fechamento?c=${m.lead}`, { waitUntil: "domcontentloaded" });
    await expect(dono.getByTestId("fechamento-proposta-contrato")).toContainText("14.000", { timeout: 30_000 });
    expect(texto(await dono.getByTestId("fechamento-proposta-conta").textContent()), "Fechamento").toBe(conta);

    const { data: v } = await adm().from("proposta_versoes").select("valor_mensal, condominio, total_mensal, total_contrato").eq("proposta_id", id).single();
    expect([Number(v!.valor_mensal), Number(v!.condominio), Number(v!.total_mensal), Number(v!.total_contrato)]).toEqual([3200, 300, 3500, 14000]);
    await dono.context().close();
    await inq.context().close();
  });
});
