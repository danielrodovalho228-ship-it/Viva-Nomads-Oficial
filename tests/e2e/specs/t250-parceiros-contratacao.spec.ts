import { test, expect, type Browser, type Page } from "@playwright/test";
import { authFile } from "../fixtures/auth";
import { hasAccount } from "../fixtures/accounts";
import { NO_LABORATORIO, adm, apagarContas, cpfAleatorio, criarConta, criarImovelPronto, entrar, novaSenha, novoSufixo } from "../fixtures/laboratorio";
import { jpegComGps } from "../fixtures/exif";
import { metadadoNoDeposito } from "../fixtures/exif-deposito";

/**
 * T250 — Contratação de parceiros (Prompt 31b), 390 e 1280 px, só no laboratório.
 * Roteiro principal: o dono pede orçamento a um fotógrafo pelo passo de fotos do cadastro (fotógrafos da cidade com o
 * imóvel junto) → a conversa abre → o parceiro orça (vê os 10% e o líquido) e não vê o endereço → o dono aceita →
 * horário confirmado → "Simular pagamento" (90/10 registrado, sem dinheiro) → em execução → entrega das fotos →
 * "Usar estas fotos no anúncio" → concluir → as duas avaliações (publicadas, nota na página do parceiro).
 * Mais: 4º pedido aberto na mesma categoria bloqueado; o parceiro recusa; chave desligada sem botão de pagar;
 * o morador pede limpeza por /dashboard/servicos; pedido vindo do cartão grava a ref e o admin vê 1; sem diálogos.
 */
const SAIDA = "tests/laboratorio/saida";
const senha = novaSenha();
const sufixo = novoSufixo();
const slugFoto = `fotos-t250-${sufixo}`;
const slugLimpa = `limpa-t250-${sufixo}`;
const dono = { email: `dono.t250.${sufixo}@lab.vivanomads.test`, nome: "Dora Contrata", role: "owner" as const };
const morador = { email: `mor.t250.${sufixo}@lab.vivanomads.test`, nome: "Mauro Morador", role: "tenant" as const };
const fotografo = { email: `foto.t250.${sufixo}@lab.vivanomads.test`, nome: "Fabi Fotografa", role: "owner" as const };
const limpeza = { email: `limpa.t250.${sufixo}@lab.vivanomads.test`, nome: "Lia Limpeza", role: "owner" as const };
// Começo da spec (com folga para o relógio do Storage): o teste de EXIF só confere o que esta execução enviou.
const INICIO = new Date(Date.now() - 60_000);
async function marcarTeste(contas: string[], teste: boolean) {
  const { error } = await adm().from("profiles").update({ is_teste: teste }).in("id", contas);
  if (error) throw error;
}

/** E204: o último e-mail do evento na caixa de QA (emails_teste) da conta. */
async function emailDoEvento(usuarioId: string, evento: string): Promise<string> {
  for (let i = 0; i < 30; i++) {
    const { data } = await adm().from("emails_teste").select("corpo").eq("usuario_id", usuarioId).eq("evento", evento).order("criado_em", { ascending: false }).limit(1);
    const corpo = String(data?.[0]?.corpo ?? "");
    if (corpo) return corpo;
    await new Promise((r) => setTimeout(r, 1000));
  }
  throw new Error(`sem e-mail ${evento} na caixa de teste`);
}

const ids: { dono?: string; morador?: string; foto?: string; limpa?: string; parceiroFoto?: string; parceiroLimpa?: string; imovel?: string; pedido?: string; contrato?: string } = {};

function semDialogo(page: Page) {
  page.on("dialog", (d) => {
    throw new Error(`diálogo do navegador não permitido: ${d.type()} ${d.message()}`);
  });
}
async function semRolagemLateral(page: Page) {
  expect(await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth)).toBeLessThanOrEqual(1);
}
/** Diagnóstico: navegações, ações do servidor (status e início da resposta) e erros, impressos só quando o teste falha. */
const registro: string[] = [];
function registrar(page: Page, quem: string) {
  const t0 = Date.now();
  const marca = (x: string) => registro.push(`[${quem} +${((Date.now() - t0) / 1000).toFixed(1)}s] ${x}`);
  page.on("console", (m) => {
    if (m.type() === "error" || m.type() === "warning") marca(`console.${m.type()}: ${m.text()}`);
  });
  page.on("pageerror", (e) => marca(`pageerror: ${e.message}`));
  page.on("response", (r) => {
    if (r.status() >= 400) marca(`resposta ${r.status()} ${r.request().method()} ${r.url()} rsc=${r.request().headers()["rsc"] ?? "-"} prefetch=${r.request().headers()["next-router-prefetch"] ?? "-"}`);
  });
  page.on("requestfailed", (r) => marca(`falhou ${r.method()} ${r.url()} ${r.failure()?.errorText ?? ""}`));
  page.on("framenavigated", (f) => {
    if (f === page.mainFrame()) marca(`navegou: ${f.url()}`);
  });
  page.on("requestfinished", async (r) => {
    if (r.method() !== "POST" || !r.headers()["next-action"]) return;
    const resp = await r.response();
    const corpo = await resp?.text().catch(() => "");
    marca(`ação ${r.headers()["next-action"]?.slice(0, 8)} ← ${resp?.status()} ${r.url()} redirect=${resp?.headers()["x-action-redirect"] ?? "-"} revalidated=${resp?.headers()["x-action-revalidated"] ?? "-"} corpo=${(corpo ?? "").slice(-300).replace(/\s+/g, " ")}`);
  });
}
async function abrir(browser: Browser, email: string, largura = 1280): Promise<Page> {
  const page = await entrar(browser, email, senha);
  await page.setViewportSize({ width: largura, height: largura === 390 ? 844 : 900 });
  semDialogo(page);
  registrar(page, email.split(".")[0]);
  return page;
}
/** Amanhã às HH:00 de Brasília, no formato do campo datetime-local. */
function amanha(hora: number): string {
  const d = new Date(Date.now() + 86_400_000 - 3 * 3_600_000);
  return `${d.toISOString().slice(0, 10)}T${String(hora).padStart(2, "0")}:00`;
}
async function parceiro(userId: string, nome: string, slug: string, categorias: string[]): Promise<string> {
  const { data, error } = await adm()
    .from("parceiros")
    .insert({ user_id: userId, tipo_pessoa: "pf", documento: cpfAleatorio(), nome_publico: nome, slug, categorias, cidades: ["Uberlândia"], descricao_curta: "Parceiro de laboratório.", status: "publicado", publicado_em: new Date().toISOString() })
    .select("id")
    .single();
  if (error) throw error;
  await adm().from("parceiro_servicos").insert({ parceiro_id: data.id, categoria: categorias[0], titulo: `${categorias[0]} completo`, preco_base: 300, unidade: "por serviço", ativo: true });
  return data.id as string;
}
async function pedidoDoBanco(id: string) {
  const { data } = await adm().from("parceiro_pedidos").select("status, valor_combinado, valor_taxa, valor_parceiro, taxa_percent, pagamento_status, horario_confirmado, ref_tipo, ref_codigo").eq("id", id).single();
  return data as Record<string, unknown>;
}

test.describe("T250 — Contratação de parceiros (31b)", () => {
  test.skip(!NO_LABORATORIO, "Só no laboratório.");
  test.describe.configure({ mode: "serial" });
  test.use({ actionTimeout: 15_000, navigationTimeout: 30_000 });

  test.beforeAll(async () => {
    ids.dono = await criarConta(dono, senha);
    ids.morador = await criarConta(morador, senha);
    ids.foto = await criarConta(fotografo, senha);
    ids.limpa = await criarConta(limpeza, senha);
    ids.parceiroFoto = await parceiro(ids.foto, `Fabi Fotos ${sufixo}`, slugFoto, ["fotografia"]);
    ids.parceiroLimpa = await parceiro(ids.limpa, `Lia Limpa ${sufixo}`, slugLimpa, ["limpeza"]);
    ids.imovel = await criarImovelPronto(ids.dono, `Studio T250 ${sufixo}`, { ativo: true });
    await adm().from("properties").update({ exact_address: "Rua das Flores, 249" }).eq("id", ids.imovel);
    const { data, error } = await adm()
      .from("contratos")
      .insert({ property_id: ids.imovel, tenant_id: ids.morador, owner_plan: "essential", faixa: "temporada", prazo_total_dias: 60, aluguel_mensal: 3200, tamanho_bloco_meses: 2, comissao_percent: 0.08, comissao_valor: 512, qtd_ocupantes: 1, status: "ativo", garantia: "caucao" })
      .select("id")
      .single();
    if (error) throw error;
    ids.contrato = data.id as string;
  });

  test.beforeEach(() => {
    registro.length = 0;
  });
  test.afterEach(async ({}, info) => {
    if (info.status !== info.expectedStatus) console.log(`── diagnóstico de "${info.title}" ──\n${registro.join("\n")}`);
  });

  test.afterAll(async () => {
    await adm().from("parceiro_pedidos").delete().in("parceiro_id", [ids.parceiroFoto, ids.parceiroLimpa].filter(Boolean) as string[]);
    await adm().from("parceiros").delete().in("id", [ids.parceiroFoto, ids.parceiroLimpa].filter(Boolean) as string[]);
    if (ids.contrato) await adm().from("contratos").delete().eq("id", ids.contrato);
    await adm().from("codigos_compartilhamento").delete().eq("usuario_id", ids.foto!);
    await apagarContas([ids.dono, ids.morador, ids.foto, ids.limpa]);
  });

  test("roteiro principal: pedido pelo passo de fotos → orçamento → aceite → horário → simular → entrega → anúncio → concluir → avaliações", async ({ browser }) => {
    test.setTimeout(300_000);
    // 1) Dono: a porta do passo de fotos leva aos fotógrafos da cidade com o imóvel junto; daí ao parceiro e ao pedido.
    const d = await abrir(browser, dono.email);
    await d.goto(`/parceiros/fotografos?cidade=Uberl%C3%A2ndia&uf=MG&imovel=${ids.imovel}&cadastro=1`, { waitUntil: "domcontentloaded" });
    await d.locator(`[data-testid="cartao-parceiro"][data-slug="${slugFoto}"]`).click();
    await expect(d).toHaveURL(new RegExp(`/parceiros/${slugFoto}\\?.*imovel=${ids.imovel}`));
    await d.getByTestId("solicitar-orcamento").click();
    await expect(d.getByTestId("solicitar-orcamento-folha")).toBeVisible();
    await d.getByTestId("solicitar-orcamento-descricao").fill("Fotos do studio para o anúncio, 1 quarto e home office.");
    await expect(d.getByTestId("solicitar-orcamento-imovel")).toHaveValue(ids.imovel!);
    await d.getByTestId("solicitar-orcamento-horario-0").fill(amanha(10));
    await d.getByTestId("solicitar-orcamento-mais-horario").click();
    await d.getByTestId("solicitar-orcamento-horario-1").fill(amanha(15));
    await d.screenshot({ path: `${SAIDA}/t250-formulario-1280.png` });
    // E204: dono e fotógrafo viram contas de teste só durante os 3 avisos, para os e-mails caírem na caixa de QA.
    await marcarTeste([ids.dono!, ids.foto!], true);
    await d.getByTestId("solicitar-orcamento-enviar").click();
    await expect(d).toHaveURL(/\/dashboard\/servicos\/pedidos\/[0-9a-f-]{36}$/, { timeout: 30_000 });
    ids.pedido = d.url().split("/").pop()!;
    await expect(d.getByTestId("pedido-status")).toHaveText("Aguardando orçamento");
    await expect(d.getByTestId("pedido-mensagens")).toContainText("Aqui vocês combinam tudo");
    await expect(d.getByTestId("pedido-pagamento-inativo")).toContainText("O pagamento pela plataforma ainda não está ativo.");
    await expect(d.getByRole("button", { name: /^Pagar/ })).toHaveCount(0);

    // 2) Parceiro: não vê o endereço antes do aceite; orça e vê os 10% e o líquido.
    const p = await abrir(browser, fotografo.email);
    // Painel do parceiro: o pedido novo aparece primeiro, com o próximo passo.
    await p.goto("/dashboard/parceiro", { waitUntil: "domcontentloaded" });
    await expect(p.getByTestId("parceiro-pedido").first()).toContainText("Envie o orçamento ou recuse o pedido.", { timeout: 20_000 });
    await p.screenshot({ path: `${SAIDA}/t250-painel-parceiro-1280.png`, fullPage: true });
    await p.getByTestId("parceiro-pedido").first().click();
    await expect(p).toHaveURL(new RegExp(`/dashboard/servicos/pedidos/${ids.pedido}$`));
    await expect(p.getByTestId("pedido-endereco")).toHaveCount(0);
    await expect(p.locator("main")).not.toContainText("Rua das Flores");
    await p.locator("#pedido-valor-campo").fill("350");
    await expect(p.getByTestId("pedido-orcar")).toContainText("Taxa de serviço da Viva: 10% = R$ 35,00. Você recebe R$ 315,00.");
    await p.screenshot({ path: `${SAIDA}/t250-orcamento-1280.png` });
    await p.getByTestId("pedido-enviar-orcamento").click();
    await expect(p.getByTestId("pedido-status")).toHaveText("Orçamento recebido", { timeout: 20_000 });

    // 3) Dono aceita: taxa congela (0,100 / 35 / 315).
    await d.reload({ waitUntil: "domcontentloaded" });
    await d.getByTestId("pedido-aceitar").click();
    await expect(d.getByTestId("pedido-status")).toHaveText("Orçamento aceito", { timeout: 20_000 });
    expect(await pedidoDoBanco(ids.pedido)).toMatchObject({ status: "aceito", valor_combinado: 350, valor_taxa: 35, valor_parceiro: 315, taxa_percent: 0.1 });

    // E204: os 3 e-mails dizem serviço, imóvel e data; o orçamento recebido e o aceito dizem o valor; o pedido novo
    // aponta para o pedido (não para "as mensagens").
    const imovel = `Studio T250 ${sufixo}`;
    const novo = await emailDoEvento(ids.foto!, "parceiro_pedido_novo");
    expect(novo).toContain(`para ${imovel}`);
    expect(novo).toContain(`Imóvel: ${imovel}`);
    expect(novo).toMatch(/Data sugerida|Datas sugeridas/);
    expect(novo).toContain(`/dashboard/servicos/pedidos/${ids.pedido}`);
    expect(novo).not.toMatch(/mensagens da plataforma/);
    expect(novo).not.toContain("Rua das Flores"); // o endereço exato só depois do aceite
    const recebido = await emailDoEvento(ids.dono!, "parceiro_orcamento_recebido");
    expect(recebido).toContain("Valor: R$ 350");
    expect(recebido).toContain(`Imóvel: ${imovel}`);
    expect(recebido).not.toContain("Você recebe");
    const aceito = await emailDoEvento(ids.foto!, "parceiro_orcamento_aceito");
    expect(aceito).toContain("Valor: R$ 350");
    expect(aceito).toContain("Você recebe: R$ 315");
    await marcarTeste([ids.dono!, ids.foto!], false);

    // 4) Parceiro confirma um dos horários; agora vê o endereço.
    await p.reload({ waitUntil: "domcontentloaded" });
    await expect(p.getByTestId("pedido-endereco")).toContainText("Rua das Flores, 249");
    await p.getByTestId("pedido-confirmar-horario").first().click();
    await expect(p.getByTestId("pedido-status")).toHaveText("Horário confirmado", { timeout: 20_000 });

    // 5) Dono (conta do laboratório): "Simular pagamento" registra a divisão 90/10, sem dinheiro.
    await d.reload({ waitUntil: "domcontentloaded" });
    await d.getByTestId("pedido-simular-pagamento").click();
    await expect(d.getByTestId("pedido-pagamento-simulado")).toBeVisible({ timeout: 20_000 });
    expect((await pedidoDoBanco(ids.pedido)).pagamento_status).toBe("simulado");

    // 6) Parceiro: em execução → entrega das fotos → entregue.
    await p.reload({ waitUntil: "domcontentloaded" });
    await p.getByTestId("pedido-iniciar").click();
    await expect(p.getByTestId("pedido-status")).toHaveText("Em execução", { timeout: 20_000 });
    await p.getByTestId("pedido-enviar-entrega-arquivo").setInputFiles([
      // Fotos como saem da câmera (EXIF e GPS): o último cenário confere a entrega e a cópia para o anúncio.
      { name: "sala.jpg", mimeType: "image/jpeg", buffer: await jpegComGps(1) },
      { name: "quarto.jpg", mimeType: "image/jpeg", buffer: await jpegComGps(2) },
    ]);
    await p.getByTestId("pedido-enviar-entrega").getByRole("button", { name: "Enviar", exact: true }).click();
    await expect(p.getByTestId("pedido-entrega")).toContainText("sala.jpg", { timeout: 30_000 });
    await p.getByTestId("pedido-marcar-entregue").click();
    await expect(p.getByTestId("pedido-status")).toHaveText("Entregue", { timeout: 20_000 });

    // 7) Dono: usa as fotos no anúncio (acrescenta, nada apaga) e conclui.
    const { count: fotosAntes } = await adm().from("property_photos").select("id", { count: "exact", head: true }).eq("property_id", ids.imovel!);
    await d.reload({ waitUntil: "domcontentloaded" });
    await d.getByTestId("pedido-usar-fotos").click();
    await expect(d.getByTestId("pedido-aviso")).toHaveText("Fotos acrescentadas ao anúncio.", { timeout: 30_000 });
    const { count: fotosDepois } = await adm().from("property_photos").select("id", { count: "exact", head: true }).eq("property_id", ids.imovel!);
    expect(fotosDepois).toBe((fotosAntes ?? 0) + 2);
    // O router.refresh() do "usar fotos" pode remontar o botão e fechar o aviso entre os dois cliques: refaz o par
    // (abrir → confirmar) até o pedido concluir, em vez de depender de ordem fixa de cliques.
    await expect(async () => {
      if (await d.getByTestId("pedido-status").innerText() === "Concluído") return;
      if (!(await d.getByTestId("pedido-concluir-confirmacao").isVisible())) await d.getByTestId("pedido-concluir").click();
      await d.getByTestId("pedido-concluir-confirmar").click({ timeout: 3_000 });
      await expect(d.getByTestId("pedido-status")).toHaveText("Concluído", { timeout: 5_000 });
    }).toPass({ timeout: 40_000 });

    // 8) As duas avaliações: cegas até a segunda; depois publicadas e a nota vai para a página do parceiro.
    await d.getByTestId("pedido-nota-5").click();
    await d.getByTestId("pedido-avaliacao-texto").fill("Fotos ótimas, chegou no horário.");
    await d.getByTestId("pedido-avaliar").click();
    await expect(d.getByTestId("pedido-avaliacao-enviada")).toContainText("Aparece quando as duas partes avaliarem");
    await p.reload({ waitUntil: "domcontentloaded" });
    await p.getByTestId("pedido-nota-4").click();
    await p.getByTestId("pedido-avaliar").click();
    await expect(p.getByTestId("pedido-avaliacao-enviada")).toContainText("Publicada", { timeout: 20_000 });
    await expect(p.getByTestId("pedido-avaliacao-outro")).toContainText("5 de 5");
    const { data: pg } = await adm().from("parceiros").select("nota_media, avaliacoes_qtd").eq("id", ids.parceiroFoto!).single();
    expect(pg).toMatchObject({ nota_media: 5, avaliacoes_qtd: 1 });

    for (const [page, quem] of [[d, "cliente"], [p, "parceiro"]] as const) {
      for (const largura of [390, 1280]) {
        await page.setViewportSize({ width: largura, height: largura === 390 ? 844 : 900 });
        await semRolagemLateral(page);
        await page.screenshot({ path: `${SAIDA}/t250-pedido-${quem}-${largura}.png`, fullPage: true });
      }
    }
    await d.context().close();
    await p.context().close();
  });

  test("teto: o 4º pedido aberto na mesma categoria é bloqueado com o texto", async ({ browser }) => {
    test.setTimeout(120_000);
    for (let i = 0; i < 3; i++) {
      await adm().from("parceiro_pedidos").insert({ codigo: `VN-SV-T250${sufixo.slice(0, 3).toUpperCase()}${i}`, parceiro_id: ids.parceiroLimpa, cliente_id: ids.morador, categoria: "limpeza", descricao: "Limpeza de laboratório", status: i === 0 ? "orcado" : "solicitado" });
    }
    const m = await abrir(browser, morador.email, 390);
    await m.goto(`/parceiros/${slugLimpa}`, { waitUntil: "domcontentloaded" });
    await m.getByTestId("solicitar-orcamento").click();
    await m.getByTestId("solicitar-orcamento-descricao").fill("Limpeza pós-mudança, 1 quarto.");
    await m.getByTestId("solicitar-orcamento-horario-0").fill(amanha(9));
    await m.getByTestId("solicitar-orcamento-enviar").click();
    await expect(m.getByTestId("solicitar-orcamento-erro")).toHaveText("Você já tem 3 orçamentos abertos em limpeza: feche um para pedir outro.", { timeout: 20_000 });
    await m.context().close();
    await adm().from("parceiro_pedidos").delete().eq("cliente_id", ids.morador!).eq("categoria", "limpeza");
  });

  test("o morador pede limpeza por /dashboard/servicos; o parceiro recusa com motivo", async ({ browser }) => {
    test.setTimeout(150_000);
    const m = await abrir(browser, morador.email, 1280);
    await m.goto("/dashboard/servicos", { waitUntil: "domcontentloaded" });
    await expect(m.getByTestId("servicos-pedidos")).toBeVisible();
    await m.getByTestId("servicos-limpeza").click();
    await expect(m).toHaveURL(/\/parceiros\/buscar\?.*categoria=limpeza/);
    await m.locator(`[data-testid="cartao-parceiro"][data-slug="${slugLimpa}"]`).click();
    await expect(m).toHaveURL(new RegExp(`/parceiros/${slugLimpa}`));
    // Defeito do QA (21/10): vindo da busca por navegação do cliente, a folha fechava sozinha logo depois de abrir.
    // Agora abre uma vez só e tem de ficar de pé (a lista de imóveis vem com a página; abrir não chama ação).
    const folha = m.getByTestId("solicitar-orcamento-folha");
    const enviar = m.getByTestId("solicitar-orcamento-enviar");
    await m.getByTestId("solicitar-orcamento").click();
    await expect(folha).toBeVisible();
    await m.getByTestId("solicitar-orcamento-descricao").fill("Limpeza semanal do studio, 1 quarto.");
    await m.getByTestId("solicitar-orcamento-horario-0").fill(amanha(9));
    await m.waitForTimeout(2000);
    await expect(folha, "a folha continua aberta depois que a página termina de carregar").toBeVisible();
    await expect(m.getByTestId("solicitar-orcamento-descricao")).toHaveValue("Limpeza semanal do studio, 1 quarto.");
    await expect(enviar).toBeEnabled();
    await enviar.click();
    await expect(m).toHaveURL(/\/dashboard\/servicos\/pedidos\//, { timeout: 30_000 });
    const pedido = m.url().split("/").pop()!;
    await m.goto("/dashboard/servicos", { waitUntil: "domcontentloaded" });
    await expect(m.getByTestId("servicos-pedido-status").first()).toHaveText("Aguardando orçamento");
    await m.screenshot({ path: `${SAIDA}/t250-meus-pedidos-1280.png`, fullPage: true });

    const l = await abrir(browser, limpeza.email, 390);
    await l.goto(`/dashboard/servicos/pedidos/${pedido}`, { waitUntil: "domcontentloaded" });
    await l.locator("#pedido-motivo").fill("Agenda cheia nesta semana");
    await l.getByTestId("pedido-recusar").click();
    await l.getByRole("button", { name: "Recusar o pedido" }).last().click();
    await expect(l.getByTestId("pedido-status")).toHaveText("Recusado pelo parceiro", { timeout: 20_000 });
    await m.close();
    await l.context().close();
  });

  test("pedido vindo do cartão do parceiro grava a ref; o admin vê +1 em 'Pedidos vindos de cartão' (390 e 1280 px)", async ({ browser }) => {
    test.setTimeout(180_000);
    const vindosDeCartao = async (largura: number): Promise<number | null> => {
      if (!hasAccount("admin")) return null;
      const ctx = await browser.newContext({ storageState: authFile("admin"), viewport: { width: largura, height: 900 } });
      const a = await ctx.newPage();
      semDialogo(a);
      const r = await a.goto("/admin/parceiros/pedidos", { waitUntil: "domcontentloaded" });
      expect(r?.status()).toBe(200);
      const v = Number(await a.getByTestId("admin-pedidos-de-cartao").getAttribute("data-valor", { timeout: 20_000 }));
      await semRolagemLateral(a);
      await a.screenshot({ path: `${SAIDA}/t250-admin-pedidos-${largura}.png`, fullPage: true });
      await ctx.close();
      return v;
    };
    const antes = await vindosDeCartao(1280);

    const codigo = "T25X-CXRD";
    await adm().from("codigos_compartilhamento").insert({ codigo, usuario_id: ids.foto });
    // A visita assinada (cookie gravado só depois da assinatura HMAC conferida) é o t239; aqui o cookie já existe.
    const m = await abrir(browser, morador.email, 1280);
    await m.context().addCookies([{ name: "vn_ref_parceiro", value: encodeURIComponent(`${codigo}|${ids.parceiroFoto}`), url: new URL(m.url()).origin }]);
    await m.goto(`/parceiros/${slugFoto}`, { waitUntil: "domcontentloaded" });
    await m.getByTestId("solicitar-orcamento").click();
    await m.getByTestId("solicitar-orcamento-descricao").fill("Fotos do quarto para a minha estadia.");
    await m.getByTestId("solicitar-orcamento-horario-0").fill(amanha(11));
    await m.getByTestId("solicitar-orcamento-enviar").click();
    await expect(m).toHaveURL(/\/dashboard\/servicos\/pedidos\//, { timeout: 30_000 });
    const pedido = m.url().split("/").pop()!;
    expect(await pedidoDoBanco(pedido)).toMatchObject({ ref_tipo: "partnercard", ref_codigo: codigo });
    await m.context().close();

    test.skip(antes === null, "conta de admin do laboratório não configurada");
    expect(await vindosDeCartao(390)).toBe(antes! + 1);
  });

  // Estudo de segurança (22/10): a entrega é baixada pelo cliente e "usar no anúncio" publica a foto para todos.
  test("EXIF/GPS: fotos da entrega (com GPS) ficam sem metadado na entrega e na cópia pública do anúncio", async () => {
    test.skip(!ids.pedido, "o roteiro principal não chegou a criar o pedido");
    const entrega = await metadadoNoDeposito("parceiro-entregas", ids.pedido!, INICIO);
    const anuncio = await metadadoNoDeposito("property-photos", `${ids.dono}/${ids.imovel}`, INICIO);
    expect(entrega.conferidas, "as 2 fotos da entrega deveriam estar no depósito").toBeGreaterThan(0);
    expect(anuncio.conferidas, "as 2 fotos copiadas para o anúncio deveriam estar no depósito").toBeGreaterThan(0);
    expect.soft(entrega.problemas, "entrega do parceiro (depósito privado, o cliente baixa)").toEqual([]);
    expect.soft(anuncio.problemas, "cópia para o anúncio (depósito PÚBLICO)").toEqual([]);
  });
});
