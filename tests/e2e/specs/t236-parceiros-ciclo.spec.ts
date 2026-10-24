import { test, expect, type Browser, type Page } from "@playwright/test";
import { NO_LABORATORIO, adm, apagarContas, cpfAleatorio, criarConta, criarImovelPronto, entrar, lerSaida, novaSenha, novoSufixo } from "../fixtures/laboratorio";
import { jpegComGps } from "../fixtures/exif";
import { metadadoNoDeposito } from "../fixtures/exif-deposito";
import { authFile } from "../fixtures/auth";

/*
  T236 — Parceiros, ciclo 31a (390 e 1280 px), laboratório:
   1. visitante: "Seja parceiro" pede conta (vai ao cadastro e volta); regras claras com "Pagamento pela plataforma
      em breve." (chave PAGAMENTO_PARCEIROS_ATIVO desligada);
   2. conta com e-mail confirmado → pedido (fotografia, Uberlândia, PF, CPF válido, portfólio) → "Recebemos" + e-mail;
   3. admin em AAL2: ficha com checklist → Aprovar → e-mail "Sua parceria foi aprovada" com o link de ativação;
   4. link → ativa (mesmo e-mail) → cadastro completo: foto, capa, 3 fotos na galeria, serviço, redes → Publicar;
   5. /parceiros/[slug] no ar (sem telefone, e-mail ou documento) e na busca ?categoria=fotografia&cidade=Uberlândia;
      conta de teste sai da busca pública (e o admin vê);
   6. extras: recusa com motivo; dono vira parceiro na mesma conta; link usado/vencido; outra conta não ativa;
      busca vazia com avise-me e o cartão do parceiro geral (ligado pelo admin); nenhum window.confirm.
*/
const senha = novaSenha();
const sufixo = novoSufixo();
const foto = { email: `foto.t236.${sufixo}@lab.vivanomads.test`, nome: "Marina Lente Prado", role: "tenant" as const };
const recusado = { email: `rec.t236.${sufixo}@lab.vivanomads.test`, nome: "Otávio Recusa Lima", role: "tenant" as const };
const dono = { email: `dono.t236.${sufixo}@lab.vivanomads.test`, nome: "Sara Dona Mudança", role: "owner" as const };
const outro = { email: `outro.t236.${sufixo}@lab.vivanomads.test`, nome: "Caio Outra Conta", role: "tenant" as const };
// Começo da spec (com folga para o relógio do Storage): o teste de EXIF só confere o que esta execução enviou.
const INICIO = new Date(Date.now() - 60_000);
const ids: Record<string, string | undefined> = {};
let slug = "";
let linkAtivacao = "";

async function semRolagemLateral(page: Page) {
  expect(await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth)).toBeLessThanOrEqual(1);
}

/** Nenhuma tela do ciclo pode usar window.confirm/alert: se aparecer um diálogo, o teste falha. */
function semDialogo(page: Page) {
  page.on("dialog", (d) => {
    throw new Error(`diálogo do navegador não permitido: ${d.type()} ${d.message()}`);
  });
}

async function abrir(browser: Browser, email: string, largura: number) {
  const page = await entrar(browser, email, senha);
  await page.setViewportSize({ width: largura, height: largura === 390 ? 844 : 900 });
  semDialogo(page);
  return page;
}

async function admin(browser: Browser, largura = 1280) {
  const ctx = await browser.newContext({ storageState: authFile("admin"), viewport: { width: largura, height: 900 } });
  const page = await ctx.newPage();
  semDialogo(page);
  return page;
}

async function pedir(page: Page, o: { categorias: string[]; portfolio?: string; descricao?: string; empresa?: string; veiculo?: string }) {
  await page.goto("/parceiros#quero-ser-parceiro", { waitUntil: "domcontentloaded" });
  const form = page.getByTestId("seja-parceiro-form");
  await expect(form).toBeVisible({ timeout: 20_000 });
  await form.locator("#sp-doc").fill(cpfAleatorio());
  for (const c of o.categorias) await page.getByTestId(`sp-cat-${c}`).check();
  await form.locator("#sp-cidades").fill("Uberlândia");
  if (o.portfolio) await form.locator("#sp-portfolio").fill(o.portfolio);
  if (o.empresa) await form.locator("#sp-empresa").fill(o.empresa);
  if (o.veiculo) await form.locator("#sp-veiculo").fill(o.veiculo);
  if (o.descricao) await form.locator("#sp-descricao").fill(o.descricao);
  await page.getByTestId("sp-aceite").check();
  await page.getByTestId("seja-parceiro-enviar").click();
  await expect(page.getByTestId("seja-parceiro-recebido")).toContainText("Aguardando aprovação da Viva. Resposta em até 1 dia útil, por e-mail.", { timeout: 20_000 }); // texto do Prompt 43 (e21e4416)
}

async function solicitacao(email: string) {
  const { data } = await adm().from("parceiro_solicitacoes").select("id, status, origem, documento, motivo_recusa, token_expira_em").eq("email", email).order("criado_em", { ascending: false }).limit(1).maybeSingle();
  return data as Record<string, string | null> | null;
}

async function aprovarPeloAdmin(browser: Browser, email: string, largura = 1280) {
  const page = await admin(browser, largura);
  await page.goto("/admin/parceiros?aba=pendentes", { waitUntil: "domcontentloaded" });
  const ficha = page.locator(`[data-testid="ficha-parceria"][data-email="${email}"]`);
  await expect(ficha).toBeVisible({ timeout: 20_000 });
  await expect(ficha.getByTestId("ficha-identidade")).toBeVisible();
  await expect(ficha.getByTestId("ficha-aprovar")).toBeDisabled();
  for (const item of ["identidade", "documento", "area", "categoria"]) {
    await ficha.getByTestId(`check-${item}`).click();
    await expect(ficha.getByTestId(`check-${item}`)).toBeChecked({ timeout: 15_000 });
  }
  await expect(ficha).toContainText("conferido em");
  await ficha.getByTestId("ficha-aprovar").click();
  await ficha.getByTestId("ficha-aprovar-confirmar").click();
  await expect.poll(async () => (await solicitacao(email))?.status, { timeout: 20_000 }).toBe("aprovada");
  await page.context().close();
}

async function linkDoEmail(email: string): Promise<string> {
  let link = "";
  await expect
    .poll(
      async () => {
        const m = (await lerSaida()).filter((e) => e.para === email && /Sua parceria foi aprovada/.test(String(e.assunto)));
        const corpo = String(m.at(-1)?.corpo ?? "");
        link = /\/parceiros\/ativar\?t=([A-Za-z0-9_%-]+)/.exec(corpo)?.[0] ?? "";
        return link;
      },
      { timeout: 20_000 },
    )
    .not.toBe("");
  return link;
}

test.describe("T236 — parceiros: funil, ativação, página, busca e textos", () => {
  test.skip(!NO_LABORATORIO, "Só no laboratório (Supabase local + integrações simuladas).");
  test.describe.configure({ mode: "serial" });

  test.beforeAll(async () => {
    // O pedido tem limite por IP (5/h); no laboratório todos os pedidos saem do mesmo IP.
    await adm().from("limites_uso").delete().like("chave", "parceria:%");
    ids.foto = await criarConta(foto, senha);
    ids.recusado = await criarConta(recusado, senha);
    ids.dono = await criarConta(dono, senha);
    ids.outro = await criarConta(outro, senha);
    ids.imovel = await criarImovelPronto(ids.dono, `Studio T236 ${sufixo}`, { ativo: true, preco: 3000 });
  });

  test.afterAll(async () => {
    for (const id of [ids.foto, ids.dono]) {
      if (!id) continue;
      const { data: p } = await adm().from("parceiros").select("id").eq("user_id", id).maybeSingle();
      if (p) await adm().from("parceiros").delete().eq("id", p.id);
    }
    await adm().from("parceiro_solicitacoes").delete().in("email", [foto.email, recusado.email, dono.email, outro.email]);
    await adm().from("chaves_plataforma").update({ ligada: false, valor: { nome: "", cidade: "", descricao: "" } }).eq("chave", "PARCEIRO_GERAL_FALLBACK");
    await apagarContas([ids.foto, ids.recusado, ids.dono, ids.outro]);
  });

  for (const largura of [390, 1280]) {
    test(`${largura}px: visitante — "Seja parceiro" pede a conta e volta; regras claras com pagamento em breve`, async ({ page }) => {
      semDialogo(page);
      await page.setViewportSize({ width: largura, height: largura === 390 ? 844 : 900 });
      await page.goto("/parceiros", { waitUntil: "domcontentloaded" });
      const regras = page.getByTestId("taxa-servico-parceiros");
      await expect(regras).toContainText("Você combina e agenda tudo pelas mensagens da Viva.");
      await expect(regras).toContainText("Taxa de serviço: 10% sobre o valor do serviço, para todas as categorias. Você só paga quando há serviço contratado.");
      await expect(regras).toContainText("90% vai direto para você e 10% para a Viva. A Viva não guarda o seu dinheiro.");
      await expect(page.getByTestId("pagamento-em-breve")).toHaveText("Pagamento pela plataforma em breve.");
      const corpo = (await page.locator("main").innerText()).toLowerCase();
      for (const p of ["retém", "repass", "intermedia", "comissão", "whatsapp", "r$ 40", "r$ 60", "r$ 80"]) expect(corpo, p).not.toContain(p);
      await expect(page.getByTestId("seja-parceiro-precisa-conta")).toBeVisible();
      await page.locator("#sp-nome").fill("Visitante Fotógrafo");
      await page.getByTestId("seja-parceiro-enviar").click();
      await page.waitForURL(/\/auth\?cadastro=1&redirect=/, { timeout: 15_000 });
      expect(decodeURIComponent(page.url())).toContain("/parceiros?seja=1#quero-ser-parceiro");
      await semRolagemLateral(page);
      await page.screenshot({ path: `tests/laboratorio/saida/t236-parceiros-${largura}.png`, fullPage: false });
    });
  }

  test("390px: conta com e-mail confirmado pede a parceria (fotografia, Uberlândia, PF, CPF, portfólio)", async ({ browser }) => {
    const page = await abrir(browser, foto.email, 390);
    // CPF inválido é barrado na tela e no servidor.
    await page.goto("/parceiros#quero-ser-parceiro", { waitUntil: "domcontentloaded" });
    await page.locator("#sp-doc").fill("111.111.111-11");
    await page.getByTestId("sp-cat-fotografia").check();
    await page.locator("#sp-cidades").fill("Uberlândia");
    await page.locator("#sp-portfolio").fill("https://marinalente.com.br");
    await page.getByTestId("sp-aceite").check();
    await page.getByTestId("seja-parceiro-enviar").click();
    await expect(page.getByTestId("seja-parceiro-erro")).toContainText("CPF inválido");
    await pedir(page, { categorias: ["fotografia"], portfolio: "https://marinalente.com.br" });
    const s = await solicitacao(foto.email);
    expect(s?.status).toBe("pendente");
    expect(s?.origem).toBe("site");
    expect(s?.documento).toMatch(/^\d{11}$/);
    await expect.poll(async () => (await lerSaida()).some((e) => e.para === foto.email && /Recebemos o seu pedido de parceria/.test(String(e.assunto))), { timeout: 15_000 }).toBe(true);
    // Uma solicitação aberta por conta: o formulário mostra o andamento, não um segundo pedido.
    await page.goto("/parceiros#quero-ser-parceiro", { waitUntil: "domcontentloaded" });
    await expect(page.getByTestId("seja-parceiro-recebido")).toBeVisible();
    // Menu "Parceiro" aparece para quem tem pedido.
    await page.goto("/dashboard/parceiro", { waitUntil: "domcontentloaded" });
    await expect(page.getByTestId("seja-parceiro-recebido")).toBeVisible({ timeout: 20_000 });
    await semRolagemLateral(page);
    await page.screenshot({ path: "tests/laboratorio/saida/t236-pedido-390.png" });
    await page.context().close();
  });

  test("1280px: admin em AAL2 confere o checklist e aprova → e-mail de ativação (link só no botão)", async ({ browser }) => {
    await aprovarPeloAdmin(browser, foto.email, 1280);
    linkAtivacao = await linkDoEmail(foto.email);
    expect(linkAtivacao).toMatch(/^\/parceiros\/ativar\?t=/);
    const page = await admin(browser, 1280);
    await page.goto("/admin/parceiros?aba=aprovadas", { waitUntil: "domcontentloaded" });
    await expect(page.locator(`[data-testid="linha-aprovada"][data-email="${foto.email}"]`)).toBeVisible();
    await page.screenshot({ path: "tests/laboratorio/saida/t236-admin-aprovadas-1280.png" });
    await page.context().close();
  });

  test("390px: outra conta não ativa; a conta certa ativa e completa o cadastro → publica", async ({ browser }) => {
    test.setTimeout(240_000);
    const intrusa = await abrir(browser, outro.email, 390);
    await intrusa.goto(linkAtivacao, { waitUntil: "domcontentloaded" });
    await expect(intrusa.getByTestId("ativar-outro-email")).toBeVisible({ timeout: 20_000 });
    await intrusa.context().close();
    expect((await solicitacao(foto.email))?.status).toBe("aprovada");

    const page = await abrir(browser, foto.email, 390);
    await page.goto(linkAtivacao, { waitUntil: "domcontentloaded" });
    await page.getByTestId("ativar-confirmar").click();
    await page.waitForURL(/\/dashboard\/parceiro\?ativada=1/, { timeout: 20_000 });
    await expect(page.getByTestId("parceiro-ativada")).toBeVisible();
    await expect(page.getByTestId("parceiro-status")).toContainText("Rascunho");
    await expect(page.getByTestId("parceiro-publicar")).toBeDisabled();
    const { data: p } = await adm().from("parceiros").select("slug, status").eq("user_id", ids.foto).single();
    slug = p!.slug as string;
    expect(p!.status).toBe("rascunho");

    // Página: foto, capa, 3 fotos na galeria (com legenda), apresentação e redes.
    await page.getByTestId("parceiro-enviar-avatar-arquivo").setInputFiles({ name: "foto.jpg", mimeType: "image/jpeg", buffer: await jpegComGps(1, 900, 700) }); // com GPS: ver o último cenário
    await expect(page.getByTestId("parceiro-avatar-previa")).toBeVisible({ timeout: 20_000 });
    await page.getByTestId("parceiro-enviar-banner-arquivo").setInputFiles({ name: "capa.jpg", mimeType: "image/jpeg", buffer: await jpegComGps(2, 1500, 600) });
    await expect(page.getByTestId("parceiro-banner-previa")).toBeVisible({ timeout: 20_000 });
    for (let i = 0; i < 3; i++) {
      await page.locator("#pp-legenda").fill(`Sala mobiliada ${i + 1}`);
      await page.getByTestId("parceiro-enviar-galeria-arquivo").setInputFiles({ name: `g${i}.jpg`, mimeType: "image/jpeg", buffer: await jpegComGps(3 + i, 800, 600) });
      await expect(page.getByTestId("parceiro-foto-galeria")).toHaveCount(i + 1, { timeout: 20_000 });
    }
    await page.locator("#pp-curta").fill("Fotos de imóveis mobiliados em Uberlândia.");
    await page.locator("#pp-descricao").fill("Fotografo imóveis mobiliados há 8 anos, com luz natural e edição leve. Entrego em até 3 dias.");
    await page.locator("#pp-instagram").fill("instagram.com/marinalente");
    await page.locator("#pp-site").fill("javascript:alert(1)");
    await page.getByTestId("parceiro-salvar-pagina").click();
    await expect(page.getByTestId("parceiro-msg")).toContainText("Site: endereço inválido");
    await page.locator("#pp-site").fill("marinalente.com.br");
    await page.getByTestId("parceiro-salvar-pagina").click();
    await expect(page.getByTestId("parceiro-msg")).toHaveText("Salvo.", { timeout: 15_000 });

    // Serviço (preço) e atendimento.
    await page.getByTestId("parceiro-aba-servicos").click();
    await page.locator("#sv-titulo").fill("Ensaio do imóvel (20 fotos)");
    await page.locator("#sv-descricao").fill("Fotos de todos os cômodos, editadas.");
    await page.locator("#sv-preco").fill("450");
    await page.locator("#sv-prazo").fill("3");
    await page.getByTestId("parceiro-salvar-servico").click();
    await expect(page.getByTestId("parceiro-servicos-lista")).toContainText("R$ 450 por serviço", { timeout: 15_000 });

    await page.getByTestId("parceiro-aba-dados").click();
    await expect(page.getByTestId("recebimento-em-breve")).toContainText("Pagamento pela plataforma em breve.");
    await expect(page.getByTestId("parceiro-documento")).toContainText("•••");

    await expect(page.getByTestId("parceiro-publicar")).toBeEnabled({ timeout: 15_000 });
    await page.getByTestId("parceiro-publicar").click();
    await expect(page.getByTestId("parceiro-status")).toContainText("Publicada", { timeout: 15_000 });
    await semRolagemLateral(page);
    await page.screenshot({ path: "tests/laboratorio/saida/t236-painel-390.png" });
    // Menu do painel: item "Parceiro".
    await page.setViewportSize({ width: 1280, height: 900 });
    await page.goto("/dashboard/parceiro", { waitUntil: "domcontentloaded" });
    await expect(page.locator('a[href="/dashboard/parceiro"]').first()).toBeAttached({ timeout: 15_000 });
    await semRolagemLateral(page);
    await page.screenshot({ path: "tests/laboratorio/saida/t236-painel-1280.png" });
    await page.context().close();
  });

  test("link já usado: 'Este link já foi usado.'; vencido: 'Peça um novo link' avisa a equipe", async ({ page }) => {
    semDialogo(page);
    await page.goto(linkAtivacao, { waitUntil: "domcontentloaded" });
    await expect(page.getByTestId("ativar-invalido")).toHaveAttribute("data-situacao", "usado");
    await page.goto("/parceiros/ativar?t=xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx", { waitUntil: "domcontentloaded" });
    await expect(page.getByTestId("ativar-invalido")).toHaveAttribute("data-situacao", "invalido");
  });

  for (const largura of [390, 1280]) {
    test(`${largura}px: /parceiros/[slug] no ar e na busca de fotografia em Uberlândia`, async ({ page }) => {
      semDialogo(page);
      await page.setViewportSize({ width: largura, height: largura === 390 ? 844 : 900 });
      await page.goto(`/parceiros/${slug}`, { waitUntil: "domcontentloaded" });
      const pg = page.getByTestId("pagina-parceiro");
      await expect(pg).toBeVisible();
      await expect(page.getByRole("heading", { level: 1 })).toHaveText(foto.nome);
      await expect(page.getByTestId("parceiro-nota")).toContainText("Novo na Viva");
      await expect(page.getByTestId("parceiro-galeria").locator("img")).toHaveCount(3);
      await expect(page.getByTestId("parceiro-servicos")).toContainText("R$ 450 por serviço");
      const insta = page.getByTestId("parceiro-redes").getByRole("link", { name: "Instagram" });
      await expect(insta).toHaveAttribute("rel", /noopener/);
      await expect(insta).toHaveAttribute("rel", /nofollow/);
      await expect(page.getByTestId("solicitar-orcamento")).toBeVisible();
      const html = await page.content();
      expect(html).not.toContain(foto.email);
      expect(html).not.toMatch(/99999-?1234/);
      const { data: doc } = await adm().from("parceiros").select("documento").eq("user_id", ids.foto).single();
      expect(html).not.toContain(doc!.documento as string);
      await semRolagemLateral(page);
      await page.screenshot({ path: `tests/laboratorio/saida/t236-pagina-${largura}.png`, fullPage: false });

      await page.goto("/parceiros/buscar?categoria=fotografia&cidade=Uberl%C3%A2ndia", { waitUntil: "domcontentloaded" });
      await expect(page.locator(`[data-testid="cartao-parceiro"][data-slug="${slug}"]`)).toBeVisible();
      await page.goto("/parceiros/fotografos?cidade=Uberl%C3%A2ndia", { waitUntil: "domcontentloaded" });
      await expect(page.locator(`[data-testid="cartao-parceiro"][data-slug="${slug}"]`)).toBeVisible();
      await expect(page.getByTestId("taxa-servico-parceiros")).toContainText("A Viva não guarda o seu dinheiro.");
      await expect(page.getByTestId("fotografos-contato-aceite")).toContainText("só depois do aceite");
      await semRolagemLateral(page);
      await page.screenshot({ path: `tests/laboratorio/saida/t236-busca-${largura}.png`, fullPage: false });
    });
  }

  test("conta de teste: fora da busca pública e noindex; o admin vê a marcação", async ({ browser, page }) => {
    await adm().from("profiles").update({ is_teste: true }).eq("id", ids.foto);
    await page.goto("/parceiros/buscar?categoria=fotografia&cidade=Uberl%C3%A2ndia", { waitUntil: "domcontentloaded" });
    await expect(page.locator(`[data-testid="cartao-parceiro"][data-slug="${slug}"]`)).toHaveCount(0);
    await page.goto(`/parceiros/${slug}`, { waitUntil: "domcontentloaded" });
    await expect(page.locator('meta[name="robots"]')).toHaveAttribute("content", /noindex/);
    const a = await admin(browser, 1280);
    await a.goto("/admin/parceiros?aba=ativas", { waitUntil: "domcontentloaded" });
    await expect(a.locator(`[data-testid="linha-ativa"][data-slug="${slug}"]`)).toContainText("fora da busca pública");
    await a.context().close();
    await adm().from("profiles").update({ is_teste: false }).eq("id", ids.foto);
  });

  test("recusa com motivo: e-mail com o motivo; a conta continua normal", async ({ browser }) => {
    const page = await abrir(browser, recusado.email, 1280);
    await pedir(page, { categorias: ["limpeza"], descricao: "Limpeza de saída e faxina semanal." });
    const a = await admin(browser, 390);
    await a.goto("/admin/parceiros?aba=pendentes", { waitUntil: "domcontentloaded" });
    const ficha = a.locator(`[data-testid="ficha-parceria"][data-email="${recusado.email}"]`);
    await expect(ficha.getByTestId("ficha-recusar")).toBeDisabled();
    await ficha.getByTestId("ficha-modelo-recusa").selectOption({ index: 2 });
    await ficha.getByTestId("ficha-recusar").click();
    await ficha.getByTestId("ficha-recusar-confirmar").click();
    await expect.poll(async () => (await solicitacao(recusado.email))?.status, { timeout: 20_000 }).toBe("recusada");
    await semRolagemLateral(a);
    await a.context().close();
    await expect.poll(async () => (await lerSaida()).some((e) => e.para === recusado.email && /Sobre o seu pedido de parceria/.test(String(e.assunto)) && /Motivo:/.test(String(e.corpo))), { timeout: 15_000 }).toBe(true);
    await page.goto("/dashboard/parceiro", { waitUntil: "domcontentloaded" });
    await expect(page.getByTestId("parceiro-recusado")).toBeVisible();
    await page.goto("/dashboard", { waitUntil: "domcontentloaded" });
    await expect(page).toHaveURL(/\/dashboard$/);
    await page.context().close();
  });

  test("dono vira parceiro na mesma conta (mudança) e continua com os imóveis; link vencido pede novo", async ({ browser }) => {
    const page = await abrir(browser, dono.email, 390);
    await page.goto("/dashboard/conta/papeis", { waitUntil: "domcontentloaded" });
    await page.setViewportSize({ width: 1280, height: 900 });
    await page.goto("/dashboard/conta/papeis", { waitUntil: "domcontentloaded" });
    // Prompt 43: o painel "Quero ser parceiro" virou o convite da linha de parceiro em "Seus papéis".
    const convite = page.getByTestId("seus-papeis").locator('[data-papel="parceiro"]').getByRole("link", { name: "Quero ser parceiro" });
    await expect(convite).toHaveAttribute("href", "/dashboard/parceiro", { timeout: 20_000 });
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto("/dashboard/parceiro", { waitUntil: "domcontentloaded" });
    const form = page.getByTestId("seja-parceiro-form");
    await form.locator("#sp-doc").fill(cpfAleatorio());
    await page.getByTestId("sp-cat-mudanca").check();
    await form.locator("#sp-cidades").fill("Uberlândia");
    await form.locator("#sp-empresa").fill("Sara Mudanças");
    await form.locator("#sp-veiculo").fill("Baú 3/4");
    await page.getByTestId("sp-aceite").check();
    await page.getByTestId("seja-parceiro-enviar").click();
    await expect(page.getByTestId("seja-parceiro-recebido")).toBeVisible({ timeout: 20_000 });
    expect((await solicitacao(dono.email))?.origem).toBe("conta");
    await aprovarPeloAdmin(browser, dono.email, 390);
    const link = await linkDoEmail(dono.email);
    // Vencido: "Peça um novo link" avisa a equipe e não ativa nada.
    await adm().from("parceiro_solicitacoes").update({ token_expira_em: new Date(Date.now() - 60_000).toISOString() }).eq("email", dono.email);
    await page.goto(link, { waitUntil: "domcontentloaded" });
    await expect(page.getByTestId("ativar-invalido")).toHaveAttribute("data-situacao", "vencido");
    await page.getByTestId("ativar-novo-link").click();
    await expect(page.getByTestId("ativar-novo-link-ok")).toBeVisible({ timeout: 15_000 });
    expect((await solicitacao(dono.email))?.status).toBe("aprovada");
    // Reenviar ativação pelo admin: o link novo vale; o antigo, não.
    const a = await admin(browser, 1280);
    await a.goto("/admin/parceiros?aba=aprovadas", { waitUntil: "domcontentloaded" });
    const linha = a.locator(`[data-testid="linha-aprovada"][data-email="${dono.email}"]`);
    await expect(linha).toContainText("pediu novo link");
    await linha.getByTestId("reenviar-ativacao").click();
    await linha.getByTestId("reenviar-ativacao-confirmar").click();
    await expect.poll(async () => (await linkDoEmail(dono.email)) !== link, { timeout: 20_000 }).toBe(true);
    await a.context().close();
    const novo = await linkDoEmail(dono.email);
    await page.goto(link, { waitUntil: "domcontentloaded" });
    await expect(page.getByTestId("ativar-invalido")).toHaveAttribute("data-situacao", "invalido");
    await page.goto(novo, { waitUntil: "domcontentloaded" });
    await page.getByTestId("ativar-confirmar").click();
    await page.waitForURL(/\/dashboard\/parceiro\?ativada=1/, { timeout: 20_000 });
    await page.goto("/dashboard/imoveis", { waitUntil: "domcontentloaded" });
    await expect(page.getByText(`Studio T236 ${sufixo}`).first()).toBeVisible({ timeout: 20_000 });
    await page.context().close();
  });

  for (const largura of [390, 1280]) {
    test(`${largura}px: busca vazia — avise-me, "Indique um profissional" e o cartão do parceiro geral (ligado pelo admin)`, async ({ browser, page }) => {
      semDialogo(page);
      await page.setViewportSize({ width: largura, height: largura === 390 ? 844 : 900 });
      const url = "/parceiros/buscar?categoria=lavanderia&cidade=Itapagipe&uf=MG";
      await page.goto(url, { waitUntil: "domcontentloaded" });
      await expect(page.getByTestId("busca-parceiros-vazia")).toBeVisible();
      await expect(page.getByTestId("aviso-fotografo")).toBeVisible();
      await expect(page.getByTestId("indique-profissional")).toBeVisible();
      if (largura === 390) {
        await expect(page.getByTestId("parceiro-geral")).toHaveCount(0); // desligado por padrão
        const a = await admin(browser, 1280);
        await a.goto("/admin/parceiros", { waitUntil: "domcontentloaded" });
        const g = a.getByTestId("parceiro-geral-admin");
        await g.getByLabel("Nome").fill("AquiResolve");
        await g.getByLabel("Cidade").fill("Uberlândia");
        await g.getByLabel("Descrição").fill("Pequenos reparos e serviços gerais para imóveis mobiliados.");
        await g.getByRole("switch").click();
        await g.getByTestId("parceiro-geral-salvar").click();
        await expect(g.getByTestId("admin-parceria-msg")).toHaveText("Salvo.", { timeout: 15_000 });
        await expect(a.getByTestId("chave-pagamento-parceiros")).toContainText("desligada");
        await a.context().close();
      }
      await page.goto(url, { waitUntil: "domcontentloaded" });
      await expect(page.getByTestId("parceiro-geral")).toContainText("AquiResolve");
      await expect(page.getByTestId("parceiro-geral").locator("img")).toHaveCount(0); // sem logo de terceiros
      await semRolagemLateral(page);
      await page.screenshot({ path: `tests/laboratorio/saida/t236-busca-vazia-${largura}.png`, fullPage: false });
    });
  }

  test("portas: etapa de fotos do anúncio e a seção Serviços do painel levam à busca", async ({ browser }) => {
    const page = await abrir(browser, dono.email, 390);
    await page.goto("/dashboard", { waitUntil: "domcontentloaded" });
    const servicos = page.getByTestId("painel-servicos-parceiros");
    await expect(servicos).toBeVisible({ timeout: 20_000 });
    await expect(servicos.getByTestId("servicos-fotografia")).toHaveAttribute("href", /\/parceiros\/buscar\?categoria=fotografia/);
    await page.context().close();
  });

  // Estudo de segurança (22/10): o depósito "parceiros" é PÚBLICO.
  test("EXIF/GPS: foto, capa e galeria enviadas com GPS ficam sem metadado no depósito público 'parceiros'", async () => {
    const { data } = await adm().from("parceiros").select("id").eq("user_id", ids.foto!).maybeSingle();
    test.skip(!data, "o cenário de ativação não chegou a criar o parceiro");
    const r = await metadadoNoDeposito("parceiros", data!.id as string, INICIO);
    expect(r.conferidas, "foto, capa e galeria deveriam estar no depósito").toBeGreaterThan(0);
    expect(r.problemas, "foto enviada com EXIF e GPS tem de ser guardada limpa").toEqual([]);
  });
});
