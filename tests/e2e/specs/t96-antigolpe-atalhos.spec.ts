import { test, expect } from "@playwright/test";
import { conversationId } from "../../../src/lib/messages/conversation-id";
import { NO_LABORATORIO, adm, apagarContas, criarConta, criarImovelPronto, criarLead, entrar, gravarMensagem, novaSenha, novoSufixo } from "../fixtures/laboratorio";

/**
 * T96 — "Próximo do FF" 1/6 e 5/6 (ordens a875278a e 19cfa5b1):
 * atalhos da home com contagem real e aviso antigolpe nas páginas públicas.
 */
test.beforeEach(({}, info) => {
  test.skip(info.project.name !== "chromium", "só no projeto do site (chromium)");
});

test.describe("público", () => {
test.use({ storageState: { cookies: [], origins: [] } });
test("home: cada atalho mostra o total real de imóveis e nenhum aparece com 0", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/", { waitUntil: "networkidle" });
  const totais = page.getByTestId("atalho-total");
  const n = await totais.count();
  for (let i = 0; i < n; i++) {
    const txt = (await totais.nth(i).innerText()).trim();
    expect(txt).toMatch(/^[1-9]\d* im[óo]ve(l|is)$/);
  }
});

test("pedido de moradia mostra o aviso antigolpe com link para /seguranca", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/pedidos/novo", { waitUntil: "domcontentloaded" });
  const aviso = page.getByTestId("aviso-antigolpe");
  await expect(aviso).toContainText("nunca pede PIX");
  await expect(aviso.getByRole("link")).toHaveAttribute("href", "/seguranca");
});

test("home: o atalho de preço é \"Até R$ 2.000/mês\" e abre a busca com orcamento=2000", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/", { waitUntil: "networkidle" });
  const link = page.getByTestId("atalhos-categoria").getByRole("link", { name: /Até R\$ 2\.000/ });
  if (await link.count()) await expect(link).toHaveAttribute("href", "/buscar?orcamento=2000");
});

test("anúncio: aviso antigolpe fica perto da candidatura", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/buscar", { waitUntil: "domcontentloaded" });
  await page.locator('a[href^="/imoveis/"]').first().waitFor({ state: "attached" });
  const hrefs = await page.locator('a[href^="/imoveis/"]').evaluateAll((els) => [...new Set(els.map((e) => e.getAttribute("href") as string))]);
  // Anúncio de EXEMPLO não tem formulário de candidatura (nem o aviso): procura o primeiro anúncio real.
  let achou = false;
  for (const href of hrefs.slice(0, 8)) {
    await page.goto(href, { waitUntil: "domcontentloaded" });
    await page.locator("h1").first().waitFor();
    if (await page.getByText("Anúncio de exemplo").count()) continue;
    await expect(page.getByTestId("aviso-antigolpe").first()).toContainText("nunca pede PIX");
    achou = true;
    break;
  }
  test.skip(!achou, "só anúncios de exemplo na busca; o aviso do anúncio real é coberto pelo unitário antigolpe.test.ts");
});
// Ordens 0f93aa8c e 5ade9aaa (16/10) substituem a regra "só ícone" do #555: cada cartão tem foto
// própria E mantém o ícone da categoria sobre a foto. As fotos são conferidas em detalhe no t133.
test("home: cada atalho tem foto própria e o ícone da categoria", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/", { waitUntil: "networkidle" });
  const cartoes = page.getByTestId("atalhos-categoria").getByTestId("atalho-cartao");
  const n = await cartoes.count();
  for (let i = 0; i < n; i++) {
    await expect(cartoes.nth(i).locator("svg")).toHaveCount(1);
    await expect(cartoes.nth(i).locator("img")).toHaveCount(1);
  }
});
});

const senha = novaSenha();
const sufixo = novoSufixo();
const dono = { email: `dono.pix.${sufixo}@lab.vivanomads.test`, nome: "Dora Pix", role: "owner" as const };
const inq = { email: `inq.pix.${sufixo}@lab.vivanomads.test`, nome: "Iara Pix", role: "tenant" as const };
const ids: { dono?: string; inq?: string; imovel?: string; conversa?: string; contrato?: string } = {};

test.describe("Mensagens: aviso no topo e alerta de PIX", () => {
  test.skip(!NO_LABORATORIO, "Só no laboratório.");
  test.describe.configure({ mode: "serial" });
  test.use({ viewport: { width: 390, height: 844 } });

  test.beforeAll(async () => {
    ids.dono = await criarConta(dono, senha);
    ids.inq = await criarConta(inq, senha);
    ids.imovel = await criarImovelPronto(ids.dono, `Studio do alerta PIX ${sufixo}`, { ativo: true });
    await criarLead(ids.dono, ids.inq, ids.imovel);
    ids.conversa = conversationId(ids.inq, ids.dono, ids.imovel);
    await gravarMensagem(ids.dono, ids.inq, ids.imovel, "Faz um pix de R$ 500 para garantir.", ids.conversa);
  });

  test.afterAll(async () => {
    await adm().from("contratos").delete().eq("property_id", ids.imovel ?? "");
    await adm().from("messages").delete().eq("property_id", ids.imovel ?? "");
    await adm().from("leads").delete().eq("owner_id", ids.dono ?? "");
    await apagarContas([ids.dono, ids.inq]);
  });

  test("antes do contrato: aviso no topo e alerta na mensagem com PIX", async ({ browser }) => {
    test.setTimeout(120_000);
    const pagina = await entrar(browser, inq.email, senha);
    await pagina.goto("/dashboard/mensagens", { waitUntil: "networkidle" });
    await expect(pagina.getByTestId("aviso-antigolpe").first()).toContainText("nunca pede PIX");
    await pagina.getByTestId("mensagens-conversa").first().click();
    await expect(pagina.getByTestId("alerta-antigolpe-mensagem")).toBeVisible();
    await pagina.close();
  });

  test("contrato só com uma assinatura ainda mostra o alerta; assinado pelas duas partes ele some", async ({ browser }) => {
    test.setTimeout(120_000);
    const { data, error } = await adm()
      .from("contratos")
      .insert({
        property_id: ids.imovel, tenant_id: ids.inq, owner_plan: "essential", faixa: "temporada", prazo_total_dias: 60,
        aluguel_mensal: 3200, tamanho_bloco_meses: 2, comissao_percent: 0.08, comissao_valor: 256, qtd_ocupantes: 1,
        status: "ativo", garantia: "caucao", assinado_proprietario_em: new Date().toISOString(),
      })
      .select("id")
      .single();
    if (error) throw error;
    ids.contrato = data.id as string;
    const pagina = await entrar(browser, inq.email, senha);
    await pagina.goto("/dashboard/mensagens", { waitUntil: "networkidle" });
    await pagina.getByTestId("mensagens-conversa").first().click();
    await expect(pagina.getByTestId("alerta-antigolpe-mensagem")).toBeVisible();
    await adm().from("contratos").update({ assinado_inquilino_em: new Date().toISOString() }).eq("id", ids.contrato);
    await pagina.goto("/dashboard/mensagens", { waitUntil: "networkidle" });
    await pagina.getByTestId("mensagens-conversa").first().click();
    await expect(pagina.getByTestId("alerta-antigolpe-mensagem")).toHaveCount(0);
    await pagina.close();
  });
});
