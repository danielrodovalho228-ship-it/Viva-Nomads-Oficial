import { test, expect } from "@playwright/test";
import { authFile } from "../fixtures/auth";
import { NO_LABORATORIO, adm, apagarContas, criarConta, criarImovelPronto, entrar, novaSenha, novoSufixo } from "../fixtures/laboratorio";

/**
 * T57 — ordem 0fd301f0 (F40): o inquilino abre o contrato pelo título/botão e vê o que falta para assinar.
 * O fluxo com contrato roda SEMPRE no laboratório: o próprio teste cria dono, inquilino, imóvel e um contrato
 * aguardando assinatura (achado do Moacir, ordem 22a310d2: antes pulava por falta de contrato nas contas de teste).
 * As recusas (404) rodam em qualquer ambiente.
 */
test.describe("T57 — Contrato: ver e assinar", () => {
  test.use({ storageState: authFile("inquilino") });

  // Um teste por rota, sem esperar "networkidle" (o painel mantém conexões abertas e o conjunto de 4 idas
  // estourava os 45 s do teste). O status 404 vem na resposta; se o painel já tiver enviado o esqueleto de
  // carregamento, a prova é a tela "Página não encontrada" sem nenhum dado de contrato.
  const rotasSemAcesso = [
    ["locações: uuid que não existe", "/dashboard/locacoes/00000000-0000-4000-8000-000000000000"],
    ["locações: id que não é uuid", "/dashboard/locacoes/nao-e-uuid"],
    // Rota do proprietário (ordem f375fdc1): mesma regra.
    ["contratos: uuid que não existe", "/dashboard/contratos/00000000-0000-4000-8000-000000000000"],
    ["contratos: id que não é uuid", "/dashboard/contratos/nao-e-uuid"],
  ] as const;
  for (const [nome, rota] of rotasSemAcesso) {
    test(`contrato que não existe ou que não é meu dá 404 e nada vaza — ${nome}`, async ({ page }) => {
      const r = await page.goto(rota, { waitUntil: "domcontentloaded" });
      if (r?.status() !== 404) {
        await expect(page.getByRole("heading", { name: "Página não encontrada" })).toBeVisible();
      }
      await expect(page.getByTestId("contrato-resumo")).toHaveCount(0);
      await expect(page.getByTestId("form-assinar")).toHaveCount(0);
    });
  }
});

test.describe("T57 — Contrato semeado: inquilino e proprietário veem e assinam", () => {
  test.skip(!NO_LABORATORIO, "Só no laboratório.");
  test.describe.configure({ mode: "serial" });

  const senha = novaSenha();
  const sufixo = novoSufixo();
  const dono = { email: `dono.t57.${sufixo}@lab.vivanomads.test`, nome: "Dora Contrato", role: "owner" as const };
  const inq = { email: `inq.t57.${sufixo}@lab.vivanomads.test`, nome: "Iago Contrato", role: "tenant" as const };
  const ids: { dono?: string; inq?: string; imovel?: string; contrato?: string } = {};

  test.beforeAll(async () => {
    ids.dono = await criarConta(dono, senha);
    ids.inq = await criarConta(inq, senha);
    ids.imovel = await criarImovelPronto(ids.dono, `Contrato t57 ${sufixo}`, { ativo: true });
    // "ativo" sem assinaturas = "Aguardando assinatura": é o estado em que a tela de assinar aparece.
    const { data, error } = await adm()
      .from("contratos")
      .insert({
        property_id: ids.imovel,
        tenant_id: ids.inq,
        owner_plan: "essential",
        faixa: "temporada",
        prazo_total_dias: 60,
        aluguel_mensal: 3200,
        tamanho_bloco_meses: 2,
        comissao_percent: 0.08,
        comissao_valor: 256,
        qtd_ocupantes: 1,
        status: "ativo",
        garantia: "caucao",
      })
      .select("id")
      .single();
    if (error) throw error;
    ids.contrato = data.id as string;
  });

  test.afterAll(async () => {
    if (ids.contrato) await adm().from("contratos").delete().eq("id", ids.contrato);
    await apagarContas([ids.dono, ids.inq]);
  });

  test("Minhas locações: título e botão abrem o detalhe; assinar exige 'Li e concordo' e o código de e-mail", async ({ browser }) => {
    test.setTimeout(150_000);
    const page = await entrar(browser, inq.email, senha);
    // Prompt 28: aguardando assinatura ainda não é locação — o contrato fica em "Contratos", com "Assinar agora".
    await page.goto("/dashboard/contratos", { waitUntil: "domcontentloaded" });
    const assinar = page.getByTestId("contrato-inquilino-assinar").first();
    await expect(assinar).toBeVisible({ timeout: 20_000 });
    await expect(page.getByTestId("contrato-inquilino-estado").first()).toHaveText("Aguardando assinatura · falta você e o proprietário");
    await page.goto("/dashboard/locacoes", { waitUntil: "domcontentloaded" });
    await expect(page.getByTestId("locacao-titulo")).toHaveCount(0);
    await page.goto("/dashboard/contratos", { waitUntil: "domcontentloaded" });
    await page.getByTestId("contrato-inquilino-assinar").first().click();
    await expect(page).toHaveURL(/\/dashboard\/contratos\/[0-9a-f-]{36}$/);
    await expect(page.getByTestId("contrato-resumo")).toContainText("MINUTA DE TESTE — sem validade");
    await expect(page.getByTestId("contrato-aviso-assinatura")).toBeVisible();
    await expect(page.getByTestId("form-assinar")).toBeVisible();
    await expect(page.getByTestId("assinar-enviar")).toBeDisabled();
    await page.getByTestId("assinar-aceite").check();
    await expect(page.getByTestId("assinar-enviar")).toBeDisabled(); // falta o código de 6 dígitos
    await page.getByTestId("assinar-codigo").fill("123456");
    await expect(page.getByTestId("assinar-enviar")).toBeEnabled(); // o servidor recusa código que não foi pedido
    await page.getByTestId("assinar-enviar").click();
    // Recusa mostrada, sem assinar (a ação do servidor pode demorar no lab). Se falhar, o erro traz o que a tela mostrou.
    try {
      await expect(page.getByRole("alert").filter({ hasText: /código/i })).toBeVisible({ timeout: 45_000 });
    } catch (e) {
      const alertas = await page.getByRole("alert").allInnerTexts();
      const botao = await page.getByTestId("assinar-enviar").innerText().catch(() => "(sem botão)");
      throw new Error(`Alertas na tela: ${JSON.stringify(alertas)}; botão: ${JSON.stringify(botao)}; url: ${page.url()}\n${(e as Error).message}`);
    }
    await expect(page.getByTestId("form-assinar")).toBeVisible();
    const { data } = await adm().from("contratos").select("assinado_inquilino_em").eq("id", ids.contrato!).single();
    expect(data?.assinado_inquilino_em, "código inventado não pode assinar").toBeNull();
    await page.context().close();
  });

  test("proprietário: 'Ver e assinar contrato' abre /dashboard/contratos/<id> com o resumo e o aviso", async ({ browser }) => {
    test.setTimeout(120_000);
    const page = await entrar(browser, dono.email, senha);
    await page.goto("/dashboard/contratos", { waitUntil: "domcontentloaded" });
    const link = page.getByTestId("contrato-ver-assinar").first();
    await expect(link).toBeVisible({ timeout: 20_000 });
    await link.click();
    await expect(page).toHaveURL(/\/dashboard\/contratos\/[0-9a-f-]{36}$/, { timeout: 45_000 });
    await expect(page.getByTestId("contrato-resumo")).toBeVisible();
    await expect(page.getByTestId("contrato-aviso-assinatura")).toBeVisible();
    // O inquilino assina (gravado pelo servidor de teste: o código vai por e-mail e o lab não lê caixa): o dono vê quem falta.
    await adm().from("contratos").update({ assinado_inquilino_em: new Date().toISOString() }).eq("id", ids.contrato!);
    await page.reload({ waitUntil: "domcontentloaded" });
    await expect(page.getByTestId("contrato-aviso-assinatura")).toHaveText(/\(inquilino\) assinou em \d{2}\/\d{2}\/\d{4} às \d{2}:\d{2} · falta você$/);
    await expect(page.getByTestId("form-assinar")).toBeVisible();
    await adm().from("contratos").update({ assinado_proprietario_em: new Date().toISOString() }).eq("id", ids.contrato!);
    await page.reload({ waitUntil: "domcontentloaded" });
    await expect(page.getByTestId("contrato-aviso-assinatura")).toHaveText(/\(proprietário\) assinou em [\s\S]+\(inquilino\) assinou em /); // jornada de assinatura: nome + data e hora de cada um
    await page.context().close();
  });
});

/**
 * Contrato SEMEADO pelo próprio teste (achado do Moacir, ordem a7881041): no laboratório as contas fixas não têm
 * contrato, então a prova da recusa do código não pedido ficava pulada. Aqui o setup cria dono, inquilino, imóvel
 * e um contrato `ativo` sem assinaturas, e as duas partes tentam assinar com um código que nunca foi pedido.
 */
const senha = novaSenha();
const sufixo = novoSufixo();
const dono = { email: `dono.ass.${sufixo}@lab.vivanomads.test`, nome: "Dora Assina", role: "owner" as const };
const inq = { email: `inq.ass.${sufixo}@lab.vivanomads.test`, nome: "Ivo Assina", role: "tenant" as const };
const ids: { dono?: string; inq?: string; imovel?: string; contrato?: string } = {};

test.describe("T57 — Contrato semeado: as duas partes têm o código de assinatura recusado", () => {
  test.skip(!NO_LABORATORIO, "Só no laboratório.");
  test.describe.configure({ mode: "serial" });

  test.beforeAll(async () => {
    ids.dono = await criarConta(dono, senha);
    ids.inq = await criarConta(inq, senha);
    ids.imovel = await criarImovelPronto(ids.dono, `Assinatura ${sufixo}`, { ativo: true, preco: 3200 });
    const { data, error } = await adm()
      .from("contratos")
      .insert({
        property_id: ids.imovel,
        tenant_id: ids.inq,
        owner_plan: "essential",
        faixa: "temporada",
        prazo_total_dias: 60,
        aluguel_mensal: 3200,
        tamanho_bloco_meses: 2,
        comissao_percent: 0.08,
        comissao_valor: 256,
        qtd_ocupantes: 1,
        status: "ativo",
        garantia: "caucao",
      })
      .select("id")
      .single();
    if (error) throw error;
    ids.contrato = data.id as string;
    // O dono só assina com as instruções de entrada completas (Check-in garantido, conferido no servidor ANTES
    // do código). Sem isto a recusa vinha com a mensagem das instruções, sem a palavra "código" (lab 5ced34d).
    const { error: errCheckin } = await adm()
      .from("contratos_checkin")
      .insert({ contrato_id: ids.contrato, horario: "14:00", instrucoes: "Chave na portaria, apto 12.", plantao: "34999990000" });
    if (errCheckin) throw errCheckin;
  });

  test.afterAll(async () => {
    if (ids.contrato) await adm().from("contratos").delete().eq("id", ids.contrato);
    await apagarContas([ids.dono, ids.inq]);
  });

  test("inquilino: título abre o contrato e o código que não foi pedido é recusado", async ({ browser }) => {
    test.setTimeout(90_000);
    const page = await entrar(browser, inq.email, senha);
    await page.goto("/dashboard/contratos", { waitUntil: "networkidle" });
    await page.getByTestId("contrato-inquilino-assinar").first().click();
    await expect(page).toHaveURL(new RegExp(`/dashboard/contratos/${ids.contrato}$`));
    await expect(page.getByTestId("contrato-resumo")).toContainText("MINUTA DE TESTE — sem validade");
    await page.getByTestId("assinar-aceite").check();
    await page.getByTestId("assinar-codigo").fill("123456");
    await page.getByTestId("assinar-enviar").click();
    await expect(page.getByRole("alert").filter({ hasText: /código/i })).toBeVisible();
    await expect(page.getByTestId("form-assinar")).toBeVisible();
    await page.context().close();
  });

  test("proprietário: 'Ver e assinar contrato' abre o contrato e o código que não foi pedido é recusado", async ({ browser }) => {
    test.setTimeout(90_000);
    const page = await entrar(browser, dono.email, senha);
    await page.goto("/dashboard/contratos", { waitUntil: "networkidle" });
    await page.getByTestId("contrato-ver-assinar").first().click();
    await expect(page).toHaveURL(new RegExp(`/dashboard/contratos/${ids.contrato}$`));
    await expect(page.getByTestId("contrato-aviso-assinatura")).toBeVisible();
    await page.getByTestId("assinar-aceite").check();
    await page.getByTestId("assinar-codigo").fill("123456");
    await page.getByTestId("assinar-enviar").click();
    await expect(page.getByRole("alert").filter({ hasText: /código/i })).toBeVisible();
    await page.context().close();
  });
});

/**
 * Assinatura PELA TELA até o fim (ordem d07e4c70, achado do Moacir no #825): as duas partes pedem o código,
 * leem na caixa de e-mails de teste da própria conta (profiles.is_teste, só no laboratório), marcam "Li e concordo"
 * e assinam. Nenhuma assinatura é gravada pelo cliente admin.
 */
test.describe("T57 — Contrato semeado: as duas partes assinam pela tela com o código da caixa de teste", () => {
  test.skip(!NO_LABORATORIO, "Só no laboratório.");
  test.describe.configure({ mode: "serial" });

  const senha = novaSenha();
  const sufixo = novoSufixo();
  const dono = { email: `dono.tela.${sufixo}@lab.vivanomads.test`, nome: "Dora Tela", role: "owner" as const };
  const inq = { email: `inq.tela.${sufixo}@lab.vivanomads.test`, nome: "Ivo Tela", role: "tenant" as const };
  const ids: { dono?: string; inq?: string; imovel?: string; contrato?: string } = {};

  test.beforeAll(async () => {
    ids.dono = await criarConta(dono, senha);
    ids.inq = await criarConta(inq, senha);
    // Conta de teste: o e-mail do código vai para a caixa dela (emails_teste), que o próprio teste lê.
    const { error: eTeste } = await adm().from("profiles").update({ is_teste: true }).in("id", [ids.dono, ids.inq]);
    if (eTeste) throw eTeste;
    ids.imovel = await criarImovelPronto(ids.dono, `Assinatura tela ${sufixo}`, { ativo: true, preco: 3200 });
    const { data, error } = await adm()
      .from("contratos")
      .insert({
        property_id: ids.imovel,
        tenant_id: ids.inq,
        owner_plan: "essential",
        faixa: "temporada",
        prazo_total_dias: 60,
        aluguel_mensal: 3200,
        tamanho_bloco_meses: 2,
        comissao_percent: 0.08,
        comissao_valor: 256,
        qtd_ocupantes: 1,
        status: "ativo",
        garantia: "caucao",
      })
      .select("id")
      .single();
    if (error) throw error;
    ids.contrato = data.id as string;
    const { error: errCheckin } = await adm()
      .from("contratos_checkin")
      .insert({ contrato_id: ids.contrato, horario: "14:00", instrucoes: "Chave na portaria, apto 12.", plantao: "34999990000" });
    if (errCheckin) throw errCheckin;
  });

  test.afterAll(async () => {
    if (ids.contrato) await adm().from("contratos").delete().eq("id", ids.contrato);
    await apagarContas([ids.dono, ids.inq]);
  });

  async function codigoDaCaixa(usuarioId: string): Promise<string> {
    for (let i = 0; i < 30; i++) {
      const { data } = await adm()
        .from("emails_teste")
        .select("corpo")
        .eq("usuario_id", usuarioId)
        .eq("evento", "contract_signature_code")
        .order("criado_em", { ascending: false })
        .limit(1);
      const m = /":\s*(\d{6})\s*$/m.exec(String(data?.[0]?.corpo ?? "").trim()); // o código fecha a 1ª linha ("…de \"<imóvel>\": 123456"); a caixa guarda o e-mail inteiro (complemento do #880)
      if (m) return m[1];
      await new Promise((r) => setTimeout(r, 1000));
    }
    throw new Error("O código de assinatura não chegou à caixa de testes em 30 s.");
  }

  test("inquilino pede o código, lê na caixa de teste, marca 'Li e concordo' e assina", async ({ browser }) => {
    test.setTimeout(150_000);
    const page = await entrar(browser, inq.email, senha);
    await page.goto(`/dashboard/locacoes/${ids.contrato}`, { waitUntil: "domcontentloaded" });
    await expect(page.getByTestId("form-assinar")).toBeVisible({ timeout: 20_000 });
    await page.getByTestId("assinar-pedir-codigo").click();
    await expect(page.getByText(/Enviamos 6 números/)).toBeVisible({ timeout: 45_000 });
    await page.getByTestId("assinar-aceite").check();
    await page.getByTestId("assinar-codigo").fill(await codigoDaCaixa(ids.inq!));
    await page.getByTestId("assinar-enviar").click();
    await expect(page.getByTestId("form-assinar")).toHaveCount(0, { timeout: 45_000 });
    const { data } = await adm().from("contratos").select("assinado_inquilino_em, assinado_proprietario_em").eq("id", ids.contrato!).single();
    expect(data?.assinado_inquilino_em, "assinatura do inquilino gravada pelo servidor").not.toBeNull();
    expect(data?.assinado_proprietario_em).toBeNull();
    await page.context().close();
  });

  test("proprietário vê 'O inquilino já assinou', assina pela tela e as duas partes aparecem assinadas", async ({ browser }) => {
    test.setTimeout(150_000);
    const page = await entrar(browser, dono.email, senha);
    await page.goto(`/dashboard/contratos/${ids.contrato}`, { waitUntil: "domcontentloaded" });
    await expect(page.getByTestId("contrato-aviso-assinatura")).toHaveText(/\(inquilino\) assinou em \d{2}\/\d{2}\/\d{4} às \d{2}:\d{2} · falta você$/, { timeout: 20_000 });
    await page.getByTestId("assinar-pedir-codigo").click();
    await expect(page.getByText(/Enviamos 6 números/)).toBeVisible({ timeout: 45_000 });
    await page.getByTestId("assinar-aceite").check();
    await page.getByTestId("assinar-codigo").fill(await codigoDaCaixa(ids.dono!));
    await page.getByTestId("assinar-enviar").click();
    await expect(page.getByTestId("form-assinar")).toHaveCount(0, { timeout: 45_000 });
    await expect(page.getByTestId("contrato-aviso-assinatura")).toHaveText(/\(proprietário\) assinou em [\s\S]+\(inquilino\) assinou em /); // jornada de assinatura: nome + data e hora de cada um
    const { data } = await adm().from("contratos").select("assinado_inquilino_em, assinado_proprietario_em").eq("id", ids.contrato!).single();
    expect(data?.assinado_proprietario_em, "assinatura do dono gravada pelo servidor").not.toBeNull();
    await page.context().close();
  });
});
