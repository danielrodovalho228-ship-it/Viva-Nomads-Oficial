import { test, expect, type Page } from "@playwright/test";
import { NO_LABORATORIO, adm, apagarContas, criarConta, criarImovelPronto, entrar, novaSenha, novoSufixo } from "../fixtures/laboratorio";

/*
  T581 — Visita expirada (#1427, com a regra nova do E205-B/#1447), guarda permanente da Pista C. Na tela:
   1. pedido com TODOS os horários já passados → "Expirada" (data-expirada) para o dono, sem horário para confirmar;
      ao abrir a lista, a regra grava "cancelado" com o motivo "expirou" (E205-B; antes do #1447 nada se cancelava);
   2. pedido com um horário passado e um futuro → NÃO é expirada, segue "pedido" no banco; o dono só vê o futuro;
   3. depois de gravada, a expirada segue "Expirada" para os dois, com o aviso novo de cada lado e sem a linha "Motivo".
  Os e-mails da expirada ficam na t585 (E205-B). Dono a 1280 e 390, morador a 390 e 1280.
*/
const SAIDA = "tests/laboratorio/saida";
const senha = novaSenha();
const sufixo = novoSufixo();
const dono = { email: `dono.t581.${sufixo}@lab.vivanomads.test`, nome: "Dora Expira", role: "owner" as const };
const mor = { email: `mor.t581.${sufixo}@lab.vivanomads.test`, nome: "Mia Expira", role: "tenant" as const };
const ids: Record<string, string> = {};
const H = 3600_000;
const AVISO_DONO = "O pedido expirou sem resposta.";
const AVISO_MORADOR = "O pedido expirou sem resposta. Peça outros horários.";

async function pedido(imovel: string, horarios: Date[]): Promise<string> {
  const { data, error } = await adm()
    .from("visitas_video")
    .insert({ property_id: imovel, owner_id: ids.dono, tenant_id: ids.mor, horarios: horarios.map((h) => h.toISOString()), modalidade: "presencial", status: "pedido" })
    .select("id")
    .single();
  if (error) throw error;
  return data.id as string;
}
const cartao = (p: Page, titulo: string) => p.getByTestId("cartao-visita").filter({ hasText: titulo });
const gravado = async (id: string) => (await adm().from("visitas_video").select("status, motivo_recusa").eq("id", id).single()).data;

test.describe("T581 — visita pedida com os horários vencidos aparece como Expirada", () => {
  test.skip(!NO_LABORATORIO, "Só no laboratório.");
  test.describe.configure({ mode: "serial", timeout: 120_000 });

  test.beforeAll(async () => {
    ids.dono = await criarConta(dono, senha);
    ids.mor = await criarConta(mor, senha);
    ids.vencida = await criarImovelPronto(ids.dono, `Visita vencida t581 ${sufixo}`, { ativo: true });
    ids.mista = await criarImovelPronto(ids.dono, `Visita mista t581 ${sufixo}`, { ativo: true });
    ids.pedidoVencido = await pedido(ids.vencida, [new Date(Date.now() - 3 * 24 * H), new Date(Date.now() - 2 * 24 * H)]);
    ids.pedidoMisto = await pedido(ids.mista, [new Date(Date.now() - 2 * 24 * H), new Date(Date.now() + 3 * 24 * H)]);
  });
  test.afterAll(async () => {
    await adm().from("visitas_video").delete().eq("owner_id", ids.dono ?? "");
    await apagarContas([ids.mor, ids.dono]);
  });

  test("1. 1280 — dono: a vencida é 'Expirada' sem horário para confirmar; ao abrir, grava cancelado/expirou; a mista segue pedida", async ({ browser }) => {
    const p = await entrar(browser, dono.email, senha);
    await p.setViewportSize({ width: 1280, height: 900 });
    await p.goto("/dashboard/visitas?de=dono", { waitUntil: "domcontentloaded" });
    const vencida = cartao(p, "Visita vencida t581");
    await expect(vencida.getByTestId("visita-status")).toHaveText("Expirada", { timeout: 30_000 });
    await expect(vencida.getByTestId("visita-status")).toHaveAttribute("data-expirada", "1");
    await expect(vencida.getByTestId("visita-expirada-aviso")).toBeVisible();
    await expect(vencida.getByTestId("visita-confirmar")).toHaveCount(0);
    await expect(vencida.locator('input[type="radio"]')).toHaveCount(0);

    const mista = cartao(p, "Visita mista t581");
    await expect(mista.getByTestId("visita-status")).not.toHaveAttribute("data-expirada", "1");
    await expect(mista.getByTestId("visita-expirada-aviso")).toHaveCount(0);
    await expect(mista.locator('input[type="radio"]'), "só o horário que ainda vale").toHaveCount(1);
    await expect(mista.getByTestId("visita-confirmar")).toBeVisible();
    await vencida.scrollIntoViewIfNeeded();
    await p.screenshot({ path: `${SAIDA}/t581-dono-1280.png`, fullPage: true });
    await p.context().close();

    // E205-B: abrir a lista aplica a regra — a vencida vira cancelado/expirou; a mista não muda.
    await expect.poll(() => gravado(ids.pedidoVencido), { timeout: 30_000 }).toEqual({ status: "cancelado", motivo_recusa: "expirou" });
    expect((await gravado(ids.pedidoMisto))?.status, "a mista tem um horário futuro").toBe("pedido");
  });

  test("2. 390 — dono: a gravada segue 'Expirada' com o aviso dele, sem 'Motivo'; a mista segue com o futuro", async ({ browser }) => {
    test.skip((await gravado(ids.pedidoVencido))?.status !== "cancelado", "depende do caso 1");
    const p = await entrar(browser, dono.email, senha);
    await p.setViewportSize({ width: 390, height: 844 });
    await p.goto("/dashboard/visitas?de=dono", { waitUntil: "domcontentloaded" });
    const vencida = cartao(p, "Visita vencida t581");
    await expect(vencida.getByTestId("visita-status")).toHaveText("Expirada", { timeout: 30_000 });
    await expect(vencida.getByTestId("visita-expirada-aviso")).toHaveText(AVISO_DONO);
    await expect(vencida.getByTestId("visita-motivo-recusa-texto")).toHaveCount(0);
    await expect(vencida.getByTestId("visita-confirmar")).toHaveCount(0);
    await expect(cartao(p, "Visita mista t581").locator('input[type="radio"]')).toHaveCount(1);
    await vencida.scrollIntoViewIfNeeded();
    await p.screenshot({ path: `${SAIDA}/t581-dono-390.png`, fullPage: true });
    await p.context().close();
  });

  for (const w of [390, 1280] as const) {
    test(`3. ${w} — morador: a gravada segue 'Expirada' com o aviso dele, sem 'Motivo' nem endereço`, async ({ browser }) => {
      test.skip((await gravado(ids.pedidoVencido))?.status !== "cancelado", "depende do caso 1");
      const p = await entrar(browser, mor.email, senha);
      await p.setViewportSize({ width: w, height: w === 390 ? 844 : 900 });
      await p.goto("/dashboard/visitas", { waitUntil: "domcontentloaded" });
      const vencida = cartao(p, "Visita vencida t581");
      await expect(vencida.getByTestId("visita-status")).toHaveText("Expirada", { timeout: 30_000 });
      await expect(vencida.getByTestId("visita-expirada-aviso")).toHaveText(AVISO_MORADOR);
      await expect(vencida.getByTestId("visita-motivo-recusa-texto")).toHaveCount(0);
      await expect(vencida.getByTestId("visita-endereco")).toHaveCount(0);
      await expect(cartao(p, "Visita mista t581").getByTestId("visita-status")).not.toHaveText("Expirada");
      await vencida.scrollIntoViewIfNeeded();
      await p.screenshot({ path: `${SAIDA}/t581-morador-${w}.png`, fullPage: true });
      await p.context().close();
    });
  }
});
