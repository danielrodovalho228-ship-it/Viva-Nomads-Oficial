import { test, expect } from "@playwright/test";
import { NO_LABORATORIO, adm, apagarContas, novaSenha } from "../fixtures/laboratorio";
import { abrirComo, abrirMontagem, cenarioOrcamento, enviarPelaTela, texto, type CenarioOrcamento } from "../fixtures/orcamento-lab";

/*
  T2031 — Pista 3, lote 2, item D6 @E677   (sem @ao-vivo-seguro: valores de contrato).
  Regra: dois orçamentos ao mesmo tempo, sem mistura —
    • no MESMO interessado, um segundo orçamento com o primeiro em aberto é recusado com a mensagem clara
      ("Já há uma proposta em andamento com este interessado.") e nada novo fica aberto;
    • em DOIS interessados do mesmo imóvel, cada morador vê só o seu (valores e número), o dono vê os dois certos, e o
      aceite de um leva ao Fechamento dele os valores dele — o outro segue intacto.
  Vermelho: pendente de laboratório.
*/
const senha = novaSenha();
let c: CenarioOrcamento;
const abertas = async (lead: string) => ((await adm().from("propostas").select("id").eq("lead_id", lead).in("status", ["enviada", "vista", "contraproposta"])).data ?? []).length;

test.describe("T2031 — D6: dois orçamentos ao mesmo tempo, sem mistura", () => {
  test.skip(!NO_LABORATORIO, "Só no laboratório.");
  test.describe.configure({ mode: "serial", timeout: 240_000 });
  test.beforeAll(async () => {
    c = await cenarioOrcamento("Dois", senha, { moradores: 2 });
  });
  test.afterAll(async () => {
    await adm().from("messages").delete().eq("property_id", c?.imovel ?? "");
    await apagarContas([c?.dono.id, ...(c?.moradores ?? []).map((m) => m.id)]);
  });

  test("mesmo interessado: o 2º orçamento com o 1º em aberto é recusado com a mensagem clara", async ({ browser }) => {
    const [a] = c.moradores;
    const dono = await abrirComo(browser, c.dono.email, senha);
    await enviarPelaTela(dono, a.lead, { valor: 3200, dias: 120 });
    expect(await abertas(a.lead)).toBe(1);
    await abrirMontagem(dono, a.lead, { valor: 2900, dias: 60 });
    await dono.getByTestId("enviar-proposta").click();
    await expect(dono.getByTestId("proposta-erro")).toHaveText(/Já há uma proposta em andamento com este interessado\./, { timeout: 20_000 });
    expect(await abertas(a.lead)).toBe(1);
    const { data: v } = await adm().from("propostas").select("proposta_versoes(valor_mensal)").eq("lead_id", a.lead).single();
    expect((v as unknown as { proposta_versoes: { valor_mensal: number }[] }).proposta_versoes.map((x) => Number(x.valor_mensal))).toEqual([3200]);
    await dono.context().close();
  });

  test("dois interessados: cada um vê o seu, e o aceite de um não toca no outro", async ({ browser }) => {
    const [a, b] = c.moradores;
    const dono = await abrirComo(browser, c.dono.email, senha);
    const { id: idB } = await enviarPelaTela(dono, b.lead, { valor: 3500, dias: 60 });
    const contaB = texto(await dono.getByTestId("proposta-conta").textContent());
    const idA = ((await adm().from("propostas").select("id").eq("lead_id", a.lead).single()).data as { id: string }).id;
    await dono.goto(`/dashboard/propostas/${idA}`, { waitUntil: "domcontentloaded" });
    const contaA = texto(await dono.getByTestId("proposta-conta").textContent());
    expect(contaA).not.toBe(contaB);
    const numero = async (id: string) => ((await adm().from("propostas").select("numero").eq("id", id).single()).data as { numero: string }).numero;
    const [numA, numB] = [await numero(idA), await numero(idB)];
    expect(numA).not.toBe(numB);

    // O dono vê os dois, cada um com a sua conta.
    await dono.goto("/dashboard/orcamentos", { waitUntil: "domcontentloaded" });
    const contas = (await dono.getByTestId("orcamento-conta").allTextContents()).map(texto);
    expect(contas.some((t) => t.includes(contaA))).toBe(true);
    expect(contas.some((t) => t.includes(contaB))).toBe(true);

    // Cada morador: só o seu (a conta e o número do outro não aparecem).
    for (const [m, minha, outra, meuNum, outroNum] of [[a, contaA, contaB, numA, numB], [b, contaB, contaA, numB, numA]] as const) {
      const p = await abrirComo(browser, m.email, senha);
      await p.goto("/dashboard/propostas", { waitUntil: "domcontentloaded" });
      await expect(p.getByTestId("proposta-inquilino")).toHaveCount(1, { timeout: 20_000 });
      expect(texto(await p.getByTestId("proposta-inquilino-conta").textContent())).toBe(minha);
      await expect(p.locator("main")).toContainText(meuNum);
      await expect(p.locator("main")).not.toContainText(outroNum);
      await expect(p.locator("main")).not.toContainText(outra);
      await p.context().close();
    }

    // A aceita: o Fechamento de A traz a conta de A; a proposta de B segue aberta e com os valores dela.
    const pa = await abrirComo(browser, a.email, senha);
    await pa.goto(`/dashboard/propostas/${idA}`, { waitUntil: "domcontentloaded" });
    await pa.getByTestId("proposta-aceitar").click();
    await expect(pa.getByTestId("proposta-status")).toHaveText(/^Aceita/, { timeout: 30_000 });
    await dono.goto(`/dashboard/fechamento?c=${a.lead}`, { waitUntil: "domcontentloaded" });
    await expect(dono.getByTestId("fechamento-proposta")).toContainText(numA, { timeout: 30_000 });
    expect(texto(await dono.getByTestId("fechamento-proposta-conta").textContent())).toBe(contaA);
    const { data: pb } = await adm().from("propostas").select("status, proposta_versoes(valor_mensal)").eq("id", idB).single();
    expect(["enviada", "vista"]).toContain((pb as { status: string }).status);
    expect((pb as unknown as { proposta_versoes: { valor_mensal: number }[] }).proposta_versoes.map((x) => Number(x.valor_mensal))).toEqual([3500]);
    await pa.context().close();
    await dono.context().close();
  });
});
