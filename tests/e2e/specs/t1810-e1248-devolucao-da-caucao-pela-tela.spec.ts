import { test, expect, type Browser, type Page } from "@playwright/test";
import { NO_LABORATORIO, adm, apagarContas, criarConta, criarImovelPronto, entrar, liberarLimiteChamados, novaSenha, novoSufixo, pdfQueAbre } from "../fixtures/laboratorio";
import { fimDoPrazoDeResposta, horaAnunciada, linhaDoDonoNaDisputa } from "../../../src/lib/caucao/devolucao-maquina";

/*
  T1810 — E1248 PR 1 (ESPEC-E1248 v11; ORDENS-DUET 1355 e 1357): a máquina da devolução da caução pela TELA.
   1. o dono registra a devolução: o acerto guarda a hora do aviso e o morador recebe o aviso próprio (T1);
   2. o morador vê a hora do fim do prazo, do mesmo relógio do aviso (M13); contestar sem motivo é recusado (M6); com o
      motivo, a devolução fica contestada e o chamado nasce (M7);
   3. M24: com a disputa aberta, o dono lê só "contestada pelo morador" e a linha nova, sem o botão de registrar; o
      aviso dele leva a esta tela ("Ver a caução"); ele anexa o comprovante (M27);
   4. M28: o comprovante lê-se pelo link assinado do dono e do morador; o link de outra pessoa é recusado; o bucket
      não tem link público;
   5. M25: depois de um "não vale" da equipe (gravado pelo laboratório), o sufixo "— fale pela Central de Ajuda" volta
      e o dono pode registrar outra devolução.
  Simulação declarada: o contrato encerrado e a caução confirmada gravados pelo laboratório; a decisão da equipe no
  caso 5 também (o botão da equipe prova-se na t2157). Laboratório; não é prova ao vivo no site.
*/
const senha = novaSenha();
const sufixo = novoSufixo();
const dono = { email: `dono.t1810.${sufixo}@lab.vivanomads.test`, nome: "Rita Devolve Lima", role: "owner" as const };
const inq = { email: `inq.t1810.${sufixo}@lab.vivanomads.test`, nome: "Davi Recebe Costa", role: "tenant" as const };
const outra = { email: `outra.t1810.${sufixo}@lab.vivanomads.test`, nome: "Lia Outra Paz", role: "tenant" as const };
const ids: Record<string, string | undefined> = {};
const dia = (n: number) => new Date(Date.now() + n * 86_400_000).toISOString().slice(0, 10);
const MOTIVO = "O valor não chegou à minha conta.";

async function abrir(browser: Browser, email: string, caminho: string): Promise<Page> {
  const p = await entrar(browser, email, senha);
  await p.setViewportSize({ width: 1280, height: 900 });
  await p.goto(caminho, { waitUntil: "domcontentloaded" });
  await p.waitForLoadState("networkidle", { timeout: 10_000 }).catch(() => {});
  return p;
}
const acerto = async () =>
  (await adm().from("caucao_acertos").select("id, status, aviso_em, contestacao_motivo, chamado_id, comprovante_path, comprovante_pedido_em").eq("contrato_id", ids.contrato!).order("created_at", { ascending: false }).limit(1).maybeSingle()).data;

test.describe("T1810 — E1248: a devolução da caução pela tela, do registro à disputa @E1248", () => {
  test.skip(!NO_LABORATORIO, "Só no laboratório.");
  test.describe.configure({ mode: "serial", timeout: 180_000 });

  test.beforeAll(async () => {
    ids.dono = await criarConta(dono, senha);
    ids.inq = await criarConta(inq, senha);
    ids.outra = await criarConta(outra, senha);
    await adm().from("profiles").update({ is_teste: true }).in("id", [ids.dono, ids.inq, ids.outra]);
    await liberarLimiteChamados();
    ids.imovel = await criarImovelPronto(ids.dono, `Studio devolução ${sufixo}`, { ativo: true, preco: 3200 });
    const agora = new Date().toISOString();
    const { data: c, error } = await adm()
      .from("contratos")
      .insert({
        property_id: ids.imovel, tenant_id: ids.inq, owner_plan: "free", faixa: "temporada", prazo_total_dias: 60, aluguel_mensal: 3200,
        tamanho_bloco_meses: 2, comissao_percent: 0.12, comissao_valor: 768, qtd_ocupantes: 1, status: "encerrado_sem_renovacao", garantia: "caucao",
        assinado_proprietario_em: agora, assinado_inquilino_em: agora,
      })
      .select("id")
      .single();
    if (error) throw error;
    ids.contrato = c.id as string;
    const { data: bl, error: eb } = await adm()
      .from("contrato_blocos")
      .insert({ contrato_id: ids.contrato, numero_bloco: 1, inicio: dia(-61), fim: dia(-2), meses: 2, valor: 6400, caucao: 3200, status: "encerrado" })
      .select("id")
      .single();
    if (eb) throw eb;
    const { error: ep } = await adm()
      .from("pagamentos_bloco")
      .insert({ bloco_id: bl!.id, contrato_id: ids.contrato, tipo: "caucao", valor: 3200, data_pagamento: dia(-61), marcado_por: ids.dono, confirmado_pelo_inquilino: true, confirmado_em: agora });
    if (ep) throw ep;
  });
  test.afterAll(async () => {
    if (ids.contrato) {
      const { data: ch } = await adm().from("chamados").select("id").eq("contexto_id", ids.contrato);
      const chs = ((ch ?? []) as { id: string }[]).map((x) => x.id);
      if (chs.length) await adm().from("chamados").delete().in("id", chs);
    }
    await apagarContas([ids.outra, ids.inq, ids.dono]);
  });

  test("1. T1: o dono registra a devolução; o acerto guarda a hora do aviso e o morador recebe o aviso próprio", async ({ browser }) => {
    test.info().annotations.push({ type: "simulação", description: "contrato encerrado e caução confirmada gravados pelo laboratório; o registro pela tela" });
    const p = await abrir(browser, dono.email, "/dashboard/contratos");
    const caixa = p.locator(`[data-contrato="${ids.contrato}"]`).getByTestId("devolucao-caucao");
    await caixa.getByRole("button", { name: "Registrar devolução da caução" }).click({ timeout: 20_000 });
    await caixa.getByRole("button", { name: "Registrar devolução", exact: true }).click();
    await expect.poll(async () => (await acerto())?.status, { timeout: 20_000, message: "a devolução grava" }).toBe("aguardando_confirmacao");
    expect((await acerto())?.aviso_em, "a hora do aviso").toBeTruthy();
    await expect
      .poll(async () => ((await adm().from("avisos").select("id").eq("usuario_id", ids.inq!).eq("evento", "caucao_devolucao_registrada").eq("ref_id", ids.contrato!)).data ?? []).length, { timeout: 20_000, message: "o aviso ao morador" })
      .toBe(1);
    await p.context().close();
  });

  test("2. o morador vê a hora do fim do prazo; sem motivo, recusado; com motivo, contestada e o chamado nasce", async ({ browser }) => {
    const a = await acerto();
    const p = await abrir(browser, inq.email, "/dashboard/locacoes");
    const caixa = p.getByTestId("devolucao-caucao").first();
    await expect(caixa.getByTestId("devolucao-prazo"), "M13: a mesma hora do aviso").toContainText(`Responda até ${horaAnunciada(fimDoPrazoDeResposta(String(a!.aviso_em)))}`, { timeout: 20_000 });
    await caixa.getByRole("button", { name: /Não recebi \/ discordo/ }).click();
    await caixa.getByTestId("devolucao-motivo").fill("abc");
    await caixa.getByRole("button", { name: "Enviar a contestação" }).click();
    await expect(caixa, "M6: a recusa com a mensagem").toContainText("Escreva o motivo da contestação", { timeout: 20_000 });
    expect((await acerto())?.status, "nada muda").toBe("aguardando_confirmacao");
    await caixa.getByTestId("devolucao-motivo").fill(MOTIVO);
    await caixa.getByRole("button", { name: "Enviar a contestação" }).click();
    await expect.poll(async () => (await acerto())?.status, { timeout: 20_000, message: "M7: contestada" }).toBe("desconto_contestado");
    // O estado muda primeiro; o chamado abre a seguir, na mesma ação: espera-se por ele.
    await expect.poll(async () => (await acerto())?.chamado_id ?? null, { timeout: 20_000, message: "o chamado da Central" }).not.toBeNull();
    const b = await acerto();
    expect(b?.contestacao_motivo).toBe(MOTIVO);
    expect(b?.chamado_id, "o chamado da Central").toBeTruthy();
    expect(b?.comprovante_pedido_em, "sem comprovante: o pedido ao dono").toBeTruthy();
    await p.context().close();
  });

  test("3. M24: com a disputa aberta, o dono lê só \"contestada pelo morador\" e a linha nova, sem registrar; o aviso leva aqui; ele anexa o comprovante", async ({ browser }) => {
    const { data: av } = await adm().from("avisos").select("url").eq("usuario_id", ids.dono!).eq("evento", "caucao_devolucao_contestada").eq("ref_id", ids.contrato!).single();
    // ORDEM-DUET 1359 (ajuste 1): a lista ancorada no contrato, que rola até ele e o destaca.
    expect(av?.url, "o aviso do dono abre a tela da devolução, no contrato").toBe(`/dashboard/contratos#contrato-${ids.contrato}`);
    const p = await abrir(browser, dono.email, String(av!.url));
    await expect(p.locator(`#contrato-${ids.contrato}`), "o contrato destacado").toHaveAttribute("data-destacado", "", { timeout: 20_000 });
    const caixa = p.locator(`[data-contrato="${ids.contrato}"]`).getByTestId("devolucao-caucao");
    await expect(caixa).toContainText("contestada pelo morador.", { timeout: 20_000 });
    await expect(caixa).not.toContainText("fale pela Central de Ajuda");
    await expect(caixa.getByTestId("devolucao-disputa")).toHaveText(linhaDoDonoNaDisputa());
    await expect(caixa.getByRole("button", { name: "Registrar devolução da caução" })).toHaveCount(0);
    const anexo = caixa.getByTestId("devolucao-anexar");
    await expect(anexo, "o pedido, com o prazo").toContainText("A equipe precisa do comprovante da transferência");
    await anexo.getByTestId("devolucao-anexar-arquivo").setInputFiles({ name: "comprovante.pdf", mimeType: "application/pdf", buffer: await pdfQueAbre() });
    await anexo.getByRole("button", { name: "Anexar o comprovante" }).click();
    await expect.poll(async () => (await acerto())?.comprovante_path ?? null, { timeout: 20_000, message: "M27: guardado" }).toMatch(new RegExp(`^${ids.dono}/[0-9a-f-]+\\.pdf$`));
    await expect(caixa.getByTestId("devolucao-comprovante")).toBeVisible({ timeout: 20_000 });
    await p.context().close();
  });

  test("4. M28: o dono e o morador leem o comprovante pelo link assinado; o link de outra pessoa é recusado; sem link público", async ({ browser }) => {
    const d = await abrir(browser, dono.email, "/dashboard/contratos");
    const linkDono = await d.locator(`[data-contrato="${ids.contrato}"]`).getByTestId("devolucao-comprovante").getAttribute("href", { timeout: 20_000 });
    expect(linkDono).toMatch(/^\/api\/protegido\/comprovante-devolucao\?t=/);
    const r1 = await d.request.get(linkDono!);
    expect(r1.status(), "o dono que enviou").toBe(200);
    expect(r1.headers()["content-type"]).toContain("application/pdf");
    const m = await abrir(browser, inq.email, "/dashboard/locacoes");
    const linkMorador = await m.getByTestId("devolucao-comprovante").first().getAttribute("href", { timeout: 20_000 });
    expect((await m.request.get(linkMorador!)).status(), "o morador do contrato").toBe(200);
    const o = await abrir(browser, outra.email, "/dashboard/locacoes");
    expect((await o.request.get(linkDono!)).status(), "o link é de quem está logado").toBe(403);
    await expect(o.getByTestId("devolucao-comprovante"), "outra conta não vê o comprovante").toHaveCount(0);
    const { data: pub } = adm().storage.from("conferencia").getPublicUrl(String((await acerto())!.comprovante_path));
    expect((await o.request.get(pub.publicUrl)).status(), "o bucket não tem link público").not.toBe(200);
    await d.context().close();
    await m.context().close();
    await o.context().close();
  });

  test("5. M25: depois de um \"não vale\" da equipe, o sufixo volta e o dono pode registrar outra devolução", async ({ browser }) => {
    test.info().annotations.push({ type: "simulação", description: "a decisão da equipe gravada pelo laboratório (o botão da equipe prova-se na t2157)" });
    const { error } = await adm().from("caucao_acertos").update({ central_decisao: "nao_confirmada", central_decidido_em: new Date().toISOString(), central_motivo: "O valor não foi recebido." }).eq("id", (await acerto())!.id);
    if (error) throw error;
    const p = await abrir(browser, dono.email, "/dashboard/contratos");
    const caixa = p.locator(`[data-contrato="${ids.contrato}"]`).getByTestId("devolucao-caucao");
    await expect(caixa).toContainText("contestada pelo morador — fale pela Central de Ajuda", { timeout: 20_000 });
    await expect(caixa.getByTestId("devolucao-disputa")).toHaveCount(0);
    await expect(caixa.getByRole("button", { name: "Registrar devolução da caução" })).toBeVisible();
    await p.context().close();
  });
});
