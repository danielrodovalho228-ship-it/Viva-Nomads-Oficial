import { test, expect } from "@playwright/test";
import { NO_LABORATORIO, adm, apagarContas, criarConta, criarImovelPronto, criarLead, entrar, novaSenha, novoSufixo } from "../fixtures/laboratorio";

/**
 * T1083 — E500 + E547 (#2427, 04/11): um imóvel não tem duas visitas confirmadas no mesmo horário, e a lista do dono diz
 * quem vem. Antes, o dono confirmava dois moradores diferentes às 10:00 do mesmo dia no mesmo imóvel e a lista mostrava
 * dois cartões idênticos. Pela tela real (/dashboard/visitas?de=dono), 390 e 1280:
 *   1. Ana já tem a visita presencial CONFIRMADA no studio A às H; o pedido do Bruno no studio A, também às H, ao
 *      "Confirmar horário" → "Este horário já está confirmado com outra visita neste imóvel. Proponha outro horário."
 *      e o pedido segue "pedido" no banco;
 *   2. o mesmo horário H em OUTRO imóvel (studio B, pedido da Carla) confirma normalmente;
 *   3. quem vem: a confirmada mostra o nome (Ana; Carla depois de confirmar); o pedido ainda aberto, "Interessado(a)".
 * A regra pura (horarioOcupado) fica com o horario-ocupado.test.ts.
 */
const senha = novaSenha();
const sufixo = novoSufixo();
const dono = { email: `dono.t1083.${sufixo}@lab.vivanomads.test`, nome: "Hugo Horario Neves", role: "owner" as const };
const ana = { email: `ana.t1083.${sufixo}@lab.vivanomads.test`, nome: "Ana Agenda Rocha", role: "tenant" as const };
const bruno = { email: `bruno.t1083.${sufixo}@lab.vivanomads.test`, nome: "Bruno Bloqueio Dias", role: "tenant" as const };
const carla = { email: `carla.t1083.${sufixo}@lab.vivanomads.test`, nome: "Carla Calendario Luz", role: "tenant" as const };
const ids: Record<string, string> = {};
const MSG = "Este horário já está confirmado com outra visita neste imóvel. Proponha outro horário.";
const H = (() => {
  const d = new Date(Date.now() + 3 * 24 * 3600_000);
  d.setUTCMinutes(0, 0, 0);
  d.setUTCHours(13);
  return d.toISOString();
})();

async function visita(imovel: string, tenant: string, status: "confirmado" | "pedido") {
  const { data, error } = await adm()
    .from("visitas_video")
    .insert({ property_id: imovel, owner_id: ids.dono, tenant_id: tenant, horarios: [H], modalidade: "presencial", status, horario_confirmado: status === "confirmado" ? H : null })
    .select("id")
    .single();
  if (error) throw error;
  return (data as { id: string }).id;
}
const statusDe = async (id: string) => ((await adm().from("visitas_video").select("status").eq("id", id).single()).data as { status: string }).status;

test.describe("T1083 — E500/E547: sem duas visitas confirmadas no mesmo horário do imóvel; a lista diz quem vem", () => {
  test.skip(!NO_LABORATORIO, "Só no laboratório.");
  test.describe.configure({ mode: "serial", timeout: 120_000 });

  test.beforeAll(async () => {
    ids.dono = await criarConta(dono, senha);
    ids.ana = await criarConta(ana, senha);
    ids.bruno = await criarConta(bruno, senha);
    ids.carla = await criarConta(carla, senha);
    ids.imA = await criarImovelPronto(ids.dono, `Studio A das visitas t1083 ${sufixo}`, { ativo: true });
    ids.imB = await criarImovelPronto(ids.dono, `Studio B das visitas t1083 ${sufixo}`, { ativo: true });
    await criarLead(ids.dono, ids.ana, ids.imA, true);
    await criarLead(ids.dono, ids.bruno, ids.imA, true);
    await criarLead(ids.dono, ids.carla, ids.imB, true);
  });

  test.afterAll(async () => {
    if (!NO_LABORATORIO) return;
    await adm().from("visitas_video").delete().eq("owner_id", ids.dono ?? "");
    await adm().from("leads").delete().eq("owner_id", ids.dono ?? "");
    await apagarContas([ids.ana, ids.bruno, ids.carla, ids.dono]);
  });

  for (const w of [390, 1280] as const) {
    test(`o 2º Confirmar no mesmo horário é recusado; outro imóvel confirma; quem vem na lista (${w})`, async ({ browser }) => {
      await adm().from("visitas_video").delete().eq("owner_id", ids.dono);
      const vAna = await visita(ids.imA, ids.ana, "confirmado");
      const vBruno = await visita(ids.imA, ids.bruno, "pedido");
      const vCarla = await visita(ids.imB, ids.carla, "pedido");

      const p = await entrar(browser, dono.email, senha);
      await p.setViewportSize({ width: w, height: w === 390 ? 844 : 900 });
      await p.goto("/dashboard/visitas?de=dono", { waitUntil: "domcontentloaded" });
      const cartao = (id: string) => p.locator(`#visita-${id}`);

      // 3a. Quem vem: a confirmada com o nome; o pedido aberto protegido.
      await expect(cartao(vAna).getByTestId("visita-pessoa")).toContainText("Ana", { timeout: 30_000 });
      await expect(cartao(vBruno).getByTestId("visita-pessoa")).toHaveText("Quem vem: Interessado(a)");

      // 1. O pedido do Bruno no MESMO imóvel e horário: recusado, segue pedido.
      await cartao(vBruno).getByTestId("visita-confirmar").click();
      await expect(cartao(vBruno).getByTestId("visita-erro")).toHaveText(MSG, { timeout: 30_000 });
      expect(await statusDe(vBruno)).toBe("pedido");
      await expect(cartao(vBruno)).toHaveAttribute("data-status", "pedido");

      // 2. O mesmo horário em OUTRO imóvel confirma; 3b. e passa a dizer quem vem.
      await cartao(vCarla).getByTestId("visita-confirmar").click();
      await expect.poll(() => statusDe(vCarla), { timeout: 30_000 }).toBe("confirmado");
      await p.reload({ waitUntil: "domcontentloaded" });
      await expect(cartao(vCarla).getByTestId("visita-pessoa")).toContainText("Carla", { timeout: 30_000 });
      await expect(cartao(vBruno).getByTestId("visita-pessoa")).toHaveText("Quem vem: Interessado(a)");
      const sobra = await p.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
      expect(sobra).toBeLessThanOrEqual(1);
      await p.context().close();
    });
  }
});
