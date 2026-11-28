import { test, expect, type Browser, type Page } from "@playwright/test";
import { NO_LABORATORIO, adm, apagarContas, criarConta, criarImovelPronto, entrar, liberarLimiteChamados, novaSenha, novoSufixo } from "../fixtures/laboratorio";

/*
  Vizinha do E1250 (ESPEC-E1250): o selo "Anulado" decide pela data; corre sem alteração.

  T1801 — E1243 (ORDENS-DUET 1213 e 1216): o pedido de anulação à Central, visto pelo dono que o abriu.
   1. (o ÁRBITRO do 404) o dono é uma CONTA DE TESTE: o chamado do pedido nasce com simulacao = true (gatilho da 0135);
      o link do e-mail do dono (/ajuda?chamado=VN-…) abre o chamado para quem o abriu.
   2. a linha do pedido continua na página de Contratos depois de recarregar, enquanto o chamado está aberto; resolvido,
      a linha sai e o botão de pedir volta.
  Simulação declarada: o contrato assinado e o registro confirmado gravados pelo laboratório. Laboratório; não é prova
  ao vivo no site.
*/
const senha = novaSenha();
const sufixo = novoSufixo();
const dono = { email: `dono.t1801.${sufixo}@lab.vivanomads.test`, nome: "Paula Pede Anulação", role: "owner" as const };
const inq = { email: `inq.t1801.${sufixo}@lab.vivanomads.test`, nome: "Rui Confirma Pagamento", role: "tenant" as const };
const ids: Record<string, string | undefined> = {};
const dia = (n: number) => new Date(Date.now() + n * 86_400_000).toISOString().slice(0, 10);
const MOTIVO = "pagamento devolvido ao morador";

async function abrir(browser: Browser, caminho: string): Promise<Page> {
  const p = await entrar(browser, dono.email, senha);
  await p.setViewportSize({ width: 1280, height: 900 });
  await p.goto(caminho, { waitUntil: "domcontentloaded" });
  await p.waitForLoadState("networkidle", { timeout: 10_000 }).catch(() => {});
  return p;
}
const recibo = (p: Page) => p.locator(`[data-contrato="${ids.contrato}"]`).getByTestId("recibo-pagamento").first();

test.describe("T1801 — E1243: o pedido de anulação visível para o dono que o abriu @E1243", () => {
  test.skip(!NO_LABORATORIO, "Só no laboratório.");
  test.describe.configure({ mode: "serial", timeout: 180_000 });

  test.beforeAll(async () => {
    ids.dono = await criarConta(dono, senha);
    ids.inq = await criarConta(inq, senha);
    // As contas do laboratório são contas de TESTE: o chamado que o dono abrir nasce com simulacao = true.
    await adm().from("profiles").update({ is_teste: true }).in("id", [ids.dono, ids.inq]);
    await liberarLimiteChamados();
    ids.imovel = await criarImovelPronto(ids.dono, `Studio pedido ${sufixo}`, { ativo: true, preco: 3200 });
    const agora = new Date().toISOString();
    const { data: c, error } = await adm()
      .from("contratos")
      .insert({
        property_id: ids.imovel, tenant_id: ids.inq, owner_plan: "free", faixa: "temporada", prazo_total_dias: 60, aluguel_mensal: 3200,
        tamanho_bloco_meses: 2, comissao_percent: 0.12, comissao_valor: 768, qtd_ocupantes: 1, status: "ativo", garantia: "caucao",
        assinado_proprietario_em: agora, assinado_inquilino_em: agora,
      })
      .select("id")
      .single();
    if (error) throw error;
    ids.contrato = c.id as string;
    const { data: bl, error: eb } = await adm()
      .from("contrato_blocos")
      .insert({ contrato_id: ids.contrato, numero_bloco: 1, inicio: dia(-30), fim: dia(29), meses: 2, valor: 6400, caucao: 0, status: "ativo" })
      .select("id")
      .single();
    if (eb) throw eb;
    const { data: pg, error: ep } = await adm()
      .from("pagamentos_bloco")
      .insert({ bloco_id: bl.id, contrato_id: ids.contrato, tipo: "aluguel", valor: 6400, data_pagamento: dia(-30), marcado_por: ids.dono, confirmado_pelo_inquilino: true, confirmado_em: agora })
      .select("id")
      .single();
    if (ep) throw ep;
    ids.pagamento = pg.id as string;
  });
  test.afterAll(async () => {
    if (ids.contrato) await adm().from("chamados").delete().eq("contexto_id", ids.contrato);
    await apagarContas([ids.inq, ids.dono]);
  });

  test("1. (árbitro) o chamado do pedido de uma conta de teste nasce como simulação, e o link do e-mail abre-o para o dono", async ({ browser }) => {
    const p = await abrir(browser, "/dashboard/contratos");
    const r = recibo(p);
    await expect(r).toBeVisible({ timeout: 20_000 });
    await r.getByTestId("anular-registro").click();
    await r.getByTestId("anular-motivo").fill(MOTIVO);
    await r.getByTestId("anular-confirmar").click();
    await expect(r.getByTestId("anular-feito")).toContainText(/chamado/i, { timeout: 20_000 });
    const { data: ch } = await adm().from("chamados").select("id, numero_publico, usuario_id, simulacao").eq("contexto_id", ids.contrato!).maybeSingle();
    expect(ch, "o chamado do pedido").not.toBeNull();
    expect(ch!.usuario_id, "aberto pelo dono").toBe(ids.dono);
    expect(ch!.simulacao, "conta de teste → simulação (o caso do VN-000110)").toBe(true);
    ids.chamado = ch!.id as string;
    ids.numero = ch!.numero_publico as string;
    // O link do e-mail do dono (avisarUsuario → linkChamado).
    await p.goto(`/ajuda?chamado=${ids.numero}`, { waitUntil: "domcontentloaded" });
    await expect(p.getByTestId("chamado-aberto-em"), "o chamado abre para quem o abriu").toBeVisible({ timeout: 30_000 });
    await expect(p.getByText("Chamado não encontrado")).toHaveCount(0);
    await p.context().close();
  });

  test("2. a linha do pedido fica na página de Contratos enquanto o chamado está aberto; resolvido, sai", async ({ browser }) => {
    const p = await abrir(browser, "/dashboard/contratos");
    const r = recibo(p);
    await expect(r.getByTestId("pedido-anulacao")).toContainText(ids.numero!, { timeout: 20_000 });
    await expect(r.getByTestId("anular-registro"), "não volta a pedir com o pedido aberto").toHaveCount(0);
    await p.reload({ waitUntil: "domcontentloaded" });
    await expect(recibo(p).getByTestId("pedido-anulacao"), "continua depois de recarregar").toContainText(ids.numero!, { timeout: 20_000 });
    await adm().from("chamados").update({ status: "resolvido", resolvido_em: new Date().toISOString() }).eq("id", ids.chamado!);
    await p.reload({ waitUntil: "domcontentloaded" });
    await expect(recibo(p).getByTestId("anular-registro"), "resolvido: o botão volta").toBeVisible({ timeout: 20_000 });
    await expect(recibo(p).getByTestId("pedido-anulacao")).toHaveCount(0);
    await p.context().close();
  });
});
