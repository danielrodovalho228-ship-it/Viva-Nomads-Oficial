import { test, expect, type Browser, type Page } from "@playwright/test";
import { NO_LABORATORIO, adm, apagarContas, criarConta, criarImovelPronto, entrar, lerSaida, novaSenha, novoSufixo } from "../fixtures/laboratorio";
import { formatarDiaCurto } from "../../../src/lib/estadia-linha-tempo";

/*
  T1731 — E1089 @E1089 (prompt do coordenador, ORDEM-DUET-448): uma só data de saída em todas as telas.
  O caso da prova (ORC-2026-0019): a proposta dizia saída 24/12 (31 dias) e o contrato, o e-mail e a estadia diziam 23/12
  — a última noite gravada nos blocos, impressa como se fosse a saída.
  A mesma sequência, pela tela, com contas de teste: o dono envia a proposta de 31 dias, a moradora aceita, o dono gera o
  contrato, as duas partes assinam (gravado no banco do laboratório, como na t1720). A MESMA data de saída (entrada + 31
  dias) aparece:
   1. na página da proposta ("Saída");
   2. no e-mail "contrato pronto" ("Entrada … · Saída … · 31 diárias") — e nunca a última noite como saída;
   3. na página do contrato (etapa "Saída" da linha do tempo);
   4. na página da estadia ("Saída: …" e a marca "Saída" do calendário).
   5. No DIA DA SAÍDA o ciclo diário do banco já fechou o contrato (às 00h). Mesmo assim, o dono vê "Sai hoje" no Início e
      a mensagem programada "No dia da saída" sai (não é cancelada como "contrato encerrado").
  O banco não muda: o último bloco continua a acabar na última noite (um dia antes da saída).
  Laboratório; não é prova ao vivo no site.
*/
const SAIDA_PRINTS = "tests/laboratorio/saida";
const senha = novaSenha();
const sufixo = novoSufixo();
const dono = { email: `dono.t1731.${sufixo}@lab.vivanomads.test`, nome: "Dalva Saida Sobrenome", role: "owner" as const };
const inq = { email: `inq.t1731.${sufixo}@lab.vivanomads.test`, nome: "Ines Saida Sobrenome", role: "tenant" as const };
const ids: { dono?: string; inq?: string; imovel?: string; lead?: string; proposta?: string; contrato?: string } = {};

const emDias = (d: number) => new Date(Date.now() + d * 86_400_000).toISOString().slice(0, 10);
const br = (iso: string) => `${iso.slice(8, 10)}/${iso.slice(5, 7)}/${iso.slice(0, 4)}`;
// 31 dias, como na prova: a saída é entrada + 31; a última noite, um dia antes.
const DIAS = 31;
const ENTRADA = emDias(30);
const SAIDA = emDias(30 + DIAS);
const ULTIMA_NOITE = emDias(30 + DIAS - 1);

const statusDa = async (proposta: string) => (await adm().from("propostas").select("status").eq("id", proposta).single()).data?.status as string;

/** O dono atravessa o Fechamento e clica "Gerar contrato" (os mesmos passos da t863). */
async function gerarContratoPelaTela(page: Page) {
  const continuar = page.getByRole("button", { name: /continuar/i });
  const verificar = page.getByRole("button", { name: /verificar identidade/i });
  if (await verificar.isVisible().catch(() => false)) await verificar.click();
  await expect(continuar).toBeEnabled({ timeout: 20_000 });
  await continuar.click();
  await page.getByRole("radio").and(page.locator(":not([disabled])")).first().click();
  await page.getByTestId("ciente-protecao").check({ timeout: 15_000 });
  await continuar.click();
  await expect(page.getByRole("heading", { name: /serviços adicionais/i })).toBeVisible({ timeout: 15_000 });
  await continuar.click();
  await page.getByRole("button", { name: /Seguir sem seguro patrimonial/ }).click();
  await continuar.click();
  await expect(page.getByTestId("marca-minuta")).toBeVisible({ timeout: 15_000 });
  await page.getByTestId("fechamento-gerar-contrato").click();
  await expect(page.getByTestId("fechamento-abrir-contrato")).toBeVisible({ timeout: 30_000 });
}
async function comoDono(browser: Browser, caminho: string, largura: 390 | 1280 = 390): Promise<Page> {
  const page = await entrar(browser, dono.email, senha);
  await page.setViewportSize({ width: largura, height: largura === 390 ? 844 : 900 });
  await page.goto(caminho, { waitUntil: "domcontentloaded" });
  return page;
}

test.describe("T1731 — E1089: a mesma data de saída na proposta, no e-mail, no contrato e na estadia @E1089", () => {
  test.skip(!NO_LABORATORIO, "Só no laboratório.");
  test.describe.configure({ mode: "serial", timeout: 240_000 });

  test.beforeAll(async () => {
    ids.dono = await criarConta(dono, senha);
    ids.inq = await criarConta(inq, senha);
    // Contas de teste: contrato e cobrança saem no modo TESTE (nada vai à assinatura digital nem ao banco de cobrança).
    await adm().from("profiles").update({ is_teste: true }).in("id", [ids.dono, ids.inq]);
    ids.imovel = await criarImovelPronto(ids.dono, `[TESTE QA] Uma saida ${sufixo}`, { ativo: true, preco: 2800 });
    const { error: e1 } = await adm().from("properties").update({ min_period_days: 30, max_period_days: 180, checkout_before: "11:00" }).eq("id", ids.imovel);
    if (e1) throw e1;
    const { data, error } = await adm()
      .from("leads")
      .insert({ owner_id: ids.dono, tenant_id: ids.inq, property_id: ids.imovel, status: "new", inicio_desejado: ENTRADA, fim_desejado: SAIDA })
      .select("id")
      .single();
    if (error) throw error;
    ids.lead = data.id as string;
    for (const tipo of ["identidade", "vinculo"]) {
      const u = () => crypto.randomUUID();
      const { error: e2 } = await adm().from("documentos_inquilino").insert({ lead_id: ids.lead, tenant_id: ids.inq, tipo, caminho: `${u()}/${u()}/${u()}.pdf`, hash_sha256: "a".repeat(64) });
      if (e2) throw e2;
    }
  });

  test.afterAll(async () => {
    if (ids.lead) {
      const { data: cs } = await adm().from("contratos").select("id").eq("lead_id", ids.lead);
      const lista = ((cs ?? []) as { id: string }[]).map((c) => c.id);
      if (lista.length) {
        await adm().from("pagamentos_bloco").delete().in("contrato_id", lista);
        await adm().from("contrato_blocos").delete().in("contrato_id", lista);
        await adm().from("contratos").delete().in("id", lista);
      }
      await adm().from("cobrancas_fechamento").delete().eq("lead_id", ids.lead);
      await adm().from("propostas").delete().eq("lead_id", ids.lead);
      await adm().from("documentos_inquilino").delete().eq("lead_id", ids.lead);
      await adm().from("leads").delete().eq("id", ids.lead);
    }
    if (ids.imovel) await adm().from("properties").delete().eq("id", ids.imovel);
    await apagarContas([ids.dono, ids.inq]);
  });

  const hojeBRT = () => new Intl.DateTimeFormat("en-CA", { timeZone: "America/Sao_Paulo" }).format(new Date());
  const somar = (d: string, n: number) => new Date(Date.parse(`${d}T00:00:00Z`) + n * 86_400_000).toISOString().slice(0, 10);

  test("1. A proposta de 31 dias diz a saída (entrada + 31)", async ({ browser }) => {
    const pd = await comoDono(browser, `/dashboard/orcamentos/nova?interessado=${ids.lead}`, 1280);
    await expect(pd.getByTestId("montagem-proposta")).toBeVisible({ timeout: 30_000 });
    await pd.getByTestId("proposta-data").fill(ENTRADA);
    await pd.getByTestId("proposta-saida").fill(SAIDA);
    await expect(pd.getByTestId("proposta-dias")).toContainText(`${DIAS} dias`);
    await pd.getByTestId("proposta-validade").selectOption("7");
    await pd.getByTestId("enviar-proposta").click();
    await pd.waitForURL(/\/dashboard\/propostas\/[0-9a-f-]{36}$/, { timeout: 30_000 });
    ids.proposta = pd.url().split("/").pop()!;
    await expect(pd.getByTestId("proposta-saida")).toContainText(br(SAIDA), { timeout: 30_000 });
    await pd.context().close();

    const pi = await entrar(browser, inq.email, senha);
    await pi.goto(`/dashboard/propostas/${ids.proposta}`, { waitUntil: "domcontentloaded" });
    await expect(pi.getByTestId("proposta-saida")).toContainText(br(SAIDA), { timeout: 30_000 });
    await pi.getByTestId("proposta-aceitar").click({ timeout: 30_000 });
    await expect.poll(() => statusDa(ids.proposta!), { timeout: 30_000 }).toBe("aceita");
    await pi.context().close();
  });

  test("2. O contrato gerado: o e-mail 'contrato pronto' diz a MESMA saída; o banco segue com a última noite", async ({ browser }) => {
    const p = await comoDono(browser, `/dashboard/fechamento?c=${ids.lead}`, 1280);
    await expect(p.getByRole("heading", { name: "Candidatura e verificação" })).toBeVisible({ timeout: 30_000 });
    await gerarContratoPelaTela(p);
    await p.context().close();
    const { data: c } = await adm().from("contratos").select("id, prazo_total_dias").eq("lead_id", ids.lead!).single();
    ids.contrato = c!.id as string;
    expect(c!.prazo_total_dias).toBe(DIAS);
    // O banco não muda: o último bloco acaba na última noite (um dia antes da saída).
    const { data: blocos } = await adm().from("contrato_blocos").select("inicio, fim").eq("contrato_id", ids.contrato).order("inicio");
    expect(String(blocos![0].inicio).slice(0, 10)).toBe(ENTRADA);
    expect(String(blocos!.at(-1)!.fim).slice(0, 10)).toBe(ULTIMA_NOITE);
    // O e-mail (morador e dono): a forma única, com a saída da proposta — nunca "a {última noite}".
    const linha = `Entrada ${br(ENTRADA)} · Saída ${br(SAIDA)} · ${DIAS} diárias`;
    await expect
      .poll(async () => (await lerSaida()).filter((m) => m.servico === "email" && String(m.assunto ?? "").includes("contrato está pronto para assinar") && JSON.stringify(m).includes(sufixo)).length, { timeout: 30_000 })
      .toBeGreaterThanOrEqual(2);
    const emails = (await lerSaida()).filter((m) => m.servico === "email" && String(m.assunto ?? "").includes("contrato está pronto para assinar") && JSON.stringify(m).includes(sufixo));
    for (const m of emails) {
      const corpo = JSON.stringify(m);
      expect(corpo, "o e-mail traz o período na forma única").toContain(linha);
      expect(corpo, "o e-mail não imprime a última noite como fim do período").not.toContain(`a ${br(ULTIMA_NOITE)}`);
    }
  });

  test("3. A página do contrato: a etapa 'Saída' é o dia da saída da proposta", async ({ browser }) => {
    const agora = new Date().toISOString();
    const { error } = await adm().from("contratos").update({ assinado_proprietario_em: agora, assinado_inquilino_em: agora }).eq("id", ids.contrato!);
    expect(error).toBeNull();
    const p = await comoDono(browser, `/dashboard/contratos/${ids.contrato}`);
    await expect(p.getByTestId("estadia-etapa-entrada")).toContainText(formatarDiaCurto(ENTRADA), { timeout: 30_000 });
    await expect(p.getByTestId("estadia-etapa-saida")).toContainText(formatarDiaCurto(SAIDA));
    await p.getByTestId("estadia-etapa-saida").scrollIntoViewIfNeeded();
    await p.screenshot({ path: `${SAIDA_PRINTS}/t1731-3-contrato-linha-do-tempo-390.png` });
    await p.context().close();
  });

  test("4. A página da estadia: 'Saída em …' com a mesma data, a 390 e a 1280 px", async ({ browser }) => {
    for (const largura of [390, 1280] as const) {
      const p = await comoDono(browser, `/dashboard/estadia/${ids.contrato}`, largura);
      // E1230 (ORDEM-DUET 1340; asserção alterada): a saída mostra-se sem hora, com a mesma data.
      await expect(p.getByTestId("estadia-saida")).toHaveText(`Saída em ${br(SAIDA)}, horário a combinar com o proprietário`, { timeout: 30_000 });
      await expect(p.getByTestId("estadia-entrada")).toContainText(br(ENTRADA));
      expect(await p.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth), "sem rolagem lateral").toBeLessThanOrEqual(1);
      await p.screenshot({ path: `${SAIDA_PRINTS}/t1731-4-estadia-${largura}.png`, fullPage: true });
      await p.context().close();
    }
  });

  test("5. No dia da saída, com o contrato já fechado pelo ciclo diário: 'Sai hoje' no Início e a mensagem 'No dia da saída' sai", async ({ browser }) => {
    // A última noite foi ontem; a saída é hoje. O ciclo diário (00h) já passou o bloco e o contrato a "encerrado sem renovação".
    const hoje = hojeBRT();
    const agora = new Date().toISOString();
    const { error: eb } = await adm()
      .from("contrato_blocos")
      .update({ inicio: somar(hoje, -DIAS), fim: somar(hoje, -1), status: "encerrado_sem_renovacao", encerrado_em: agora })
      .eq("contrato_id", ids.contrato!);
    expect(eb).toBeNull();
    const { error: ec } = await adm().from("contratos").update({ status: "encerrado_sem_renovacao", encerrado_em: agora }).eq("id", ids.contrato!);
    expect(ec).toBeNull();

    // O dono abre o Início: "Sai hoje". E1230 (ORDEM-DUET 1340; asserção alterada): sem hora — a saída não lê o anúncio.
    const p = await comoDono(browser, "/dashboard");
    const cartao = p.getByTestId("inicio-dono-hoje").getByTestId("inicio-dono-hoje-cartao");
    await expect(cartao).toHaveCount(1, { timeout: 30_000 });
    await expect(cartao).toHaveAttribute("data-tipo", "saida");
    await expect(cartao).toContainText("Sai hoje");
    await expect(cartao).not.toContainText("até as");
    await p.getByTestId("inicio-dono-hoje").screenshot({ path: `${SAIDA_PRINTS}/t1731-5-sai-hoje-390.png` });

    // A mensagem programada "No dia da saída" (9h de Brasília de hoje) sai às 10h — não é cancelada.
    const { data: prog, error: ep } = await adm()
      .from("mensagens_programadas")
      .insert({ contrato_id: ids.contrato, owner_id: ids.dono, quando: "saida", texto: `Boa viagem! Deixe as chaves na portaria. ${sufixo}`, enviar_em: `${hoje}T12:00:00Z` })
      .select("id")
      .single();
    expect(ep).toBeNull();
    const r = await p.request.get(`/api/lab/mensagens-programadas?contrato=${ids.contrato}&agora=${encodeURIComponent(`${hoje}T13:00:00Z`)}`);
    expect(r.ok(), await r.text()).toBe(true);
    expect(await r.json()).toMatchObject({ enviadas: 1, canceladas: 0 });
    const { data: depois } = await adm().from("mensagens_programadas").select("enviada_em, cancelada_em, motivo_cancelamento").eq("id", prog!.id).single();
    expect(depois!.enviada_em, "a mensagem do dia da saída saiu").not.toBeNull();
    expect(depois!.cancelada_em).toBeNull();
    // No dia seguinte à saída, uma mensagem ainda por sair é cancelada como sempre (o contrato acabou).
    await adm().from("mensagens_programadas").update({ enviada_em: null }).eq("id", prog!.id);
    const r2 = await p.request.get(`/api/lab/mensagens-programadas?contrato=${ids.contrato}&agora=${encodeURIComponent(`${somar(hoje, 1)}T10:00:00Z`)}`);
    expect(await r2.json()).toMatchObject({ enviadas: 0, canceladas: 1 });
    await p.context().close();
  });
});
