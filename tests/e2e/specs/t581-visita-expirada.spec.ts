import { test, expect, type Page } from "@playwright/test";
import { NO_LABORATORIO, adm, apagarContas, criarConta, criarImovelPronto, entrar, novaSenha, novoSufixo } from "../fixtures/laboratorio";

/*
  T581 — Visita expirada (#1427), guarda permanente da Pista C: o #1427 trouxe só testes de regra. Na tela:
   1. pedido com TODOS os horários já passados → "Expirada" (data-expirada) para o dono e para o morador, com o aviso
      certo de cada lado; o status gravado continua "pedido" (nada se cancela sozinho);
   2. o dono não tem horário para confirmar (sem "Confirmar horário"): só "Proponha outro horário" e "Recusar";
   3. o morador ainda pode cancelar o pedido; sem a linha de endereço da presencial;
   4. pedido com um horário passado e um futuro → NÃO é expirada; o dono só vê o futuro para confirmar.
  Dono a 1280 e 390, morador a 390 e 1280.
*/
const SAIDA = "tests/laboratorio/saida";
const senha = novaSenha();
const sufixo = novoSufixo();
const dono = { email: `dono.t581.${sufixo}@lab.vivanomads.test`, nome: "Dora Expira", role: "owner" as const };
const mor = { email: `mor.t581.${sufixo}@lab.vivanomads.test`, nome: "Mia Expira", role: "tenant" as const };
const ids: Record<string, string> = {};
const H = 3600_000;
const AVISO_DONO = "Os horários pedidos já passaram. Proponha outro horário ou recuse.";
const AVISO_MORADOR = "Os horários pedidos já passaram. Espere o proprietário propor outro ou cancele o pedido.";

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

  for (const w of [1280, 390] as const) {
    test(`a ${w} px — dono: a vencida é 'Expirada' sem horário para confirmar; a mista segue pedida só com o futuro`, async ({ browser }) => {
      const p = await entrar(browser, dono.email, senha);
      await p.setViewportSize({ width: w, height: w === 390 ? 844 : 900 });
      await p.goto("/dashboard/visitas?de=dono", { waitUntil: "domcontentloaded" });
      const vencida = cartao(p, "Visita vencida t581");
      await expect(vencida.getByTestId("visita-status")).toHaveText("Expirada", { timeout: 30_000 });
      await expect(vencida.getByTestId("visita-status")).toHaveAttribute("data-expirada", "1");
      await expect(vencida.getByTestId("visita-expirada-aviso")).toHaveText(AVISO_DONO);
      await expect(vencida.getByTestId("visita-confirmar")).toHaveCount(0);
      await expect(vencida.locator('input[type="radio"]')).toHaveCount(0);
      await expect(vencida.getByTestId("visita-outro-horario")).toBeVisible();
      await expect(vencida.getByTestId("visita-recusar")).toBeVisible();

      const mista = cartao(p, "Visita mista t581");
      await expect(mista.getByTestId("visita-status")).not.toHaveAttribute("data-expirada", "1");
      await expect(mista.getByTestId("visita-expirada-aviso")).toHaveCount(0);
      await expect(mista.locator('input[type="radio"]'), "só o horário que ainda vale").toHaveCount(1);
      await expect(mista.getByTestId("visita-confirmar")).toBeVisible();
      await vencida.scrollIntoViewIfNeeded();
      await p.screenshot({ path: `${SAIDA}/t581-dono-${w}.png`, fullPage: true });
      await p.context().close();

      // Nada se cancela sozinho: o status gravado segue "pedido".
      const { data } = await adm().from("visitas_video").select("status").eq("id", ids.pedidoVencido).single();
      expect(data?.status).toBe("pedido");
    });

    test(`a ${w} px — morador: a vencida é 'Expirada' com o aviso dele e ainda pode cancelar`, async ({ browser }) => {
      const p = await entrar(browser, mor.email, senha);
      await p.setViewportSize({ width: w, height: w === 390 ? 844 : 900 });
      await p.goto("/dashboard/visitas", { waitUntil: "domcontentloaded" });
      const vencida = cartao(p, "Visita vencida t581");
      await expect(vencida.getByTestId("visita-status")).toHaveText("Expirada", { timeout: 30_000 });
      await expect(vencida.getByTestId("visita-expirada-aviso")).toHaveText(AVISO_MORADOR);
      await expect(vencida.getByTestId("visita-cancelar-morador")).toBeVisible();
      await expect(vencida.getByTestId("visita-endereco")).toHaveCount(0);
      await expect(cartao(p, "Visita mista t581").getByTestId("visita-status")).not.toHaveText("Expirada");
      await vencida.scrollIntoViewIfNeeded();
      await p.screenshot({ path: `${SAIDA}/t581-morador-${w}.png`, fullPage: true });
      await p.context().close();
    });
  }
});
