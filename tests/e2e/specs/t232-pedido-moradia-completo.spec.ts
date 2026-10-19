import { test, expect, type Page, type Browser } from "@playwright/test";
import { authFile } from "../fixtures/auth";
import { hasAccount } from "../fixtures/accounts";
import { NO_LABORATORIO, TELEFONE_LAB, adm, apagarContas, criarConta, criarImovelPronto, entrar, lerSaida, novaSenha, novoSufixo } from "../fixtures/laboratorio";

/*
  T232 — Prompt 30, pedido de moradia completo (390 e 1280 px):
   1. chave SMS_ATIVO desligada: o inquilino publica pelo formulário (bairro, quartos, faixa de valor) e o dono
      compatível vê o pedido em "Novos para você", com os selos (e-mail ✓, "Telefone ainda não confirmado") e o sino;
      nenhum texto pede telefone para os donos verem;
   2. editar o valor muda o cartão do dono; "Oferecer um imóvel" leva a "Respondidos"; o inquilino aceita e o status
      vira "Conversa aberta", com o nome curto (identidade só depois do aceite);
   3. "Ignorar" (motivo opcional) e "Voltar para Novos";
   4. excluir: some para o dono e quem respondeu recebe aviso;
   5. chave ligada pela equipe: pedido novo sem telefone não aparece; o que já estava publicado continua (7 dias) e o
      inquilino recebe o aviso; desligar volta na hora;
   6. portas: "Publicar pedido" na busca (inclusive barra condensada), cartão com menos de 3 reais, home e menu.
*/
const SAIDA = "tests/laboratorio/saida";
const senha = novaSenha();
const sufixo = novoSufixo();
const dono = { email: `dono.t232.${sufixo}@lab.vivanomads.test`, nome: "Otávio Pedido Rocha", role: "owner" as const };
const inq = { email: `inq.t232.${sufixo}@lab.vivanomads.test`, nome: "Lívia Pedido Mendes", role: "tenant" as const };
const inq2 = { email: `inq2.t232.${sufixo}@lab.vivanomads.test`, nome: "Bruno Pedido Alves", role: "tenant" as const };
const inq3 = { email: `inq3.t232.${sufixo}@lab.vivanomads.test`, nome: "Clara Pedido Souza", role: "tenant" as const };
const ids: Record<string, string | undefined> = {};
const dia = (n: number) => new Date(Date.now() - 3 * 3_600_000 + n * 86_400_000).toISOString().slice(0, 10);
const ENTRADA = dia(20);

async function chaveSms(ligada: boolean) {
  await adm().from("chaves_plataforma").upsert({ chave: "SMS_ATIVO", ligada, ligada_em: ligada ? new Date().toISOString() : null });
}
async function pedidoDireto(inquilinoId: string, extra: Record<string, unknown> = {}): Promise<string> {
  const { data, error } = await adm()
    .from("pedidos_moradia")
    .insert({ inquilino_id: inquilinoId, cidade: "Uberlândia", uf: "MG", data_inicio: ENTRADA, prazo_meses: 3, orcamento_mensal: 3600, qtd_ocupantes: 1, motivo: "trabalho_remoto", bairros: ["Centro"], quartos_min: 1, ...extra })
    .select("id")
    .single();
  expect(error).toBeNull();
  return data!.id as string;
}
async function semRolagemLateral(page: Page) {
  expect(await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth)).toBeLessThanOrEqual(1);
}
async function nasDuasLarguras(page: Page, nome: string, conferir?: () => Promise<void>) {
  for (const largura of [390, 1280]) {
    await page.setViewportSize({ width: largura, height: largura === 390 ? 844 : 900 });
    await semRolagemLateral(page);
    if (conferir) await conferir();
    await page.screenshot({ path: `${SAIDA}/t232-${nome}-${largura}.png`, fullPage: true });
  }
}
async function cartaoDono(page: Page, pedidoId: string) {
  return page.locator(`[data-testid="pedido-dono-cartao"][data-pedido="${pedidoId}"]`);
}
async function abrirAba(page: Page, aba: "novos" | "respondidos" | "ignorados") {
  await page.getByTestId(`aba-${aba}`).click();
  await expect(page.getByTestId(`aba-${aba}`)).toHaveAttribute("aria-selected", "true");
}

test.describe("T232 — pedido de moradia completo", () => {
  test.describe.configure({ mode: "serial", timeout: 240_000 });
  test.skip(!NO_LABORATORIO, "Só no laboratório (banco local + chave de serviço).");

  let inquilino: Page;
  let proprietario: Page;

  test.beforeAll(async ({ browser }: { browser: Browser }) => {
    await chaveSms(false);
    ids.dono = await criarConta(dono, senha);
    ids.inq = await criarConta(inq, senha);
    ids.inq2 = await criarConta(inq2, senha);
    ids.inq3 = await criarConta(inq3, senha);
    ids.imovel = await criarImovelPronto(ids.dono, `Studio Pedido T232 ${sufixo}`, { ativo: true, preco: 3200 });
    // Um imóvel real numa cidade sem outros: a busca mostra 1 real → cartão do pedido.
    ids.imovelPatos = await criarImovelPronto(ids.dono, `Loft Patos T232 ${sufixo}`, { ativo: true, preco: 2800 });
    await adm().from("properties").update({ city: "Patos de Minas", address: "Centro" }).eq("id", ids.imovelPatos);
    inquilino = await entrar(browser, inq.email, senha);
    proprietario = await entrar(browser, dono.email, senha);
  });

  test.afterAll(async () => {
    await chaveSms(false);
    const inquilinos = [ids.inq, ids.inq2, ids.inq3].filter(Boolean) as string[];
    if (inquilinos.length) await adm().from("pedidos_moradia").delete().in("inquilino_id", inquilinos);
    await apagarContas([ids.dono, ids.inq, ids.inq2, ids.inq3]);
  });

  test("1. chave desligada: o inquilino publica com os campos novos e o dono compatível vê em Novos, com selos e sino", async () => {
    const page = inquilino;
    await page.goto(`/pedidos/novo?cidade=Uberl%C3%A2ndia&uf=MG&inicio=${ENTRADA}&meses=3&orcamento=3500`, { waitUntil: "domcontentloaded" });
    await expect(page.getByTestId("pedido-cidade")).toHaveAttribute("data-cidade-escolhida", "1");
    // Desligada: o aviso não pede o telefone.
    await expect(page.getByTestId("pedido-aviso-confirmacao")).toContainText("e-mail confirmado");
    await expect(page.getByTestId("pedido-aviso-confirmacao")).not.toContainText(/telefone/i);
    await expect(page.getByTestId("pedido-validade")).toContainText("30 dias depois de publicar e nunca antes da data de entrada");
    await page.getByTestId("pedido-motivo").selectOption("trabalho_remoto");
    await page.getByTestId("pedido-orcamento-min").fill("2500");
    await page.getByTestId("pedido-bairro").fill("Centro");
    await page.getByTestId("pedido-bairro-adicionar").click();
    await expect(page.getByTestId("pedido-bairros")).toContainText("Centro");
    await page.getByTestId("pedido-quartos-1").click();
    await nasDuasLarguras(page, "formulario");
    await page.getByRole("button", { name: "Publicar pedido" }).click();
    await expect(page.getByRole("heading", { name: "Pedido publicado" })).toBeVisible({ timeout: 30_000 });
    await expect(page.getByTestId("pedido-falta-confirmar")).toHaveCount(0);
    await expect(page.locator("main")).not.toContainText(/confirm\w* (o |seu )?(e-mail e )?telefone/i);

    const { data: p } = await adm()
      .from("pedidos_moradia")
      .select("id, bairros, quartos_min, orcamento_min, orcamento_mensal, expira_em, data_inicio, compativeis_ao_publicar")
      .eq("inquilino_id", ids.inq!)
      .single();
    ids.pedido = p!.id as string;
    expect(p!.bairros).toEqual(["Centro"]);
    expect(p!.quartos_min).toBe(1);
    expect(Number(p!.orcamento_min)).toBe(2500);
    expect(Date.parse(p!.expira_em as string)).toBeGreaterThanOrEqual(Date.parse(`${p!.data_inicio}T23:59:00-03:00`));
    expect(Number(p!.compativeis_ao_publicar)).toBeGreaterThanOrEqual(1);

    const pDono = proprietario;
    await pDono.goto("/dashboard/pedidos-cidade", { waitUntil: "domcontentloaded" });
    const cartao = await cartaoDono(pDono, ids.pedido);
    await expect(cartao).toBeVisible();
    await expect(cartao.getByTestId("selo-email")).toHaveText("E-mail confirmado");
    await expect(cartao.getByTestId("selo-telefone")).toHaveText("Telefone ainda não confirmado");
    await expect(cartao.getByTestId("pedido-faixa")).toHaveText("R$ 2.500 a R$ 3.500");
    await expect(cartao.getByTestId("pedido-nome")).toHaveText("Inquilino(a)");
    await expect(cartao).toContainText("Centro");
    await expect(cartao).toContainText("1 quarto");
    // Nunca contato.
    await expect(cartao).not.toContainText(inq.email);
    await expect(cartao).not.toContainText(TELEFONE_LAB);
    await nasDuasLarguras(pDono, "dono-novos");

    await pDono.goto("/dashboard/notificacoes", { waitUntil: "domcontentloaded" });
    await expect(pDono.getByTestId("avisos-pedidos")).toBeVisible();
    await nasDuasLarguras(pDono, "sino-dono");
  });

  test("2. editar muda o cartão; oferecer leva a Respondidos; o inquilino aceita e a conversa abre (com o nome curto)", async () => {
    const page = inquilino;
    await page.goto("/dashboard/pedidos", { waitUntil: "domcontentloaded" });
    const meu = page.locator(`[data-testid="meu-pedido"][data-pedido="${ids.pedido}"]`);
    await expect(meu).toContainText("R$ 2.500 a R$ 3.500");
    await expect(page.locator("main")).not.toContainText("WhatsApp");
    await meu.getByTestId("pedido-editar").click();
    await expect(page.getByRole("heading", { name: "Editar seu pedido" })).toBeVisible();
    await expect(page.getByTestId("pedido-orcamento")).toHaveValue("3.500", { timeout: 20_000 });
    await page.getByTestId("pedido-orcamento").fill("4000");
    await page.getByRole("button", { name: "Salvar alterações" }).click();
    await page.waitForURL(/\/dashboard\/pedidos\?editado=1/, { timeout: 30_000 });
    await expect(page.getByTestId("pedidos-aviso")).toContainText("Pedido atualizado");
    await expect(page.locator(`[data-testid="meu-pedido"][data-pedido="${ids.pedido}"]`)).toContainText("R$ 2.500 a R$ 4.000");
    await nasDuasLarguras(page, "meus-pedidos");

    const pDono = proprietario;
    await pDono.goto("/dashboard/pedidos-cidade", { waitUntil: "domcontentloaded" });
    const cartao = await cartaoDono(pDono, ids.pedido!);
    await expect(cartao.getByTestId("pedido-faixa")).toHaveText("R$ 2.500 a R$ 4.000");
    await cartao.getByTestId("oferecer-imovel").click();
    await expect(cartao.getByTestId("oferta-form")).toBeVisible();
    await cartao.getByTestId("oferta-imovel").selectOption(ids.imovel!);
    await cartao.getByTestId("oferta-enviar").click();
    await expect(pDono.locator(`[data-testid="pedido-dono-cartao"][data-pedido="${ids.pedido}"]`)).toHaveCount(0, { timeout: 20_000 });
    await abrirAba(pDono, "respondidos");
    await expect((await cartaoDono(pDono, ids.pedido!)).getByTestId("pedido-status-conversa")).toContainText("Oferta enviada");

    await page.goto("/dashboard/pedidos", { waitUntil: "domcontentloaded" });
    await page.locator(`[data-testid="meu-pedido"][data-pedido="${ids.pedido}"]`).getByRole("button", { name: "Aceitar para conversa" }).click();
    await expect(page.locator(`[data-testid="meu-pedido"][data-pedido="${ids.pedido}"]`)).toContainText("Conversa aberta", { timeout: 20_000 });

    await pDono.goto("/dashboard/pedidos-cidade", { waitUntil: "domcontentloaded" });
    await abrirAba(pDono, "respondidos");
    const respondido = await cartaoDono(pDono, ids.pedido!);
    await expect(respondido.getByTestId("pedido-status-conversa")).toContainText("Conversa aberta");
    await expect(respondido.getByTestId("pedido-nome")).toHaveText("Lívia");
    await nasDuasLarguras(pDono, "dono-respondidos");
  });

  test("3. Ignorar com motivo opcional e voltar para Novos", async () => {
    ids.pedido2 = await pedidoDireto(ids.inq2!);
    const pDono = proprietario;
    await pDono.goto("/dashboard/pedidos-cidade", { waitUntil: "domcontentloaded" });
    const cartao = await cartaoDono(pDono, ids.pedido2);
    await expect(cartao).toBeVisible();
    await cartao.getByTestId("ignorar-pedido").click();
    await cartao.getByTestId("ignorar-form").locator("input").fill("Sem imóvel livre nessa data");
    await cartao.getByTestId("ignorar-confirmar").click();
    await expect(pDono.locator(`[data-testid="pedido-dono-cartao"][data-pedido="${ids.pedido2}"]`)).toHaveCount(0, { timeout: 20_000 });
    await abrirAba(pDono, "ignorados");
    const ignorado = await cartaoDono(pDono, ids.pedido2);
    await expect(ignorado).toContainText("Ignorado: Sem imóvel livre nessa data");
    await nasDuasLarguras(pDono, "dono-ignorados");
    await ignorado.getByTestId("voltar-novos").click();
    await expect(pDono.locator(`[data-testid="pedido-dono-cartao"][data-pedido="${ids.pedido2}"]`)).toHaveCount(0, { timeout: 20_000 });
    await abrirAba(pDono, "novos");
    await expect(await cartaoDono(pDono, ids.pedido2)).toBeVisible();
  });

  test("4. excluir: some para o dono, o histórico fica e quem respondeu recebe aviso", async () => {
    const page = inquilino;
    const antes = (await lerSaida()).length;
    await page.goto("/dashboard/pedidos", { waitUntil: "domcontentloaded" });
    const meu = page.locator(`[data-testid="meu-pedido"][data-pedido="${ids.pedido}"]`);
    await meu.getByTestId("pedido-excluir").click();
    await expect(meu.getByTestId("pedido-excluir-confirmacao")).toBeVisible();
    await nasDuasLarguras(page, "excluir-confirmacao");
    await meu.getByTestId("pedido-excluir-confirmar").click();
    await expect(page.locator(`[data-testid="meu-pedido"][data-pedido="${ids.pedido}"]`)).toHaveCount(0, { timeout: 20_000 });
    const { data: linha } = await adm().from("pedidos_moradia").select("status, excluido_em").eq("id", ids.pedido!).single();
    expect(linha!.status).toBe("excluido");
    expect(linha!.excluido_em).toBeTruthy();
    await expect
      .poll(async () => (await lerSaida()).slice(antes).some((l) => l.para === dono.email && /foi encerrado/.test(String(l.assunto))), { timeout: 20_000 })
      .toBe(true);

    const d = proprietario;
    await d.goto("/dashboard/pedidos-cidade", { waitUntil: "domcontentloaded" });
    await expect(d.locator(`[data-testid="pedido-dono-cartao"][data-pedido="${ids.pedido}"]`)).toHaveCount(0);
    await abrirAba(d, "respondidos");
    await expect((await cartaoDono(d, ids.pedido!)).getByTestId("pedido-status-conversa")).toContainText("o pedido foi encerrado");
  });

  test("5. chave ligada pela equipe: pedido novo sem telefone não aparece; o já publicado fica 7 dias e o inquilino é avisado", async ({ browser }) => {
    test.skip(!hasAccount("admin"), "conta de admin do laboratório não configurada");
    const ctx = await browser.newContext({ storageState: authFile("admin") });
    const admin = await ctx.newPage();
    const antes = (await lerSaida()).length;
    await admin.goto("/admin/pedidos", { waitUntil: "domcontentloaded" });
    await expect(admin.getByTestId("chave-sms-estado")).toContainText("Desligada");
    await expect(admin.getByTestId("formulas-pedidos")).toContainText("Com compatível ao publicar =");
    await expect(admin.locator(`[data-testid="admin-pedido-linha"][data-pedido="${ids.pedido2}"]`)).toBeVisible();
    await nasDuasLarguras(admin, "admin-pedidos");
    await admin.getByTestId("chave-sms-trocar").click();
    await admin.getByTestId("chave-sms-confirmar").click();
    await expect(admin.getByTestId("chave-sms-msg")).toContainText("Chave ligada", { timeout: 30_000 });
    await expect
      .poll(async () => (await lerSaida()).slice(antes).some((l) => l.para === inq2.email && /Confirme seu telefone/.test(String(l.assunto))), { timeout: 20_000 })
      .toBe(true);

    // Pedido publicado DEPOIS de ligar, sem telefone confirmado: fora do mural.
    ids.pedido3 = await pedidoDireto(ids.inq3!);
    const d = proprietario;
    await d.goto("/dashboard/pedidos-cidade", { waitUntil: "domcontentloaded" });
    await expect(await cartaoDono(d, ids.pedido2!)).toBeVisible();
    await expect(d.locator(`[data-testid="pedido-dono-cartao"][data-pedido="${ids.pedido3}"]`)).toHaveCount(0);

    // Desligar volta na hora.
    await admin.goto("/admin/pedidos", { waitUntil: "domcontentloaded" });
    await admin.getByTestId("chave-sms-trocar").click();
    await admin.getByTestId("chave-sms-confirmar").click();
    await expect(admin.getByTestId("chave-sms-msg")).toContainText("Chave desligada", { timeout: 30_000 });
    await d.goto("/dashboard/pedidos-cidade", { waitUntil: "domcontentloaded" });
    await expect(await cartaoDono(d, ids.pedido3)).toBeVisible();
    await ctx.close();
  });

  test("6. portas: 'Publicar pedido' na busca (inclusive barra condensada), cartão com menos de 3 reais, home e menu", async ({ browser }) => {
    const ctx = await browser.newContext({ storageState: { cookies: [], origins: [] } });
    const page = await ctx.newPage();
    for (const largura of [390, 1280]) {
      await page.setViewportSize({ width: largura, height: largura === 390 ? 844 : 900 });
      await page.goto("/buscar?local=Patos%20de%20Minas", { waitUntil: "domcontentloaded" });
      const cartao = page.getByTestId("busca-cartao-pedido");
      await expect(cartao).toContainText("Não achou? Publique um pedido e os proprietários vêm até você");
      expect(decodeURIComponent((await cartao.locator("a").getAttribute("href")) ?? "")).toContain("cidade=Patos de Minas");
      await expect(page.getByTestId(largura === 390 ? "busca-publicar-pedido" : "busca-publicar-pedido-topo").first()).toBeVisible();
      await expect(page.locator('[data-testid="card-resultado"]')).toHaveCount(1);
      await semRolagemLateral(page);
      await page.screenshot({ path: `${SAIDA}/t232-busca-${largura}.png`, fullPage: true });
      await page.goto("/", { waitUntil: "domcontentloaded" });
      await expect(page.getByTestId("home-publicar-pedido")).toBeVisible();
      await semRolagemLateral(page);
    }
    await ctx.close();
    await inquilino.setViewportSize({ width: 1280, height: 900 });
    await inquilino.goto("/dashboard", { waitUntil: "domcontentloaded" });
    // O item fica dentro de "Minha moradia" (o grupo pode estar fechado): basta existir no menu.
    await expect(inquilino.locator('a[href="/pedidos/novo"]', { hasText: "Publicar pedido de moradia" })).not.toHaveCount(0);
  });
});
