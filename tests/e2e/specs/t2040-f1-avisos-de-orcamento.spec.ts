import { test, expect } from "@playwright/test";
import { NO_LABORATORIO, adm, apagarContas, novaSenha } from "../fixtures/laboratorio";
import { abrirComo, cenarioOrcamento, enviarPelaTela, type CenarioOrcamento } from "../fixtures/orcamento-lab";

/*
  T2040 (orçamentos) — Pista 3, lote 2, item F1 @E444 @E482 @ao-vivo-seguro (contas de teste, sem dinheiro, sem
  assinatura; o e-mail do laboratório vai para a caixa simulada). Regra: cada evento de orçamento gera o aviso da
  prioridade certa, para a outra parte, com o imóvel e o destino da proposta:
    • proposta enviada → morador: proposta_recebida, CRÍTICO, faixa "Responder a proposta";
    • contraproposta do morador → dono: proposta_recebida, CRÍTICO; o crítico do morador fica resolvido (a faixa some);
    • aceite → as DUAS partes: proposta_aceita, URGENTE, com o imóvel (emailsDoAceite; esse aviso não leva ref_id).
  (A parte de mensagens do F1 está em t2040-f1-aviso-de-mensagem-prioridade.) Vermelho: pendente de laboratório.
*/
const senha = novaSenha();
let c: CenarioOrcamento;
type Aviso = { evento: string; prioridade: string; titulo: string; url: string; ref_id: string | null; resolvido_em: string | null };
const avisos = async (usuario: string, ref: string) =>
  ((await adm().from("avisos").select("evento, prioridade, titulo, url, ref_id, resolvido_em").eq("usuario_id", usuario).eq("ref_id", ref)).data ?? []) as Aviso[];

test.describe("T2040 — F1: avisos dos eventos de orçamento @E444", () => {
  test.skip(!NO_LABORATORIO, "Só no laboratório.");
  test.describe.configure({ mode: "serial", timeout: 240_000 });
  test.beforeAll(async () => {
    c = await cenarioOrcamento("Avisos", senha);
  });
  test.afterAll(async () => {
    await adm().from("avisos").delete().in("usuario_id", [c?.dono.id ?? "", c?.moradores[0]?.id ?? ""]);
    await adm().from("messages").delete().eq("property_id", c?.imovel ?? "");
    await apagarContas([c?.dono.id, ...(c?.moradores ?? []).map((m) => m.id)]);
  });

  test("enviada → crítico ao morador; contraproposta → crítico ao dono e resolve o do morador; aceite → urgente", async ({ browser }) => {
    const m = c.moradores[0];
    const dono = await abrirComo(browser, c.dono.email, senha);
    const { id } = await enviarPelaTela(dono, m.lead, { valor: 3200, dias: 120 });

    // 1. Morador: crítico, com o imóvel e o destino da proposta; a faixa chama para responder.
    await expect.poll(async () => (await avisos(m.id, id)).filter((a) => a.evento === "proposta_recebida").length, { timeout: 30_000 }).toBe(1);
    const [recebida] = (await avisos(m.id, id)).filter((a) => a.evento === "proposta_recebida");
    expect(recebida.prioridade).toBe("critico");
    expect(recebida.titulo).toContain(c.titulo);
    expect(recebida.url).toContain(`/dashboard/propostas/${id}`);
    const inq = await abrirComo(browser, m.email, senha);
    await inq.goto("/dashboard", { waitUntil: "domcontentloaded" });
    await expect(inq.getByTestId("faixa-critico-acao")).toHaveText("Responder a proposta", { timeout: 30_000 });

    // 2. Contraproposta do morador: crítico para o dono; o do morador sai (resolvido) e a faixa some.
    await inq.goto(`/dashboard/propostas/${id}`, { waitUntil: "domcontentloaded" });
    await inq.getByTestId("proposta-contrapropor").click();
    await inq.getByTestId("ficar-mais-tempo").click();
    await inq.getByTestId("enviar-contraproposta").click();
    await expect(inq.getByTestId("proposta-status")).toHaveText("Contraproposta", { timeout: 30_000 });
    await expect.poll(async () => (await avisos(c.dono.id, id)).filter((a) => a.evento === "proposta_recebida").length, { timeout: 30_000 }).toBe(1);
    const [doDono] = (await avisos(c.dono.id, id)).filter((a) => a.evento === "proposta_recebida");
    expect(doDono.prioridade).toBe("critico");
    expect(doDono.titulo).toContain(c.titulo);
    await expect.poll(async () => (await avisos(m.id, id)).find((a) => a.evento === "proposta_recebida")?.resolvido_em ?? null, { timeout: 15_000 }).not.toBeNull();
    await inq.goto("/dashboard", { waitUntil: "domcontentloaded" });
    await expect(inq.getByTestId("faixa-critico")).toHaveCount(0, { timeout: 30_000 });

    // 3. O dono aceita: as duas partes recebem proposta_aceita, urgente, com o imóvel; o crítico do dono fica resolvido.
    await dono.goto(`/dashboard/propostas/${id}`, { waitUntil: "domcontentloaded" });
    await dono.getByTestId("proposta-aceitar").click();
    await dono.waitForURL(/\/dashboard\/fechamento\?c=/, { timeout: 30_000 });
    const aceitas = async (usuario: string) =>
      ((await adm().from("avisos").select("prioridade, titulo").eq("usuario_id", usuario).eq("evento", "proposta_aceita")).data ?? []) as { prioridade: string; titulo: string }[];
    for (const quem of [m.id, c.dono.id]) {
      await expect.poll(async () => (await aceitas(quem)).length, { timeout: 30_000 }).toBe(1);
      const [a] = await aceitas(quem);
      expect(a.prioridade).toBe("urgente");
      expect(a.titulo).toContain(c.titulo);
    }
    await expect.poll(async () => (await avisos(c.dono.id, id)).find((a) => a.evento === "proposta_recebida")?.resolvido_em ?? null, { timeout: 15_000 }).not.toBeNull();
    await dono.context().close();
    await inq.context().close();
  });
});
