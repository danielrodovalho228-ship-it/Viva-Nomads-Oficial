import { test, expect, type Browser, type Page } from "@playwright/test";
import { PDFDocument } from "pdf-lib";
import { authFile } from "../fixtures/auth";
import { hasAccount } from "../fixtures/accounts";
import {
  NO_LABORATORIO,
  adm,
  apagarContas,
  criarConta,
  criarImovelPronto,
  criarLead,
  liberarLimiteLogin,
  liberarLimiteLoginIp,
  novaSenha,
  novoSufixo,
  pngDeTeste,
  tornarContratoVigente,
} from "../fixtures/laboratorio";
import { textoDasPaginas } from "../../../src/lib/fiscal/pdf-texto";

/*
  T240 — Prompt 35B (conferência de entrada, pacote de provas e admin › contrato), 390 e 1280 px, laboratório:
   F1  o inquilino é barrado antes de o proprietário registrar ("…depois que a outra parte registrar…") e depois
       CONFIRMA com 0 itens próprios ("Confirmar o registro do proprietário. Seus próprios itens são opcionais.");
       o proprietário confirma em seguida → "Confirmada pelas duas partes" e a edição trava.
   F2  seção da conferência e linha do tempo mostram o MESMO instante ("até DD/MM às 15:00, horário de Brasília",
       e o mesmo data-prazo) com o navegador em America/Chicago e em America/Sao_Paulo.
   F3  dois itens seguidos: o campo da foto zera depois do 1º; o 2º não reaproveita a foto (banco: foto_path nulo).
   F4  o pacote de provas tem 2+ páginas e o TEXTO extraído do PDF traz "confirmou a conferência de entrada" das
       duas partes, a Caução anulada marcada uma vez e "Situação: Em vigência".
   F5  admin abre /admin/contratos/[id] (200) e vê "Confirmada pelas duas partes" com as duas respostas; baixa o
       pacote "Gerado pela equipe Viva Nomads"; o link "Abrir o contrato" da lista não dá 404; não admin → 404.
  Nenhum window.confirm/alert.
*/
const SAIDA = "tests/laboratorio/saida";
const senha = novaSenha();
const sufixo = novoSufixo();
const dono = { email: `dono.t240.${sufixo}@lab.vivanomads.test`, nome: "Rita Conferência Prado", role: "owner" as const };
const inquilino = { email: `inq.t240.${sufixo}@lab.vivanomads.test`, nome: "Davi Conferência Lopes", role: "tenant" as const };
const titulo = `Studio T240 ${sufixo}`;
const ids: Record<string, string | undefined> = {};
const SALA = `Sala ${sufixo}`;
const COZINHA = `Cozinha ${sufixo}`;

function semDialogo(page: Page) {
  page.on("dialog", (d) => {
    throw new Error(`diálogo do navegador não permitido: ${d.type()} ${d.message()}`);
  });
}

async function semRolagemLateral(page: Page) {
  expect(await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth)).toBeLessThanOrEqual(1);
}

/** Login pela tela num contexto com o fuso pedido (o `entrar` do laboratório usa o fuso da máquina). */
async function entrarNoFuso(browser: Browser, email: string, largura: number, timezoneId = "America/Sao_Paulo"): Promise<Page> {
  await liberarLimiteLogin(email);
  await liberarLimiteLoginIp();
  const ctx = await browser.newContext({ viewport: { width: largura, height: largura === 390 ? 844 : 900 }, timezoneId });
  const page = await ctx.newPage();
  semDialogo(page);
  await page.goto("/auth?senha=1", { waitUntil: "domcontentloaded" });
  await page.waitForLoadState("networkidle", { timeout: 10_000 }).catch(() => {});
  await page.locator('input[name="email"], input[type="email"]').first().fill(email);
  await page.locator('input[name="password"], input[type="password"]').first().fill(senha);
  await page.locator("form").getByRole("button", { name: /^entrar$/i }).click();
  await page.waitForURL(/\/dashboard/, { timeout: 20_000 });
  await page.evaluate(() => localStorage.setItem("vivanomads-role-asked", "1"));
  return page;
}

async function admin(browser: Browser, largura: number, timezoneId = "America/Sao_Paulo"): Promise<Page> {
  const ctx = await browser.newContext({ storageState: authFile("admin"), viewport: { width: largura, height: 900 }, timezoneId });
  const page = await ctx.newPage();
  semDialogo(page);
  return page;
}

/** O instante esperado: dia de início às 15:00 em Brasília (UTC−3, sem horário de verão desde 2019) + 48 h. */
function prazoEsperado(inicio: string): { iso: string; texto: string } {
  const [a, m, d] = inicio.split("-").map(Number);
  const t = new Date(Date.UTC(a, m - 1, d, 15 + 3, 0) + 48 * 3_600_000);
  const brt = new Date(t.getTime() - 3 * 3_600_000);
  const z = (n: number) => String(n).padStart(2, "0");
  return { iso: t.toISOString(), texto: `até ${z(brt.getUTCDate())}/${z(brt.getUTCMonth() + 1)} às 15:00, horário de Brasília` };
}

async function conferenciaId(): Promise<string | null> {
  const { data } = await adm().from("conferencias").select("id").eq("contrato_id", ids.contrato!).eq("tipo", "entrada").maybeSingle();
  return (data?.id as string | undefined) ?? null;
}

test.describe("T240 — conferência de entrada (F1–F3), pacote de provas (F4) e admin › contrato (F5)", () => {
  test.skip(!NO_LABORATORIO, "Só no laboratório (banco local + chave de serviço).");
  test.describe.configure({ mode: "serial", timeout: 180_000 });

  test.beforeAll(async () => {
    ids.dono = await criarConta(dono, senha);
    ids.inquilino = await criarConta(inquilino, senha);
    ids.imovel = await criarImovelPronto(ids.dono, titulo, { ativo: true });
    await adm().from("properties").update({ checkin_after: "15:00", checkout_before: "11:00" }).eq("id", ids.imovel);
    ids.lead = await criarLead(ids.dono, ids.inquilino, ids.imovel, true);
    const { data, error } = await adm()
      .from("contratos")
      .insert({
        property_id: ids.imovel,
        tenant_id: ids.inquilino,
        lead_id: ids.lead,
        owner_plan: "essential",
        faixa: "temporada",
        prazo_total_dias: 60,
        aluguel_mensal: 3200,
        tamanho_bloco_meses: 2,
        comissao_percent: 0.08,
        comissao_valor: 512,
        qtd_ocupantes: 1,
        status: "ativo",
        garantia: "caucao",
      })
      .select("id")
      .single();
    if (error) throw error;
    ids.contrato = data.id as string;
    await tornarContratoVigente(ids.contrato, ids.dono, 3200);
    // (i) Caução marcada em duplicidade e anulada: aparece uma vez, com a marca, e fica fora dos totais.
    const { data: bloco } = await adm().from("contrato_blocos").select("id, inicio").eq("contrato_id", ids.contrato).eq("numero_bloco", 1).single();
    ids.inicio = String(bloco!.inicio);
    const hoje = ids.inicio;
    const { error: eCaucao } = await adm().from("pagamentos_bloco").insert([
      { bloco_id: null, contrato_id: ids.contrato, tipo: "caucao", valor: 3200, data_pagamento: hoje, marcado_por: ids.dono, confirmado_pelo_inquilino: true, confirmado_em: new Date().toISOString() },
      { bloco_id: null, contrato_id: ids.contrato, tipo: "caucao", valor: 3200, data_pagamento: hoje, marcado_por: ids.dono, confirmado_pelo_inquilino: false, anulado_em: new Date().toISOString(), anulado_motivo: "registro em duplicidade" },
    ]);
    if (eCaucao) throw eCaucao;
  });

  test.afterAll(async () => {
    if (ids.contrato) {
      const { data: confs } = await adm().from("conferencias").select("id").eq("contrato_id", ids.contrato);
      const confIds = (confs ?? []).map((c) => c.id as string);
      if (confIds.length) {
        for (const t of ["conferencia_laudos", "conferencia_respostas", "conferencia_itens"]) await adm().from(t).delete().in("conferencia_id", confIds);
        await adm().from("conferencias").delete().in("id", confIds);
      }
      await adm().from("pagamentos_bloco").delete().eq("contrato_id", ids.contrato);
      await adm().from("contrato_blocos").delete().eq("contrato_id", ids.contrato);
      await adm().from("contratos").delete().eq("id", ids.contrato);
    }
    if (ids.lead) await adm().from("leads").delete().eq("id", ids.lead);
    await apagarContas([ids.dono, ids.inquilino]);
  });

  test("F1 (390 px): antes de o proprietário registrar, o inquilino não responde — mensagem atual, sem botão", async ({ browser }) => {
    const page = await entrarNoFuso(browser, inquilino.email, 390);
    await page.goto(`/dashboard/locacoes/${ids.contrato}`, { waitUntil: "domcontentloaded" });
    const entrada = page.getByTestId("conferencia-entrada");
    await expect(entrada).toBeVisible({ timeout: 20_000 });
    await expect(page.getByTestId("conferencia-entrada-aguardando-registro")).toHaveText("Você só pode responder depois que a outra parte registrar ao menos um item.");
    await expect(page.getByTestId("conferencia-entrada-confirmar")).toHaveCount(0);
    await semRolagemLateral(page);
    await page.context().close();
  });

  test("F3 (390 px): dois itens seguidos — o campo da foto zera e o 2º item não reaproveita a foto do 1º", async ({ browser }) => {
    const page = await entrarNoFuso(browser, dono.email, 390);
    await page.goto(`/dashboard/contratos/${ids.contrato}`, { waitUntil: "domcontentloaded" });
    const form = page.getByTestId("conferencia-entrada-form");
    await expect(form).toBeVisible({ timeout: 20_000 });
    await page.waitForLoadState("networkidle").catch(() => undefined);

    await form.getByLabel("Cômodo", { exact: true }).fill(SALA);
    await form.getByLabel("Itens e estado do cômodo").fill("Sofá cinza sem manchas, TV na parede.");
    await form.getByLabel("Foto do cômodo").setInputFiles({ name: "sala.png", mimeType: "image/png", buffer: pngDeTeste(4) });
    await expect(page.getByTestId("conferencia-entrada-foto-escolhida")).toContainText("sala.png");
    await form.getByRole("button", { name: "Adicionar item" }).click();
    const itens = page.getByTestId("conferencia-entrada-itens");
    await expect(page.getByTestId("conferencia-erro")).toHaveCount(0);
    await expect(itens).toContainText(SALA, { timeout: 20_000 });
    // o campo foi recriado vazio e o rótulo do arquivo sumiu
    await expect(page.getByTestId("conferencia-entrada-foto-escolhida")).toHaveCount(0);
    expect(await form.getByLabel("Foto do cômodo").evaluate((el) => (el as HTMLInputElement).files?.length ?? 0)).toBe(0);

    await form.getByLabel("Cômodo", { exact: true }).fill(COZINHA);
    await form.getByLabel("Itens e estado do cômodo").fill("Geladeira e fogão funcionando.");
    await form.getByRole("button", { name: "Adicionar item" }).click();
    await expect(itens).toContainText(COZINHA, { timeout: 20_000 });
    await expect(itens.getByRole("img", { name: `Foto: ${SALA}` })).toBeVisible();
    await expect(itens.getByRole("img", { name: `Foto: ${COZINHA}` })).toHaveCount(0);

    const confId = await conferenciaId();
    const { data: linhas } = await adm().from("conferencia_itens").select("comodo, foto_path").eq("conferencia_id", confId!);
    const porComodo = Object.fromEntries((linhas ?? []).map((l) => [l.comodo, l.foto_path]));
    expect(porComodo[SALA]).toBeTruthy();
    expect(porComodo[COZINHA]).toBeNull();
    // o proprietário também espera o inquilino (que não registrou nada)
    await expect(page.getByTestId("conferencia-entrada-aguardando-registro")).toBeVisible();
    await semRolagemLateral(page);
    await page.screenshot({ path: `${SAIDA}/t240-f3-dois-itens-390.png`, fullPage: true });
    await page.context().close();

    // Mais itens do proprietário (pelo banco) para o pacote passar de uma página.
    const extras = Array.from({ length: 30 }, (_, i) => ({
      conferencia_id: confId,
      autor_id: ids.dono,
      parte: "proprietario",
      comodo: `Cômodo extra ${i + 1}`,
      descricao: `Item ${i + 1}: paredes sem marcas, piso sem riscos, janelas e tomadas funcionando.`,
    }));
    const { error } = await adm().from("conferencia_itens").insert(extras);
    if (error) throw error;
  });

  test("F1 (1280 px): o inquilino confirma com 0 itens próprios", async ({ browser }) => {
    const page = await entrarNoFuso(browser, inquilino.email, 1280);
    await page.goto(`/dashboard/locacoes/${ids.contrato}`, { waitUntil: "domcontentloaded" });
    const confirmar = page.getByTestId("conferencia-entrada-confirmar");
    await expect(confirmar).toHaveText("Confirmar o registro do proprietário", { timeout: 20_000 });
    await expect(page.getByTestId("conferencia-entrada-ajuda")).toContainText("Confirmar o registro do proprietário. Seus próprios itens são opcionais.");
    await page.waitForLoadState("networkidle").catch(() => undefined);
    await confirmar.click();
    await expect(page.getByTestId("conferencia-erro")).toHaveCount(0);
    await expect(page.getByTestId("conferencia-entrada-estado")).toHaveText("Aguardando a outra parte", { timeout: 20_000 });
    await expect(page.getByTestId("conferencia-entrada-respostas")).toContainText("Inquilino confirmou");
    const confId = await conferenciaId();
    const { count } = await adm().from("conferencia_itens").select("id", { count: "exact", head: true }).eq("conferencia_id", confId!).eq("parte", "inquilino");
    expect(count).toBe(0);
    await semRolagemLateral(page);
    await page.context().close();
  });

  test("F1 (390 px): o proprietário confirma → 'Confirmada pelas duas partes' e tudo trava", async ({ browser }) => {
    const page = await entrarNoFuso(browser, dono.email, 390);
    await page.goto(`/dashboard/contratos/${ids.contrato}`, { waitUntil: "domcontentloaded" });
    const confirmar = page.getByTestId("conferencia-entrada-confirmar");
    await expect(confirmar).toHaveText("Confirmar o registro do inquilino", { timeout: 20_000 });
    await page.waitForLoadState("networkidle").catch(() => undefined);
    await confirmar.click();
    await expect(page.getByTestId("conferencia-entrada-estado")).toHaveText("Confirmada pelas duas partes", { timeout: 20_000 });
    await expect(page.getByTestId("conferencia-entrada-form")).toHaveCount(0);
    await expect(page.getByTestId("conferencia-entrada-confirmar")).toHaveCount(0);
    await semRolagemLateral(page);
    await page.screenshot({ path: `${SAIDA}/t240-f1-confirmada-390.png`, fullPage: true });
    await page.context().close();
  });

  for (const fuso of ["America/Chicago", "America/Sao_Paulo"]) {
    for (const largura of [390, 1280]) {
      test(`F2 (${largura} px, navegador em ${fuso}): seção e linha do tempo mostram o mesmo instante`, async ({ browser }) => {
        const esperado = prazoEsperado(ids.inicio!);
        const page = await entrarNoFuso(browser, inquilino.email, largura, fuso);
        await page.goto(`/dashboard/locacoes/${ids.contrato}`, { waitUntil: "domcontentloaded" });
        const secao = page.getByTestId("conferencia-prazo");
        const linha = page.getByTestId("estadia-etapa-conferencia");
        await expect(secao).toBeVisible({ timeout: 20_000 });
        await expect(secao).toContainText(esperado.texto);
        await expect(linha).toContainText(esperado.texto);
        expect(await secao.getAttribute("data-prazo")).toBe(esperado.iso);
        expect(await linha.getAttribute("data-prazo")).toBe(esperado.iso);
        await semRolagemLateral(page);
        await page.context().close();
      });
    }
  }

  test("F4: pacote de provas com 2+ páginas e a conferência das duas partes no texto do PDF", async ({ browser }) => {
    const page = await entrarNoFuso(browser, inquilino.email, 390);
    const resp = await page.request.get(`/api/contrato/${ids.contrato}/provas`);
    expect(resp.status()).toBe(200);
    expect(resp.headers()["content-type"]).toContain("application/pdf");
    const bytes = new Uint8Array(await resp.body());
    expect((await PDFDocument.load(bytes)).getPageCount()).toBeGreaterThanOrEqual(2);
    const texto = (await textoDasPaginas(bytes)).join("\n").replace(/\s+/g, " ");
    expect(texto).toContain("O proprietário confirmou a conferência de entrada");
    expect(texto).toContain("O inquilino confirmou a conferência de entrada");
    expect(texto).toContain("Conferência de entrada: Confirmada pelas duas partes.");
    expect(texto).toContain(`- ${COZINHA}: Geladeira e fogão funcionando.`);
    expect(texto).toContain("1 foto na plataforma");
    expect(texto).toContain("As fotos ficam na tela da conferência.");
    expect(texto).toContain("Situação Em vigência");
    expect(texto.split("registro anulado em").length - 1).toBe(1);
    expect(texto).toContain("1 registro anulado fica fora dos totais.");
    await page.context().close();
  });

  test("F5 (390 e 1280 px): admin abre o contrato (200), vê a conferência confirmada e baixa o pacote da equipe", async ({ browser }) => {
    test.skip(!hasAccount("admin"), "conta de admin do laboratório não configurada");
    for (const largura of [390, 1280]) {
      const page = await admin(browser, largura);
      const r = await page.goto(`/admin/contratos/${ids.contrato}`, { waitUntil: "domcontentloaded" });
      expect(r?.status()).toBe(200);
      await expect(page.getByTestId("admin-contrato-selo")).toHaveText("Em vigência", { timeout: 20_000 });
      await expect(page.getByTestId("admin-conferencia-entrada-estado")).toHaveText("Confirmada pelas duas partes");
      const respostas = page.getByTestId("admin-conferencia-entrada-respostas");
      await expect(respostas).toContainText("Proprietário confirmou");
      await expect(respostas).toContainText("Inquilino confirmou");
      await expect(page.getByTestId("admin-conferencia-prazo")).toContainText(prazoEsperado(ids.inicio!).texto);
      await expect(page.getByTestId("admin-pagamento-anulado")).toHaveCount(1);
      await expect(page.getByTestId("admin-contrato-taxa")).toContainText("Taxa de serviço:");
      // E198: a saída explícita no cabeçalho (a data do último bloco).
      const { data: ultimo } = await adm().from("contrato_blocos").select("fim").eq("contrato_id", ids.contrato).order("numero_bloco", { ascending: false }).limit(1).single();
      const [a, m, d] = String(ultimo!.fim).slice(0, 10).split("-");
      await expect(page.getByTestId("admin-contrato-saida")).toContainText(`Saída: ${d}/${m}/${a}`);
      await expect(page.getByTestId("admin-contrato-entrada")).toContainText("Entrada: ");
      await expect(page.getByRole("img", { name: `Foto: ${SALA}` })).toBeVisible();
      await semRolagemLateral(page);
      await page.screenshot({ path: `${SAIDA}/t240-admin-contrato-${largura}.png`, fullPage: true });
      await page.context().close();
    }
    // a abertura entra no registro de moderação
    const { count } = await adm().from("moderacao_log").select("id", { count: "exact", head: true }).eq("acao", "ver_contrato").eq("alvo_id", ids.contrato!);
    expect(count ?? 0).toBeGreaterThanOrEqual(2);

    const page = await admin(browser, 1280);
    const pdf = await page.request.get(`/api/admin/contratos/${ids.contrato}/provas`);
    expect(pdf.status()).toBe(200);
    const texto = (await textoDasPaginas(new Uint8Array(await pdf.body()))).join("\n").replace(/\s+/g, " ");
    expect(texto).toMatch(/Gerado pela equipe Viva Nomads em \d{2}\/\d{2}\/\d{4} às \d{2}:\d{2}/);
    expect(texto).toContain("O proprietário confirmou a conferência de entrada");

    // lista: coluna nova e o link "Abrir o contrato" não dá 404
    await page.goto(`/admin/contratos?tipo=todos&q=${encodeURIComponent(titulo)}`, { waitUntil: "domcontentloaded" });
    const linhaLista = page.getByTestId("contrato-linha").filter({ hasText: titulo });
    await expect(linhaLista.getByTestId("contrato-conferencia-entrada")).toHaveText("Confirmada pelas duas partes", { timeout: 20_000 });
    const href = await linhaLista.getByTestId("abrir-contrato-admin").getAttribute("href");
    expect(href).toBe(`/admin/contratos/${ids.contrato}`);
    // E197: o mesmo contrato tem o MESMO selo na lista e no detalhe (fonte única), e a assinatura não se contradiz.
    const seloLista = (await linhaLista.getByTestId("contrato-selo").textContent())?.trim();
    const assinaturaLista = (await linhaLista.getByTestId("contrato-assinatura").textContent())?.trim();
    const aberto = await page.goto(href!, { waitUntil: "domcontentloaded" });
    expect(aberto?.status()).toBe(200);
    await expect(page.getByTestId("admin-contrato-selo")).toHaveText(seloLista!, { timeout: 20_000 });
    if (assinaturaLista === "Assinado pelas duas partes") {
      await expect(page.getByTestId("admin-contrato-assinaturas")).not.toContainText("Nenhuma assinatura ainda.");
    }
    await page.context().close();
  });

  test("F5: quem não é admin recebe 404 na rota nova e no pacote da equipe", async ({ browser }) => {
    const page = await entrarNoFuso(browser, dono.email, 390);
    const r = await page.goto(`/admin/contratos/${ids.contrato}`, { waitUntil: "domcontentloaded" });
    expect(r?.status()).toBe(404);
    await expect(page.getByTestId("admin-contrato")).toHaveCount(0);
    const pdf = await page.request.get(`/api/admin/contratos/${ids.contrato}/provas`);
    expect(pdf.status()).toBe(404);
    await page.context().close();
  });
});
