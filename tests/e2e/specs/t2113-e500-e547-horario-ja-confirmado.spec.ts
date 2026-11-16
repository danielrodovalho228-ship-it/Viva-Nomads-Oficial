import { test, expect } from "@playwright/test";
import { NO_LABORATORIO, adm, apagarContas, criarConta, criarImovelPronto, entrar, novaSenha, novoSufixo } from "../fixtures/laboratorio";

/*
  T2113 — E500 + E547 (Pista 3; varredura "sem spec" das 142, lote I) @E500 @E547 — sem @ao-vivo-seguro: precisa de
  sessão e do laboratório (VERMELHO PENDENTE DE LABORATÓRIO).
  Regra decidida (E500 + E547; unitário horario-ocupado.test.ts): duas visitas CONFIRMADAS no mesmo horário do mesmo
  imóvel não podem existir. Quando o dono tenta confirmar o 2º pedido no horário que já está confirmado com outra visita,
  o servidor recusa ANTES de gravar, com "Este horário já está confirmado com outra visita neste imóvel. Proponha outro
  horário.". Controle: liberado o horário (a 1ª visita cancelada), o mesmo confirmar passa.
  Montagem (presencial, para não pedir link de chamada): a visita A já confirmada no horário H; a visita B pedida para H.
*/
const senha = novaSenha();
const sufixo = novoSufixo();
const dono = { email: `dono.t2113.${sufixo}@lab.vivanomads.test`, nome: "Vera Visitas", role: "owner" as const };
const morA = { email: `mora.t2113.${sufixo}@lab.vivanomads.test`, nome: "Alice Primeira", role: "tenant" as const };
const morB = { email: `morb.t2113.${sufixo}@lab.vivanomads.test`, nome: "Bruno Segundo", role: "tenant" as const };
const ids: Record<string, string> = {};
const MSG = "Este horário já está confirmado com outra visita neste imóvel. Proponha outro horário.";

/** Daqui a 3 dias, às 13:00 UTC (10:00 de Brasília), sem segundos. */
function horarioH(): string {
  const d = new Date(Date.now() + 3 * 86_400_000);
  d.setUTCHours(13, 0, 0, 0);
  return d.toISOString();
}

test.describe("T2113 — E500/E547: o 2º confirmar no horário já confirmado é recusado antes de gravar @E500 @E547", () => {
  test.skip(!NO_LABORATORIO, "Só no laboratório (precisa de sessão e da chave de serviço).");
  test.describe.configure({ mode: "serial", timeout: 120_000 });

  test.beforeEach(async () => {
    ids.dono ??= await criarConta(dono, senha);
    ids.morA ??= await criarConta(morA, senha);
    ids.morB ??= await criarConta(morB, senha);
    ids.imovel ??= await criarImovelPronto(ids.dono, `Studio das visitas ${sufixo}`, { ativo: true });
    await adm().from("visitas_video").delete().eq("property_id", ids.imovel);
    const H = horarioH();
    ids.H = H;
    const { data: a, error: ea } = await adm()
      .from("visitas_video")
      .insert({ property_id: ids.imovel, owner_id: ids.dono, tenant_id: ids.morA, horarios: [H], modalidade: "presencial", status: "confirmado", horario_confirmado: H })
      .select("id")
      .single();
    if (ea) throw ea;
    ids.visitaA = a.id as string;
    const { data: b, error: eb } = await adm()
      .from("visitas_video")
      .insert({ property_id: ids.imovel, owner_id: ids.dono, tenant_id: ids.morB, horarios: [H], modalidade: "presencial", status: "pedido" })
      .select("id")
      .single();
    if (eb) throw eb;
    ids.visitaB = b.id as string;
  });

  test.afterAll(async () => {
    if (ids.imovel) await adm().from("visitas_video").delete().eq("property_id", ids.imovel);
    await apagarContas([ids.dono, ids.morA, ids.morB]);
  });

  async function statusDeB() {
    const { data } = await adm().from("visitas_video").select("status, horario_confirmado").eq("id", ids.visitaB).single();
    return data as { status: string; horario_confirmado: string | null };
  }

  for (const largura of [390, 1280] as const) {
    test(`${largura} px — confirmar B no horário de A é recusado com a mensagem; liberado o horário, confirma`, async ({ browser }) => {
      const p = await entrar(browser, dono.email, senha);
      await p.setViewportSize({ width: largura, height: largura === 390 ? 844 : 900 });
      // A lista dos pedidos recebidos pelo dono é a de ?de=dono (a /dashboard/visitas sozinha é a do morador, E176).
      await p.goto("/dashboard/visitas?de=dono", { waitUntil: "domcontentloaded" });
      const cartaoB = p.locator(`#visita-${ids.visitaB}`);
      await expect(cartaoB, "o cartão do pedido B").toBeVisible({ timeout: 30_000 });
      await expect(cartaoB).toHaveAttribute("data-status", "pedido");

      await cartaoB.getByTestId("visita-confirmar").click();
      await expect(cartaoB.getByTestId("visita-erro"), "a recusa diz por quê").toHaveText(MSG, { timeout: 15_000 });
      expect(await statusDeB(), "nada gravado: B continua pedido, sem horário confirmado").toEqual({ status: "pedido", horario_confirmado: null });

      // Controle: liberado o horário, o mesmo confirmar passa (a recusa era só pelo horário ocupado).
      await adm().from("visitas_video").update({ status: "cancelado" }).eq("id", ids.visitaA);
      await p.reload({ waitUntil: "domcontentloaded" });
      await expect(cartaoB).toBeVisible({ timeout: 30_000 });
      await cartaoB.getByTestId("visita-confirmar").click();
      await expect(cartaoB.getByTestId("visita-erro")).toHaveCount(0);
      await expect.poll(async () => (await statusDeB()).status, { message: "B confirmada depois de liberado o horário", timeout: 15_000 }).toBe("confirmado");
      await p.context().close();
    });
  }
});
