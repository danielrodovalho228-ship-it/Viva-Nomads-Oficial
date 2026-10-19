import { test, expect, type Browser, type Page } from "@playwright/test";
import { authFile } from "../fixtures/auth";
import { hasAccount } from "../fixtures/accounts";
import { NO_LABORATORIO, adm, apagarContas, criarConta, criarImovelPronto, entrar, lerSaida, novaSenha, novoSufixo } from "../fixtures/laboratorio";

/*
  T220 — Complemento da jornada de assinatura (reteste do Muse, 19/10, contrato VN-CT-11281A61), 390 e 1280 px:
   1. o dono registra o pagamento do bloco → o morador confirma → documentos_fiscais com 1 linha e enviado_em → o
      e-mail chega nas DUAS caixas de teste com o PDF e o link de verificação → "Baixar recibo (PDF)" dos dois lados;
      antes de sair, "Recibo em preparação" (nunca a promessa vazia); o retroativo do admin emite o que ficou para trás;
   2. o pagamento aparece como "Bloco 1 (2 meses: …) — R$ 6.400 (2 × R$ 3.200)", nunca "Valor mensal de";
   3. o contrato mostra quem assinou: nome curto + papel + data e hora;
   4. "Li e concordo" continua marcado depois de recarregar a página.
*/
const SAIDA = "tests/laboratorio/saida";
const senha = novaSenha();
const sufixo = novoSufixo();
const dono = { email: `dono.t217.${sufixo}@lab.vivanomads.test`, nome: "Ana Recibo Souza", role: "owner" as const };
const inq = { email: `inq.t217.${sufixo}@lab.vivanomads.test`, nome: "Iara Recibo Jornada", role: "tenant" as const };
const ids: Record<string, string | undefined> = {};
const dia = (n: number) => new Date(Date.now() + n * 86_400_000).toISOString().slice(0, 10);
const ddmm = (iso: string) => `${iso.slice(8, 10)}/${iso.slice(5, 7)}`;
const ROTULO = () => `Bloco 1 (2 meses: ${ddmm(dia(0))} a ${ddmm(dia(59))}) — R$ 6.400 (2 × R$ 3.200)`;

async function contrato(assinado: boolean): Promise<string> {
  const agora = new Date().toISOString();
  const { data, error } = await adm()
    .from("contratos")
    .insert({
      property_id: ids.imovel,
      tenant_id: ids.inq,
      owner_plan: "free",
      faixa: "temporada",
      prazo_total_dias: 60,
      aluguel_mensal: 3200,
      tamanho_bloco_meses: 2,
      comissao_percent: 0.12,
      comissao_valor: 768,
      qtd_ocupantes: 1,
      status: "ativo",
      garantia: "caucao",
      ...(assinado ? { assinado_proprietario_em: agora, assinado_inquilino_em: agora } : {}),
    })
    .select("id")
    .single();
  if (error) throw error;
  const { error: eB } = await adm()
    .from("contrato_blocos")
    .insert({ contrato_id: data.id, numero_bloco: 1, inicio: dia(0), fim: dia(59), meses: 2, valor: 6400, caucao: 3200, status: "ativo" });
  if (eB) throw eB;
  return data.id as string;
}

async function abrir(browser: Browser, email: string, largura: number): Promise<Page> {
  const p = await entrar(browser, email, senha);
  await p.setViewportSize({ width: largura, height: largura === 390 ? 844 : 900 });
  return p;
}

async function semRolagemLateral(page: Page) {
  expect(await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth)).toBeLessThanOrEqual(1);
}

test.describe("T220 — recibo, rótulo do bloco, nomes de quem assinou e 'Li e concordo' (jornada de assinatura)", () => {
  test.skip(!NO_LABORATORIO, "Só no laboratório.");
  test.describe.configure({ mode: "serial" });
  test.use({ actionTimeout: 15_000, navigationTimeout: 30_000 });

  test.beforeAll(async () => {
    ids.dono = await criarConta(dono, senha);
    ids.inq = await criarConta(inq, senha);
    await adm().from("profiles").update({ is_teste: true }).in("id", [ids.dono, ids.inq]);
    ids.imovel = await criarImovelPronto(ids.dono, `Studio recibo ${sufixo}`, { ativo: true, preco: 3200 });
    ids.contrato = await contrato(true);
  });

  test.afterAll(async () => {
    const { data: cs } = await adm().from("contratos").select("id").eq("property_id", ids.imovel!);
    const cids = ((cs ?? []) as { id: string }[]).map((c) => c.id);
    if (cids.length) {
      await adm().from("documentos_falhas").delete().in("pagamento_id", ((await adm().from("pagamentos_bloco").select("id").in("contrato_id", cids)).data ?? []).map((p) => p.id as string));
      await adm().from("documentos_fiscais").delete().in("contrato_id", cids);
      await adm().from("pagamentos_bloco").delete().in("contrato_id", cids);
      await adm().from("contrato_blocos").delete().in("contrato_id", cids);
      await adm().from("contratos").delete().in("id", cids);
    }
    await apagarContas([ids.inq, ids.dono]);
  });

  test("1/2. 1280 + 390 — registrar → confirmar → recibo nas duas caixas, com PDF e verificação; 'Baixar recibo' dos dois lados", async ({ browser }) => {
    test.setTimeout(180_000);
    // O dono registra o pagamento do bloco 1 pela tela.
    const d = await abrir(browser, dono.email, 1280);
    await d.goto("/dashboard/contratos", { waitUntil: "domcontentloaded" });
    await d.getByRole("button", { name: /Registrar recebimento/ }).first().click();
    await d.getByRole("button", { name: "Confirmar recebimento" }).click();
    await expect.poll(async () => (await adm().from("pagamentos_bloco").select("id").eq("contrato_id", ids.contrato!)).data?.length ?? 0, { timeout: 20_000 }).toBe(1);
    const { data: pg } = await adm().from("pagamentos_bloco").select("id, valor").eq("contrato_id", ids.contrato!).single();
    ids.pagamento = pg!.id as string;
    expect(Number(pg!.valor)).toBe(6400);

    // O morador vê o rótulo do bloco e a promessa certa; confirma.
    const saidaAntes = (await lerSaida()).length;
    const t = await abrir(browser, inq.email, 390);
    await t.goto("/dashboard/locacoes", { waitUntil: "domcontentloaded" });
    const confirmar = t.getByTestId("confirmar-pagamentos");
    await expect(confirmar).toContainText(ROTULO(), { timeout: 20_000 });
    await expect(confirmar).not.toContainText("Valor mensal de");
    await expect(confirmar).toContainText("Ao confirmar, o recibo em PDF fica disponível aqui e vai por e-mail para você e para o proprietário.");
    await semRolagemLateral(t);
    await t.screenshot({ path: `${SAIDA}/t220-confirmar-390.png`, fullPage: true });
    await confirmar.getByRole("button", { name: /Confirmar/ }).click();

    // documentos_fiscais: 1 linha, enviada.
    await expect
      .poll(async () => (await adm().from("documentos_fiscais").select("id, enviado_em").eq("pagamento_id", ids.pagamento!)).data ?? [], { timeout: 30_000 })
      .toHaveLength(1);
    const { data: doc } = await adm().from("documentos_fiscais").select("id, numero, enviado_em, locador_doc").eq("pagamento_id", ids.pagamento!).single();
    expect(doc!.enviado_em).not.toBeNull();
    ids.doc = doc!.id as string;
    // E-mail nas duas caixas de teste, com o PDF anexo e o link de verificação.
    const novos = (await lerSaida()).slice(saidaAntes).filter((l) => String(l.assunto ?? "").includes(String(doc!.numero)));
    for (const email of [dono.email, inq.email]) {
      const m = novos.find((l) => l.para === email);
      expect(m, `e-mail do recibo para ${email}`).toBeTruthy();
      expect(Number(m!.anexos)).toBeGreaterThanOrEqual(1);
      expect(String(m!.corpo)).toContain("/conferir/");
    }
    expect((await adm().from("documentos_falhas").select("id").eq("pagamento_id", ids.pagamento!).is("resolvido_em", null)).data ?? []).toHaveLength(0);

    // "Baixar recibo (PDF)" dos dois lados, com o mesmo rótulo; o link entrega o PDF (redirecionamento assinado).
    await t.reload({ waitUntil: "domcontentloaded" });
    const reciboT = t.locator('[data-testid="recibo-pagamento"][data-emitido="sim"]');
    await expect(reciboT).toContainText(ROTULO(), { timeout: 20_000 });
    await expect(reciboT.getByTestId("baixar-recibo")).toHaveText("Baixar recibo (PDF)");
    const resT = await t.request.get(`/api/documentos/${ids.doc}`, { maxRedirects: 0 });
    expect(resT.status()).toBe(302);
    await t.screenshot({ path: `${SAIDA}/t220-recibo-morador-390.png`, fullPage: true });
    await t.context().close();

    await d.goto("/dashboard/contratos", { waitUntil: "domcontentloaded" });
    const reciboD = d.locator('[data-testid="recibo-pagamento"][data-emitido="sim"]');
    await expect(reciboD).toContainText(ROTULO(), { timeout: 20_000 });
    await expect(reciboD.getByTestId("baixar-recibo")).toBeVisible();
    expect((await d.request.get(`/api/documentos/${ids.doc}`, { maxRedirects: 0 })).status()).toBe(302);
    await semRolagemLateral(d);
    await d.screenshot({ path: `${SAIDA}/t220-recibo-dono-1280.png`, fullPage: true });
    await d.context().close();
  });

  test.describe("admin", () => {
    test.skip(!hasAccount("admin"), "conta de admin do laboratório não configurada");
    test.use({ storageState: authFile("admin") });
    test("1c/1d. 1280 — pagamento confirmado sem recibo (como os de 18 e 19/10) → 'Recibo em preparação' → admin 'Emitir os pendentes' → recibo", async ({ page, browser }) => {
      test.setTimeout(150_000);
      // Um pagamento confirmado que ficou sem documento (o que aconteceu antes desta correção).
      const { data: bloco } = await adm().from("contrato_blocos").select("id").eq("contrato_id", ids.contrato!).single();
      const { data: pg, error } = await adm()
        .from("pagamentos_bloco")
        .insert({ bloco_id: bloco!.id, contrato_id: ids.contrato, tipo: "caucao", valor: 3200, forma: "pix", data_pagamento: dia(0), marcado_por: ids.dono, confirmado_pelo_inquilino: true, confirmado_em: new Date().toISOString() })
        .select("id")
        .single();
      if (error) throw error;
      ids.pendente = pg!.id as string;
      const t = await abrir(browser, inq.email, 1280);
      await t.goto("/dashboard/locacoes", { waitUntil: "domcontentloaded" });
      await expect(t.locator('[data-testid="recibo-pagamento"][data-emitido="nao"]')).toContainText("Recibo em preparação", { timeout: 20_000 });

      await page.setViewportSize({ width: 1280, height: 900 });
      await page.goto("/admin/documentos", { waitUntil: "domcontentloaded" });
      const fila = page.getByTestId("documentos-falhas");
      await expect(fila).toContainText(/pagamentos? confirmados? (está|estão) sem recibo/);
      await fila.getByTestId("documentos-emitir-pendentes").click();
      await expect(page.getByTestId("documentos-falhas-msg")).toContainText(/\d+ emitidos/, { timeout: 30_000 });
      await expect.poll(async () => (await adm().from("documentos_fiscais").select("id").eq("pagamento_id", ids.pendente!)).data?.length ?? 0, { timeout: 20_000 }).toBe(1);
      await page.screenshot({ path: `${SAIDA}/t220-admin-pendentes-1280.png`, fullPage: true });
      await t.reload({ waitUntil: "domcontentloaded" });
      await expect(t.locator('[data-testid="recibo-pagamento"][data-emitido="nao"]')).toHaveCount(0, { timeout: 20_000 });
      await t.context().close();
    });
  });

  for (const largura of [390, 1280]) {
    test(`3. ${largura} — o contrato mostra quem assinou: nome curto + papel + data e hora`, async ({ browser }) => {
      test.setTimeout(90_000);
      const t = await abrir(browser, inq.email, largura);
      await t.goto(`/dashboard/locacoes/${ids.contrato}`, { waitUntil: "domcontentloaded" });
      const aviso = t.getByTestId("contrato-aviso-assinatura");
      await expect(aviso).toContainText(/Ana S\. \(proprietário\) assinou em \d{2}\/\d{2}\/\d{4} às \d{2}:\d{2}/);
      await expect(aviso).toContainText(/Iara J\. \(inquilino\) assinou em \d{2}\/\d{2}\/\d{4} às \d{2}:\d{2}/);
      expect(await aviso.innerText()).not.toMatch(/@|\d{3}\.\d{3}\.\d{3}-\d{2}/);
      await semRolagemLateral(t);
      await t.context().close();
    });
  }

  for (const largura of [390, 1280]) {
    test(`3/4. ${largura} — só o dono assinou: 'falta você'; 'Li e concordo' continua marcado depois de recarregar`, async ({ browser }) => {
      test.setTimeout(90_000);
      const id = await contrato(false);
      await adm().from("contratos").update({ assinado_proprietario_em: new Date().toISOString() }).eq("id", id);
      const t = await abrir(browser, inq.email, largura);
      await t.goto(`/dashboard/locacoes/${id}`, { waitUntil: "domcontentloaded" });
      await expect(t.getByTestId("contrato-aviso-assinatura")).toContainText(/Ana S\. \(proprietário\) assinou em .+ · falta você/);
      const aceite = t.getByTestId("assinar-aceite");
      await aceite.check();
      await t.reload({ waitUntil: "domcontentloaded" });
      await expect(t.getByTestId("assinar-aceite")).toBeChecked({ timeout: 15_000 });
      await t.screenshot({ path: `${SAIDA}/t220-li-e-concordo-${largura}.png`, fullPage: true });
      await t.context().close();
    });
  }
});
