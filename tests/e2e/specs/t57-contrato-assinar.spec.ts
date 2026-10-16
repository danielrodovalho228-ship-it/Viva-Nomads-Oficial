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
    test.setTimeout(120_000);
    const page = await entrar(browser, inq.email, senha);
    await page.goto("/dashboard/locacoes", { waitUntil: "domcontentloaded" });
    const titulo = page.getByTestId("locacao-titulo").first();
    await expect(titulo).toBeVisible({ timeout: 20_000 });
    await expect(page.getByTestId("locacao-ver-contrato").first()).toBeVisible();
    await titulo.click();
    await expect(page).toHaveURL(/\/dashboard\/locacoes\/[0-9a-f-]{36}$/);
    await expect(page.getByTestId("contrato-resumo")).toContainText("MINUTA DE TESTE — sem validade");
    await expect(page.getByTestId("contrato-aviso-assinatura")).toBeVisible();
    await expect(page.getByTestId("form-assinar")).toBeVisible();
    await expect(page.getByTestId("assinar-enviar")).toBeDisabled();
    await page.getByTestId("assinar-aceite").check();
    await expect(page.getByTestId("assinar-enviar")).toBeDisabled(); // falta o código de 6 dígitos
    await page.getByTestId("assinar-codigo").fill("123456");
    await expect(page.getByTestId("assinar-enviar")).toBeEnabled(); // o servidor recusa código que não foi pedido
    await page.getByTestId("assinar-enviar").click();
    await expect(page.getByRole("alert").filter({ hasText: /código/i })).toBeVisible(); // recusa mostrada, sem assinar
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
    await expect(page).toHaveURL(/\/dashboard\/contratos\/[0-9a-f-]{36}$/);
    await expect(page.getByTestId("contrato-resumo")).toBeVisible();
    await expect(page.getByTestId("contrato-aviso-assinatura")).toBeVisible();
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
  });

  test.afterAll(async () => {
    if (ids.contrato) await adm().from("contratos").delete().eq("id", ids.contrato);
    await apagarContas([ids.dono, ids.inq]);
  });

  test("inquilino: título abre o contrato e o código que não foi pedido é recusado", async ({ browser }) => {
    test.setTimeout(90_000);
    const page = await entrar(browser, inq.email, senha);
    await page.goto("/dashboard/locacoes", { waitUntil: "networkidle" });
    await page.getByTestId("locacao-titulo").first().click();
    await expect(page).toHaveURL(new RegExp(`/dashboard/locacoes/${ids.contrato}$`));
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
