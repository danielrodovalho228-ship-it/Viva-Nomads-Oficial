import { test, expect, type Browser, type Page } from "@playwright/test";
import { NO_LABORATORIO, adm, apagarContas, criarAdmin, criarConta, criarImovelPronto, entrar, liberarLimiteChamados, novaSenha, novoSufixo } from "../fixtures/laboratorio";

/*
  T1800 — E1229 (ORDENS-DUET 1143, 1160, 1162 e 1168): a anulação de registros pela tela, o caminho inteiro.
   1. o dono anula ANTES da confirmação do morador: na lista "aguardando a confirmação", "Anular registro" com o motivo;
      o registro fica anulado (com o motivo), a trilha do contrato ganha o "pagamento_anulado" (caminho "dono") e o
      morador recebe o aviso "O proprietário anulou o registro …: {motivo}";
   2. DEPOIS da confirmação, o dono não anula sozinho: na lista de recibos, "Pedir anulação à Central" abre um chamado
      do registro na fila Financeiro (categoria "cobranca") — e o registro continua ativo;
   3. a equipe decide no chamado: "Anular este registro" anula, com o caminho "central" e o número do chamado na trilha;
      o botão não volta a anular (dois cliques, uma anulação).
  Simulação declarada: o contrato assinado e os dois registros (um confirmado, outro não) gravados pelo laboratório.
  Laboratório; não é prova ao vivo no site.
*/
const senha = novaSenha();
const sufixo = novoSufixo();
const dono = { email: `dono.t1800.${sufixo}@lab.vivanomads.test`, nome: "Iara Anula Prado", role: "owner" as const };
const inq = { email: `inq.t1800.${sufixo}@lab.vivanomads.test`, nome: "Caio Anula Mota", role: "tenant" as const };
const equipe = { email: `equipe.t1800.${sufixo}@lab.vivanomads.test`, nome: "Equipe Anulação" };
const ids: Record<string, string | undefined> = {};
const dia = (n: number) => new Date(Date.now() + n * 86_400_000).toISOString().slice(0, 10);
const MOTIVO_DONO = "valor lançado no bloco errado";
const MOTIVO_PEDIDO = "pagamento devolvido ao morador";
const MOTIVO_CENTRAL = "anulação pedida pelo dono, conferida pela Central";

async function abrir(browser: Browser, email: string, caminho: string): Promise<Page> {
  const p = await entrar(browser, email, senha);
  await p.setViewportSize({ width: 1280, height: 900 });
  await p.goto(caminho, { waitUntil: "domcontentloaded" });
  await p.waitForLoadState("networkidle", { timeout: 10_000 }).catch(() => {});
  return p;
}
const pagamento = async (id: string) => (await adm().from("pagamentos_bloco").select("anulado_em, anulado_motivo").eq("id", id).single()).data!;
const eventos = async () => ((await adm().from("contrato_eventos").select("tipo, autor_id, dados").eq("contrato_id", ids.contrato!).eq("tipo", "pagamento_anulado").order("criado_em")).data ?? []) as { tipo: string; autor_id: string; dados: Record<string, unknown> }[];

test.describe("T1800 — E1229: a anulação de registros pela tela, do dono à Central @E1229", () => {
  test.skip(!NO_LABORATORIO, "Só no laboratório.");
  test.describe.configure({ mode: "serial", timeout: 180_000 });

  test.beforeAll(async () => {
    ids.dono = await criarConta(dono, senha);
    ids.inq = await criarConta(inq, senha);
    ids.equipe = await criarAdmin(equipe.email, equipe.nome, senha);
    await adm().from("profiles").update({ is_teste: true }).in("id", [ids.dono, ids.inq, ids.equipe]);
    await liberarLimiteChamados();
    ids.imovel = await criarImovelPronto(ids.dono, `Studio anulação ${sufixo}`, { ativo: true, preco: 3200 });
    const agora = new Date().toISOString();
    const { data: c, error } = await adm()
      .from("contratos")
      .insert({
        property_id: ids.imovel, tenant_id: ids.inq, owner_plan: "free", faixa: "temporada", prazo_total_dias: 120, aluguel_mensal: 3200,
        tamanho_bloco_meses: 2, comissao_percent: 0.12, comissao_valor: 1536, qtd_ocupantes: 1, status: "ativo", garantia: "caucao",
        assinado_proprietario_em: agora, assinado_inquilino_em: agora,
      })
      .select("id")
      .single();
    if (error) throw error;
    ids.contrato = c.id as string;
    const { data: bl, error: eb } = await adm()
      .from("contrato_blocos")
      .insert([
        { contrato_id: ids.contrato, numero_bloco: 1, inicio: dia(-70), fim: dia(-11), meses: 2, valor: 6400, caucao: 0, status: "ativo" },
        { contrato_id: ids.contrato, numero_bloco: 2, inicio: dia(-10), fim: dia(49), meses: 2, valor: 6400, caucao: 0, status: "ativo", aceite_proprietario_em: agora, aceite_inquilino_em: agora },
      ])
      .select("id, numero_bloco");
    if (eb) throw eb;
    const b1 = bl!.find((b) => b.numero_bloco === 1)!.id as string;
    const b2 = bl!.find((b) => b.numero_bloco === 2)!.id as string;
    const { data: pgs, error: ep } = await adm()
      .from("pagamentos_bloco")
      .insert([
        { bloco_id: b1, contrato_id: ids.contrato, tipo: "aluguel", valor: 6400, data_pagamento: dia(-70), marcado_por: ids.dono, confirmado_pelo_inquilino: true, confirmado_em: agora },
        // Num insert em lote, o PostgREST põe null nas colunas que faltam numa linha: as duas levam as mesmas colunas.
        { bloco_id: b2, contrato_id: ids.contrato, tipo: "aluguel", valor: 6400, data_pagamento: dia(-10), marcado_por: ids.dono, confirmado_pelo_inquilino: false, confirmado_em: null },
      ])
      .select("id, bloco_id");
    if (ep) throw ep;
    ids.confirmado = pgs!.find((p) => p.bloco_id === b1)!.id as string;
    ids.porConfirmar = pgs!.find((p) => p.bloco_id === b2)!.id as string;
  });
  test.afterAll(async () => {
    if (ids.contrato) {
      const { data: ch } = await adm().from("chamados").select("id").eq("contexto_id", ids.contrato);
      const chs = ((ch ?? []) as { id: string }[]).map((x) => x.id);
      if (chs.length) await adm().from("chamados").delete().in("id", chs);
    }
    await apagarContas([ids.inq, ids.dono, ids.equipe]);
  });

  test("1. o dono anula ANTES da confirmação: o registro, a trilha (dono) e o aviso ao morador", async ({ browser }) => {
    test.info().annotations.push({ type: "simulação", description: "contrato assinado e registros gravados pelo laboratório; a anulação pela tela" });
    const p = await abrir(browser, dono.email, "/dashboard/contratos");
    const lista = p.locator(`[data-contrato="${ids.contrato}"]`).getByTestId("registros-por-confirmar");
    await expect(lista).toBeVisible({ timeout: 20_000 });
    const linha = lista.locator("li").filter({ hasText: /Bloco 2/ });
    await linha.getByTestId("anular-registro").click();
    await linha.getByTestId("anular-motivo").fill(MOTIVO_DONO);
    await linha.getByTestId("anular-confirmar").click();
    await expect.poll(async () => (await pagamento(ids.porConfirmar!)).anulado_motivo, { timeout: 20_000, message: "o registro fica anulado com o motivo" }).toBe(MOTIVO_DONO);
    const ev = await eventos();
    expect(ev.length).toBe(1);
    expect(ev[0].autor_id).toBe(ids.dono);
    expect(ev[0].dados).toMatchObject({ caminho: "dono", pagamento_id: ids.porConfirmar, motivo: MOTIVO_DONO });
    await expect
      .poll(async () => ((await adm().from("avisos").select("titulo").eq("usuario_id", ids.inq!).ilike("titulo", "O proprietário anulou o registro%")).data ?? []).length, { timeout: 20_000, message: "o morador recebe o aviso" })
      .toBe(1);
    expect((await pagamento(ids.confirmado!)).anulado_em, "o confirmado fica como estava").toBeNull();
    await p.context().close();
  });

  test("2. DEPOIS da confirmação: o dono pede à Central — o chamado do registro na fila Financeiro, e o registro continua ativo", async ({ browser }) => {
    const p = await abrir(browser, dono.email, "/dashboard/contratos");
    const recibo = p.locator(`[data-contrato="${ids.contrato}"]`).getByTestId("recibo-pagamento").first();
    await expect(recibo).toBeVisible({ timeout: 20_000 });
    await expect(recibo.getByTestId("anular-registro")).toHaveText("Pedir anulação à Central");
    await recibo.getByTestId("anular-registro").click();
    await recibo.getByTestId("anular-motivo").fill(MOTIVO_PEDIDO);
    await recibo.getByTestId("anular-confirmar").click();
    await expect(recibo.getByTestId("anular-feito")).toContainText(/chamado/i, { timeout: 20_000 });
    const { data: ch } = await adm().from("chamados").select("id, categoria, contexto_id").eq("contexto_id", ids.contrato!).eq("usuario_id", ids.dono!).maybeSingle();
    expect(ch, "o chamado do pedido").not.toBeNull();
    expect(ch!.categoria).toBe("cobranca");
    ids.chamado = ch!.id as string;
    expect((await pagamento(ids.confirmado!)).anulado_em, "o dono não anula sozinho um registro confirmado").toBeNull();
    await p.context().close();
  });

  test("3. a equipe anula no chamado: caminho 'central', o número do chamado na trilha, e uma só anulação", async ({ browser }) => {
    const p = await abrir(browser, equipe.email, `/admin/atendimento/${ids.chamado}`);
    const caixa = p.getByTestId("central-anular");
    await expect(caixa).toBeVisible({ timeout: 20_000 });
    await caixa.getByTestId("central-anular-motivo").fill(MOTIVO_CENTRAL);
    await caixa.getByTestId("central-anular-registro").click();
    await expect(caixa.getByTestId("central-anulado")).toBeVisible({ timeout: 20_000 });
    expect((await pagamento(ids.confirmado!)).anulado_motivo).toBe(MOTIVO_CENTRAL);
    const ev = await eventos();
    expect(ev.length, "a do dono e a da Central").toBe(2);
    expect(ev[1].autor_id).toBe(ids.equipe);
    expect(ev[1].dados).toMatchObject({ caminho: "central", pagamento_id: ids.confirmado, motivo: MOTIVO_CENTRAL });
    expect(String(ev[1].dados.chamado ?? "")).not.toBe("");
    // Outra vez: a ação recusa (já anulado) — nenhuma 2.ª anulação.
    await p.reload({ waitUntil: "domcontentloaded" });
    await p.getByTestId("central-anular-motivo").fill(MOTIVO_CENTRAL);
    await p.getByTestId("central-anular-registro").click();
    await expect(p.getByTestId("central-anular-erro")).toHaveText("Este registro já foi anulado.", { timeout: 20_000 });
    expect((await eventos()).length, "uma só anulação").toBe(2);
    await p.context().close();
  });
});
