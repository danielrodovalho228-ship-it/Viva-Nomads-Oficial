import { test, expect, type Browser, type Page } from "@playwright/test";
import { NO_LABORATORIO, adm, apagarContas, criarConta, criarImovelPronto, criarLead, entrar, novaSenha, novoSufixo } from "../fixtures/laboratorio";
import { campoBrasiliaParaIso, instanteParaCampoBrasilia } from "../../../src/lib/visitas-video";

/*
  T209 — Prompt 23, jornada dos dois lados (QA do Muse, 18/10). 390 e 1280 px.
   1. Horário de Brasília: a mesma escolha "15:00" num navegador em America/Chicago e em America/Sao_Paulo grava o
      MESMO instante (18:00 UTC) e o proprietário vê 15:00 "horário de Brasília".
   2. Visita presencial dentro da plataforma: confirmar, propor outro horário (Remarcar → o morador aceita) e recusar
      com motivo, no painel Visitas e no cartão da conversa; o endereço exato só aparece depois da confirmação.
   3. Conta de teste: laudo simulado "TESTE — verificação simulada" em /dashboard/verificacao e no fechamento (a
      jornada segue); conta real continua "em breve".
   4. Taxa de serviço com a base real: contrato antigo "12% de 1 mês — regra vigente no aceite em DD/MM"; novo
      "12% do valor total".
   5. Agenda: a visita confirmada e a locação aparecem; outro proprietário não vê; /dashboard/calendario → Agenda.
   6. E-mails da jornada na caixa de teste (visita pedida / confirmada / remarcada / cancelada).
*/
const senha = novaSenha();
const sufixo = novoSufixo();
const dono = { email: `dono.t206.${sufixo}@lab.vivanomads.test`, nome: "Dalva Jornada Sobrenome", role: "owner" as const };
const outro = { email: `outro.t206.${sufixo}@lab.vivanomads.test`, nome: "Olavo Vizinho Sobrenome", role: "owner" as const };
const inqA = { email: `inqa.t206.${sufixo}@lab.vivanomads.test`, nome: "Ana Chicago Sobrenome", role: "tenant" as const };
const inqB = { email: `inqb.t206.${sufixo}@lab.vivanomads.test`, nome: "Bia Saopaulo Sobrenome", role: "tenant" as const };
const real = { email: `real.t206.${sufixo}@lab.vivanomads.test`, nome: "Rui Contareal Sobrenome", role: "tenant" as const };
const ids: Record<string, string | undefined> = {};
const ENDERECO = "Rua das Acácias, 120 — apto 31";
const SAIDA = "tests/laboratorio/saida";

/** Dia D+2 às 15:00 no horário de Brasília (valor do campo e o instante esperado). */
function quinzeHorasDeBrasilia(): { campo: string; iso: string } {
  const dia = instanteParaCampoBrasilia(new Date(Date.now() + 2 * 24 * 3600_000)).slice(0, 10);
  const campo = `${dia}T15:00`;
  return { campo, iso: campoBrasiliaParaIso(campo)! };
}

async function entrarNoFuso(browser: Browser, email: string, fuso: string, largura: number): Promise<Page> {
  const ctx = await browser.newContext({ viewport: { width: largura, height: largura === 390 ? 844 : 900 }, timezoneId: fuso });
  const page = await ctx.newPage();
  await page.goto("/auth", { waitUntil: "domcontentloaded" });
  const campoEmail = page.locator('input[name="email"], input[type="email"]').first();
  const campoSenha = page.locator('input[name="password"], input[type="password"]').first();
  await expect(async () => {
    await campoEmail.fill(email);
    await campoSenha.fill(senha);
    await expect(campoEmail).toHaveValue(email, { timeout: 1_000 });
  }).toPass({ timeout: 15_000 });
  await page.locator("form").getByRole("button", { name: /^entrar$/i }).click();
  await page.waitForURL(/\/dashboard/, { timeout: 30_000 });
  await page.evaluate(() => localStorage.setItem("vivanomads-role-asked", "1"));
  return page;
}

async function abrir(page: Page, rota: string) {
  await page.goto(rota, { waitUntil: "domcontentloaded" });
  await page.locator("main").first().waitFor();
  await page.waitForLoadState("networkidle", { timeout: 10_000 }).catch(() => {});
}

async function semRolagemLateral(page: Page) {
  expect(await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth)).toBeLessThanOrEqual(1);
}

async function assuntos(usuarioId: string): Promise<string[]> {
  const { data } = await adm().from("emails_teste").select("assunto").eq("usuario_id", usuarioId);
  return ((data ?? []) as { assunto: string }[]).map((r) => r.assunto);
}

async function pedirPresencial(page: Page, imovelId: string, campo: string) {
  await abrir(page, `/imoveis/${imovelId}`);
  const horario = page.getByTestId("visita-presencial-horario-0");
  await expect(async () => {
    if (!(await horario.isVisible())) {
      const botao = page.getByTestId("agendar-visita").first();
      await botao.scrollIntoViewIfNeeded({ timeout: 3_000 });
      await botao.click({ timeout: 4_000 }).catch(() => botao.dispatchEvent("click"));
    }
    await expect(horario).toBeVisible({ timeout: 3_000 });
  }).toPass({ timeout: 40_000 });
  await horario.fill(campo);
  const enviar = page.getByTestId("visita-presencial-enviar");
  await enviar.scrollIntoViewIfNeeded({ timeout: 5_000 });
  await enviar.click({ timeout: 6_000 }).catch(() => enviar.dispatchEvent("click"));
  await expect(page.getByTestId("visita-presencial-ok")).toHaveText(
    "Pedido de visita enviado. O proprietário confirma aqui na plataforma e você recebe um aviso.",
    { timeout: 25_000 },
  );
}

const visitaDe = async (tenantId: string) =>
  (await adm().from("visitas_video").select("id, status, horarios, horario_confirmado, horario_proposto, modalidade").eq("tenant_id", tenantId).eq("property_id", ids.imovel!).maybeSingle()).data;

test.describe("T209 — jornada dos dois lados (prompt 23)", () => {
  test.skip(!NO_LABORATORIO, "Só no laboratório.");
  test.describe.configure({ mode: "serial" });
  test.use({ actionTimeout: 15_000, navigationTimeout: 30_000 });

  test.beforeAll(async () => {
    ids.dono = await criarConta(dono, senha);
    ids.outro = await criarConta(outro, senha);
    ids.inqA = await criarConta(inqA, senha);
    ids.inqB = await criarConta(inqB, senha);
    ids.real = await criarConta(real, senha);
    // Dono e inquilinas A/B são contas de teste (caixa de e-mails de teste e laudo simulado); "real" não.
    await adm().from("profiles").update({ is_teste: true }).in("id", [ids.dono, ids.inqA, ids.inqB]);
    ids.imovel = await criarImovelPronto(ids.dono, `Studio jornada ${sufixo}`, { ativo: true, preco: 3200 });
    await adm().from("properties").update({ exact_address: ENDERECO }).eq("id", ids.imovel);
  });

  test.afterAll(async () => {
    if (ids.imovel) {
      await adm().from("visitas_video").delete().eq("property_id", ids.imovel);
      await adm().from("contratos").delete().eq("property_id", ids.imovel);
      await adm().from("messages").delete().eq("property_id", ids.imovel);
    }
    if (ids.dono) await adm().from("leads").delete().eq("owner_id", ids.dono);
    await apagarContas([ids.inqA, ids.inqB, ids.real, ids.outro, ids.dono]);
  });

  test("1. horário de Brasília: Chicago e São Paulo escolhem 15:00 e gravam o mesmo instante (390 e 1280)", async ({ browser }) => {
    test.setTimeout(180_000);
    const { campo, iso } = quinzeHorasDeBrasilia();
    const a = await entrarNoFuso(browser, inqA.email, "America/Chicago", 390);
    await pedirPresencial(a, ids.imovel!, campo);
    await semRolagemLateral(a);
    await a.screenshot({ path: `${SAIDA}/t209-pedido-chicago-390.png` });
    await a.context().close();
    const b = await entrarNoFuso(browser, inqB.email, "America/Sao_Paulo", 1280);
    await pedirPresencial(b, ids.imovel!, campo);
    await b.screenshot({ path: `${SAIDA}/t209-pedido-saopaulo-1280.png` });
    await b.context().close();

    const va = await visitaDe(ids.inqA!);
    const vb = await visitaDe(ids.inqB!);
    expect(va?.modalidade).toBe("presencial");
    expect(new Date((va!.horarios as string[])[0]).toISOString(), "Chicago grava 15:00 de Brasília").toBe(iso);
    expect(new Date((vb!.horarios as string[])[0]).toISOString(), "São Paulo grava o mesmo instante").toBe(iso);
    expect(iso.slice(11, 16)).toBe("18:00");

    // O dono (Chicago também) vê 15:00 e o rótulo "horário de Brasília".
    const d = await entrarNoFuso(browser, dono.email, "America/Chicago", 1280);
    await abrir(d, "/dashboard/visitas");
    const cartao = d.getByTestId("cartao-visita").first();
    await expect(cartao).toContainText("15:00", { timeout: 25_000 });
    await expect(d.getByText(/horário de Brasília/).first()).toBeVisible();
    await expect(d.getByText("Chicago Sobrenome")).toHaveCount(0);
    await d.screenshot({ path: `${SAIDA}/t209-dono-visitas-1280.png`, fullPage: true });
    await d.context().close();
    await expect.poll(() => assuntos(ids.dono!), { timeout: 20_000 }).toContain("Pedido de visita no seu imóvel");
  });

  test("2a. presencial: endereço oculto antes; o dono confirma; o endereço aparece só para o morador (390)", async ({ browser }) => {
    test.setTimeout(150_000);
    const a = await entrar(browser, inqA.email, senha);
    await abrir(a, "/dashboard/visitas");
    await expect(a.getByTestId("visita-endereco-oculto").first()).toBeVisible({ timeout: 25_000 });
    await expect(a.getByText(ENDERECO)).toHaveCount(0);
    await a.context().close();

    const d = await entrar(browser, dono.email, senha);
    await abrir(d, "/dashboard/visitas");
    const va = await visitaDe(ids.inqA!);
    const cartao = d.locator(`#visita-${va!.id}`);
    await cartao.getByTestId("visita-confirmar").click();
    await expect.poll(async () => (await visitaDe(ids.inqA!))?.status, { timeout: 25_000 }).toBe("confirmado");
    await d.context().close();

    const a2 = await entrar(browser, inqA.email, senha);
    await abrir(a2, "/dashboard/visitas");
    await expect(a2.getByTestId("visita-status").first()).toHaveText("Confirmada", { timeout: 25_000 });
    await expect(a2.getByTestId("visita-endereco").first()).toContainText(ENDERECO);
    await semRolagemLateral(a2);
    await a2.screenshot({ path: `${SAIDA}/t209-endereco-confirmada-390.png`, fullPage: true });
    await a2.context().close();
    await expect.poll(() => assuntos(ids.inqA!), { timeout: 20_000 }).toContain("Visita confirmada");
  });

  test("2b. presencial pela conversa: o dono propõe outro horário (Remarcar) e o morador aceita (1280)", async ({ browser }) => {
    test.setTimeout(150_000);
    const novo = instanteParaCampoBrasilia(new Date(Date.now() + 3 * 24 * 3600_000)).slice(0, 10) + "T10:30";
    const d = await entrar(browser, dono.email, senha);
    await d.setViewportSize({ width: 1280, height: 900 });
    await abrir(d, "/dashboard/mensagens");
    // A conversa que o pedido abriu (Bia) mostra o cartão da visita no topo.
    // A conversa da Bia é a que tem a visita ainda "Pedida" (a da Ana já foi confirmada no 2a).
    const conversa = d.getByTestId("conversa-visita").filter({ has: d.locator('[data-testid="cartao-visita"][data-status="pedido"]') });
    await expect(d.getByTestId("mensagens-conversa").first()).toBeVisible({ timeout: 25_000 });
    await expect(async () => {
      for (const item of await d.getByTestId("mensagens-conversa").all()) {
        if (await conversa.isVisible()) break;
        await item.click({ timeout: 2_000 }).catch(() => {});
        await d.waitForTimeout(1_500);
      }
      await expect(conversa).toBeVisible({ timeout: 3_000 });
    }).toPass({ timeout: 45_000 });
    await conversa.getByTestId("visita-outro-horario").fill(novo);
    await conversa.getByTestId("visita-propor").click();
    await expect.poll(async () => (await visitaDe(ids.inqB!))?.status, { timeout: 25_000 }).toBe("remarcar");
    await d.screenshot({ path: `${SAIDA}/t209-conversa-remarcar-1280.png`, fullPage: true });
    await d.context().close();
    await expect.poll(() => assuntos(ids.inqB!), { timeout: 20_000 }).toContain("Proposta de novo horário para a visita");

    const b = await entrar(browser, inqB.email, senha);
    await abrir(b, "/dashboard/visitas");
    await expect(b.getByTestId("visita-horario-proposto").first()).toContainText("10:30", { timeout: 25_000 });
    await b.getByTestId("visita-aceitar-remarcacao").first().click();
    await expect.poll(async () => (await visitaDe(ids.inqB!))?.status, { timeout: 25_000 }).toBe("confirmado");
    expect(new Date((await visitaDe(ids.inqB!))!.horario_confirmado as string).toISOString()).toBe(campoBrasiliaParaIso(novo));
    await b.context().close();
  });

  test("2c. presencial: recusar exige motivo e o morador vê o motivo (390)", async ({ browser }) => {
    test.setTimeout(150_000);
    // Um pedido novo da conta real (sem e-mail de teste), gravado direto: o foco aqui é a recusa pela tela.
    const { iso } = quinzeHorasDeBrasilia();
    await adm().from("visitas_video").insert({ property_id: ids.imovel, owner_id: ids.dono, tenant_id: ids.real, horarios: [iso], modalidade: "presencial" });
    const vr = (await adm().from("visitas_video").select("id").eq("tenant_id", ids.real!).single()).data!;
    const d = await entrar(browser, dono.email, senha);
    await abrir(d, "/dashboard/visitas");
    const cartao = d.locator(`#visita-${vr.id}`);
    await cartao.getByTestId("visita-recusar").click();
    await cartao.getByTestId("visita-recusar-enviar").click();
    await expect(cartao.getByTestId("visita-erro")).toBeVisible();
    await cartao.getByTestId("visita-motivo-recusa").fill("Imóvel já alugado nessas datas");
    await cartao.getByTestId("visita-recusar-enviar").click();
    await expect.poll(async () => (await adm().from("visitas_video").select("status, motivo_recusa").eq("id", vr.id).single()).data?.status, { timeout: 25_000 }).toBe("cancelado");
    await d.context().close();
    const r = await entrar(browser, real.email, senha);
    await abrir(r, "/dashboard/visitas");
    await expect(r.getByTestId("visita-motivo-recusa-texto").first()).toContainText("Imóvel já alugado nessas datas", { timeout: 25_000 });
    await expect(r.getByText(ENDERECO)).toHaveCount(0);
    await r.context().close();
  });

  test("3. conta de teste: laudo simulado na Verificação e no fechamento; conta real segue 'em breve'", async ({ browser }) => {
    test.setTimeout(150_000);
    for (const largura of [390, 1280]) {
      const a = await entrar(browser, inqA.email, senha);
      await a.setViewportSize({ width: largura, height: largura === 390 ? 844 : 900 });
      await abrir(a, "/dashboard/verificacao?como=inquilino");
      const botao = a.getByTestId("verificacao-teste-verificar");
      const laudo = a.getByTestId("verificacao-teste-laudo");
      await expect(botao.or(laudo)).toBeVisible({ timeout: 25_000 });
      if (await botao.isVisible()) await botao.click();
      await expect(a.getByTestId("verificacao-teste-rotulo")).toHaveText("TESTE — verificação simulada", { timeout: 25_000 });
      await expect(a.getByText("Disponível em breve")).toHaveCount(0);
      await semRolagemLateral(a);
      await a.screenshot({ path: `${SAIDA}/t209-laudo-teste-${largura}.png`, fullPage: true });
      await a.context().close();
    }
    const r = await entrar(browser, real.email, senha);
    await abrir(r, "/dashboard/verificacao?como=inquilino");
    await expect(r.getByText("Disponível em breve")).toBeVisible({ timeout: 25_000 });
    await expect(r.getByTestId("verificacao-teste")).toHaveCount(0);
    await r.context().close();

    // Fechamento com a candidatura aceita da conta de teste: o laudo simulado aparece e a jornada segue.
    ids.lead = await criarLead(ids.dono!, ids.inqA!, ids.imovel!, true);
    for (const tipo of ["identidade", "vinculo"]) {
      const u = () => crypto.randomUUID();
      await adm().from("documentos_inquilino").insert({ lead_id: ids.lead, tenant_id: ids.inqA, tipo, caminho: `${u()}/${u()}/${u()}.pdf`, hash_sha256: "a".repeat(64) });
    }
    const d = await entrar(browser, dono.email, senha);
    await d.setViewportSize({ width: 1280, height: 900 });
    await abrir(d, `/dashboard/fechamento?c=${ids.lead}`);
    await d.getByRole("button", { name: /verificar identidade/i }).click();
    await expect(d.getByText("TESTE — verificação simulada").first()).toBeVisible({ timeout: 25_000 });
    await expect(d.getByText("Verificação pendente")).toHaveCount(0);
    await expect(d.getByRole("button", { name: /continuar/i })).toBeEnabled();
    await d.screenshot({ path: `${SAIDA}/t209-fechamento-laudo-teste-1280.png`, fullPage: true });
    await d.context().close();
  });

  test("4. taxa de serviço com a base real: contrato antigo (1 mês) e novo (valor total)", async ({ browser }) => {
    test.setTimeout(120_000);
    const base = { property_id: ids.imovel, owner_plan: "essential", faixa: "media_estadia", prazo_total_dias: 120, aluguel_mensal: 3200, tamanho_bloco_meses: 2, comissao_percent: 0.12, qtd_ocupantes: 1, garantia: "caucao", status: "ativo" };
    const leadAntigo = await criarLead(ids.dono!, ids.inqB!, ids.imovel!, true);
    await adm().from("leads").update({ accepted_at: "2026-10-12T15:00:00Z" }).eq("id", leadAntigo);
    const { data: antigo } = await adm().from("contratos").insert({ ...base, lead_id: leadAntigo, tenant_id: ids.inqB, comissao_valor: 384 }).select("id").single();
    const { data: novo } = await adm().from("contratos").insert({ ...base, lead_id: ids.lead, tenant_id: ids.inqA, comissao_valor: 1536 }).select("id").single();
    ids.contratoAntigo = antigo!.id as string;
    ids.contratoNovo = novo!.id as string;
    // A locação nova tem blocos (entra na Agenda do teste 5).
    const hoje = new Date().toISOString().slice(0, 10);
    const fim = new Date(Date.now() + 59 * 24 * 3600_000).toISOString().slice(0, 10);
    await adm().from("contrato_blocos").insert({ contrato_id: ids.contratoNovo, numero_bloco: 1, inicio: hoje, fim, meses: 2, valor: 6400, caucao: 3200, status: "ativo" });

    const d = await entrar(browser, dono.email, senha);
    for (const largura of [1280, 390]) {
      await d.setViewportSize({ width: largura, height: largura === 390 ? 844 : 900 });
      await abrir(d, "/dashboard/contratos");
      const bases = d.getByTestId("contrato-taxa-base");
      await expect(bases.filter({ hasText: "12% de 1 mês — regra vigente no aceite em 12/10" })).toHaveCount(1, { timeout: 25_000 });
      await expect(bases.filter({ hasText: "12% do valor total" })).toHaveCount(1);
      await expect(d.getByTestId("contrato-taxa").first()).toContainText("Taxa de serviço do contrato");
      await expect(d.getByTestId("contrato-taxa").first()).not.toContainText(/[Cc]omissão/);
      await semRolagemLateral(d);
      await d.screenshot({ path: `${SAIDA}/t209-taxa-base-${largura}.png`, fullPage: true });
    }
    await d.context().close();
  });

  test("5. Agenda: visita confirmada e locação aparecem; outro proprietário não vê; /dashboard/calendario → Agenda", async ({ browser }) => {
    test.setTimeout(150_000);
    const d = await entrar(browser, dono.email, senha);
    for (const largura of [1280, 390]) {
      await d.setViewportSize({ width: largura, height: largura === 390 ? 844 : 900 });
      await abrir(d, "/dashboard/agenda");
      await d.getByTestId("agenda-vista-lista").click();
      await expect(d.locator('[data-testid="agenda-item"][data-tipo="visita"]').first()).toBeVisible({ timeout: 25_000 });
      await expect(d.locator('[data-testid="agenda-item"][data-tipo="entrada"]').first()).toBeVisible();
      // Locação (depois do aceite): nome curto; visitas antes do aceite: só "Interessado(a)".
      await expect(d.locator('[data-testid="agenda-item"][data-tipo="entrada"]').first()).toContainText("Ana");
      await expect(d.getByText("Saopaulo Sobrenome")).toHaveCount(0);
      await semRolagemLateral(d);
      await d.screenshot({ path: `${SAIDA}/t209-agenda-lista-${largura}.png`, fullPage: true });
      await d.getByTestId("agenda-vista-mes").click();
      await expect(d.getByTestId("agenda-mes-titulo")).toBeVisible();
      await semRolagemLateral(d);
      await d.screenshot({ path: `${SAIDA}/t209-agenda-mes-${largura}.png`, fullPage: true });
    }
    // Clicar no item leva à visita.
    await d.getByTestId("agenda-vista-lista").click();
    await d.locator('[data-testid="agenda-item"][data-tipo="visita"] a').first().click();
    await expect(d).toHaveURL(/\/dashboard\/visitas#visita-/);
    // Endereço antigo.
    await d.goto("/dashboard/calendario", { waitUntil: "domcontentloaded" });
    await expect(d).toHaveURL(/\/dashboard\/agenda$/);
    await d.context().close();

    const o = await entrar(browser, outro.email, senha);
    await abrir(o, "/dashboard/agenda");
    await expect(o.getByTestId("agenda-item")).toHaveCount(0);
    await expect(o.getByText(`Studio jornada ${sufixo}`)).toHaveCount(0);
    await o.context().close();
  });
});
