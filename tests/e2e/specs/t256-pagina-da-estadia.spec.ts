import { existsSync, readFileSync } from "node:fs";
import { test, expect, type Browser, type Page } from "@playwright/test";
import { authFile } from "../fixtures/auth";
import { hasAccount } from "../fixtures/accounts";
import { NO_LABORATORIO, adm, apagarContas, criarConta, criarImovelPronto, criarLead, entrar, novaSenha, novoSufixo } from "../fixtures/laboratorio";

/**
 * T256 — Página da estadia (Prompt 32), com a jornada de teste do laboratório:
 * contrato assinado → página da estadia com o checklist (dono e morador) → card "Decisões" na home do painel →
 * morador preenche os ocupantes → dono baixa a
 * lista da portaria → instruções de chegada liberadas no D-7 e não no D-8 (data simulada pelos blocos) e não sem o 1º
 * pagamento → nota privada invisível para a outra parte → "Propor alteração" +1 mês → aceite → aditivo assinado
 * pelos dois com código → blocos e taxa (só na visão do dono) atualizados → "Encerrar" com a chave desligada → pedido no
 * admin, sem valor de multa. 390 e 1280 px, sem rolagem lateral e sem diálogo do navegador.
 */
const SAIDA = "tests/laboratorio/saida";
const senha = novaSenha();
const sufixo = novoSufixo();
const dono = { email: `dono.t254.${sufixo}@lab.vivanomads.test`, nome: "Dalva Estadia", role: "owner" as const };
const morador = { email: `mor.t254.${sufixo}@lab.vivanomads.test`, nome: "Moacir Estadia", role: "tenant" as const };
const ids: { dono?: string; morador?: string; imovel?: string; lead?: string; contrato?: string; bloco1?: string } = {};

const dia = (n: number) => new Date(Date.now() - 3 * 3_600_000 + n * 86_400_000).toISOString().slice(0, 10);

function semDialogo(page: Page) {
  page.on("dialog", (d) => {
    throw new Error(`diálogo do navegador não permitido: ${d.type()} ${d.message()}`);
  });
}
async function semRolagemLateral(page: Page) {
  expect(await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth)).toBeLessThanOrEqual(1);
}
/** Diagnóstico: console, erros da página e ações do servidor (POST com next-action), impressos só quando o teste falha. */
const registro: string[] = [];
function registrar(page: Page, quem: string) {
  const t0 = Date.now();
  const marca = (s: string) => registro.push(`[${quem} +${((Date.now() - t0) / 1000).toFixed(1)}s] ${s}`);
  page.on("console", (m) => { if (m.type() === "error" || m.type() === "warning") marca(`console.${m.type()}: ${m.text()}`); });
  page.on("pageerror", (e) => marca(`pageerror: ${e.message}`));
  page.on("requestfailed", (r) => marca(`requestfailed: ${r.method()} ${r.url()} ${r.failure()?.errorText ?? ""}`));
  page.on("request", (r) => { if (r.method() === "POST" && r.headers()["next-action"]) marca(`ação → ${r.url()}`); });
  page.on("requestfinished", async (r) => {
    if (r.method() !== "POST" || !r.headers()["next-action"]) return;
    const resp = await r.response();
    marca(`ação ← ${resp?.status()} ${r.url()} (${Math.round(r.timing().responseEnd)} ms)`);
  });
  page.on("framenavigated", (f) => { if (f === page.mainFrame()) marca(`navegou: ${f.url()}`); });
}
async function abrir(browser: Browser, email: string, largura = 1280): Promise<Page> {
  const page = await entrar(browser, email, senha);
  await page.setViewportSize({ width: largura, height: largura === 390 ? 844 : 900 });
  semDialogo(page);
  registrar(page, email.startsWith("dono") ? "dono" : "morador");
  return page;
}
/** Linha de base visual NOVA (tela nova): compara quando a linha de base existe; senão, só guarda o print. */
async function print(page: Page, nome: string) {
  await page.screenshot({ path: `${SAIDA}/t256-${nome}.png` });
  const base = test.info().snapshotPath(`${nome}.png`);
  if (existsSync(base)) await expect(page).toHaveScreenshot(`${nome}.png`, { mask: [page.locator("img, time, [data-visual='muda']")] });
  else test.info().annotations.push({ type: "linha-de-base-nova", description: `${nome}.png: gerar a partir de ${SAIDA}/t256-${nome}.png` });
}
/** Entrada do contrato em `n` dias: os blocos andam juntos (a data simulada do D-7/D-8). */
async function entradaEm(n: number) {
  await adm().from("contrato_blocos").update({ inicio: dia(n), fim: dia(n + 59) }).eq("contrato_id", ids.contrato!).eq("numero_bloco", 1);
  await adm().from("contrato_blocos").update({ inicio: dia(n + 60), fim: dia(n + 89) }).eq("contrato_id", ids.contrato!).eq("numero_bloco", 2);
}
async function codigoDaCaixa(usuarioId: string, depoisDe: string): Promise<string> {
  for (let i = 0; i < 30; i++) {
    const { data } = await adm()
      .from("emails_teste")
      .select("corpo")
      .eq("usuario_id", usuarioId)
      .eq("evento", "contract_signature_code")
      .gt("criado_em", depoisDe)
      .order("criado_em", { ascending: false })
      .limit(1);
    const m = /":\s*(\d{6})\s*$/m.exec(String(data?.[0]?.corpo ?? "").trim());
    if (m) return m[1];
    await new Promise((r) => setTimeout(r, 1000));
  }
  throw new Error("O código do aditivo não chegou à caixa de testes em 30 s.");
}

test.describe("T256 — Página da estadia (Prompt 32)", () => {
  test.skip(!NO_LABORATORIO, "Só no laboratório.");
  test.describe.configure({ mode: "serial" });
  test.use({ actionTimeout: 15_000, navigationTimeout: 30_000 });

  test.beforeAll(async () => {
    ids.dono = await criarConta(dono, senha);
    ids.morador = await criarConta(morador, senha);
    // Contas de teste: o código do aditivo cai na caixa de e-mails de teste da própria conta.
    await adm().from("profiles").update({ is_teste: true }).in("id", [ids.dono, ids.morador]);
    ids.imovel = await criarImovelPronto(ids.dono, `Studio da estadia ${sufixo}`, { ativo: true, preco: 3000 });
    ids.lead = await criarLead(ids.dono, ids.morador, ids.imovel, true);
    const agora = new Date().toISOString();
    const { data: c, error } = await adm()
      .from("contratos")
      .insert({
        lead_id: ids.lead, property_id: ids.imovel, tenant_id: ids.morador, owner_plan: "essential", faixa: "media_estadia",
        prazo_total_dias: 90, aluguel_mensal: 3000, tamanho_bloco_meses: 2, comissao_percent: 0.1, comissao_valor: 900,
        qtd_ocupantes: 2, capacidade_snapshot: 3, assinado_proprietario_em: agora, assinado_inquilino_em: agora,
      })
      .select("id")
      .single();
    if (error) throw error;
    ids.contrato = c.id as string;
    // Como o banco cria: o 1º bloco nasce "ativo"; o 2º, renovação já aceita pelas duas partes.
    const { data: b1, error: e1 } = await adm()
      .from("contrato_blocos")
      .insert({ contrato_id: ids.contrato, numero_bloco: 1, inicio: dia(8), fim: dia(67), meses: 2, valor: 6000, caucao: 3000, status: "ativo" })
      .select("id")
      .single();
    if (e1) throw e1;
    ids.bloco1 = b1.id as string;
    const { error: e2 } = await adm()
      .from("contrato_blocos")
      .insert({ contrato_id: ids.contrato, numero_bloco: 2, inicio: dia(68), fim: dia(97), meses: 1, valor: 3000, caucao: 0, status: "agendado", aceite_proprietario_em: agora, aceite_inquilino_em: agora });
    if (e2) throw e2;
  });

  test.beforeEach(() => {
    registro.length = 0;
  });
  test.afterEach(async ({}, info) => {
    if (info.status === info.expectedStatus) return;
    console.log(`── diagnóstico de "${info.title}" ──\n${registro.join("\n")}`);
    const log = `${SAIDA}/servidor.log`;
    if (existsSync(log)) console.log(`── servidor.log (fim) ──\n${readFileSync(log, "utf8").split("\n").slice(-120).join("\n")}`);
  });

  test.afterAll(async () => {
    if (ids.contrato) await adm().from("contratos").delete().eq("id", ids.contrato);
    if (ids.lead) await adm().from("leads").delete().eq("id", ids.lead);
    await apagarContas([ids.dono, ids.morador]);
  });

  test("contrato assinado → página da estadia com o checklist; o dono vê a taxa com a base, o morador não", async ({ browser }) => {
    test.setTimeout(120_000);
    for (const largura of [1280, 390]) {
      const d = await abrir(browser, dono.email, largura);
      await d.goto(`/dashboard/estadia/${ids.contrato}`, { waitUntil: "networkidle" });
      await expect(d.getByTestId("pagina-estadia")).toHaveAttribute("data-papel", "proprietario");
      await expect(d.getByTestId("estadia-topo-texto")).toHaveText("Entrada em 8 dias");
      await expect(d.getByTestId("checklist-assinatura")).toHaveAttribute("data-feito", "sim");
      await expect(d.getByTestId("checklist-primeiro_pagamento")).toHaveAttribute("data-feito", "nao");
      await expect(d.getByTestId("checklist-instrucoes")).toBeVisible();
      await expect(d.getByTestId("valor-taxa")).toContainText("10% sobre o valor mensal × meses");
      await expect(d.getByTestId("valor-mensal")).toContainText("pago direto ao proprietário");
      // Prompt 41 (adendo da estadia): sem a fileira; "Mensagem" é o único primário, "Encerrar contrato" fica no fim da
      // página em texto vermelho e o resto mora no cogumelo "Ações desta estadia" (conferido no t259).
      await expect(d.getByTestId("estadia-acoes")).toHaveCount(0);
      await expect(d.locator('[data-testid^="estadia-acao-"]')).toHaveCount(2);
      await expect(d.getByTestId("estadia-acao-mensagem")).toHaveAttribute("href", /\/dashboard\/mensagens\?conversa=/);
      await expect(d.getByTestId("estadia-acao-mensagem")).toHaveAttribute("data-cta", "primary");
      await expect(d.getByTestId("estadia-acao-encerrar")).toHaveAttribute("href", `/dashboard/estadia/${ids.contrato}/encerrar`);
      await expect(d.getByTestId("cogumelo")).toBeVisible();
      await semRolagemLateral(d);
      await print(d, `dono-${largura}`);
      await d.context().close();
    }
    const m = await abrir(browser, morador.email, 390);
    await m.goto(`/dashboard/estadia/${ids.contrato}`, { waitUntil: "networkidle" });
    await expect(m.getByTestId("pagina-estadia")).toHaveAttribute("data-papel", "inquilino");
    await expect(m.getByTestId("valor-taxa")).toHaveCount(0);
    await expect(m.getByTestId("checklist-instrucoes")).toHaveCount(0);
    await semRolagemLateral(m);
    await print(m, "morador-390");
    await m.context().close();
  });

  test("home do painel: o card 'Decisões das suas estadias' leva à estadia e pede o que cada um decide", async ({ browser }) => {
    test.setTimeout(90_000);
    const d = await abrir(browser, dono.email, 390);
    await d.goto("/dashboard", { waitUntil: "networkidle" });
    const cartaoDono = d.locator(`[data-testid="home-estadia"][data-contrato="${ids.contrato}"]`);
    await expect(cartaoDono).toBeVisible();
    await expect(cartaoDono.getByTestId("home-decisao-preencher_instrucoes")).toBeVisible();
    await expect(cartaoDono.getByTestId("home-estadia-acoes")).toContainText("Propor alteração de datas");
    await semRolagemLateral(d);
    await cartaoDono.getByRole("link", { name: /Studio da estadia/ }).click();
    await expect(d).toHaveURL(new RegExp(`/dashboard/estadia/${ids.contrato}$`));
    await d.context().close();
    const m = await abrir(browser, morador.email, 390);
    await m.goto("/dashboard", { waitUntil: "networkidle" });
    const cartaoMorador = m.locator(`[data-testid="home-estadia"][data-contrato="${ids.contrato}"]`);
    await expect(cartaoMorador.getByTestId("home-decisao-preencher_ocupantes")).toBeVisible();
    await expect(cartaoMorador.getByTestId("home-estadia-acoes")).toContainText("Pedir limpeza/manutenção");
    await m.context().close();
  });

  test("instruções de chegada: o dono preenche; o morador vê no D-7, não no D-8, e não sem o 1º pagamento", async ({ browser }) => {
    test.setTimeout(150_000);
    const d = await abrir(browser, dono.email);
    await d.goto(`/dashboard/estadia/${ids.contrato}#instrucoes`, { waitUntil: "networkidle" });
    await d.getByTestId("instrucoes-como_entrar").fill("Portaria 24 h: diga o seu nome na entrada.");
    await d.getByTestId("instrucoes-wifi_rede").fill("StudioLab");
    await d.getByTestId("instrucoes-wifi_senha").fill("senha-do-lab");
    await d.getByTestId("instrucoes-salvar").click();
    await expect(d.getByTestId("estadia-ok")).toBeVisible();
    await d.context().close();

    const m = await abrir(browser, morador.email, 390);
    // D-7, mas sem o 1º pagamento: não aparecem.
    await entradaEm(7);
    await m.goto(`/dashboard/estadia/${ids.contrato}`, { waitUntil: "networkidle" });
    await expect(m.getByTestId("instrucoes-bloqueadas")).toContainText(/1º pagamento/);
    await expect(m.getByText("senha-do-lab")).toHaveCount(0);
    // 1º pagamento registrado e confirmado.
    await adm().from("pagamentos_bloco").insert({ bloco_id: ids.bloco1, contrato_id: ids.contrato, tipo: "aluguel", valor: 3000, data_pagamento: dia(0), marcado_por: ids.dono, confirmado_pelo_inquilino: true, confirmado_em: new Date().toISOString() });
    // D-8: ainda não.
    await entradaEm(8);
    await m.reload({ waitUntil: "networkidle" });
    await expect(m.getByTestId("instrucoes-bloqueadas")).toContainText(/^Liberadas em \d{2}\/\d{2}\/\d{4}\.$/);
    await expect(m.getByText("senha-do-lab")).toHaveCount(0);
    // D-7: aparecem.
    await entradaEm(7);
    await m.reload({ waitUntil: "networkidle" });
    await expect(m.getByTestId("instrucoes-liberadas")).toContainText("Portaria 24 h");
    await expect(m.getByTestId("instrucoes-liberadas")).toContainText("senha-do-lab");
    await expect(m.getByTestId("checklist-primeiro_pagamento")).toHaveAttribute("data-feito", "sim");
    await m.context().close();

    // Achado do QA (21/10): com texto do contrato (combinação de check-in), o editor do dono abre com o PUBLICADO e
    // salvar corrige o que o morador vê.
    await adm()
      .from("contratos_checkin")
      .upsert({ contrato_id: ids.contrato, horario: "15:00", instrucoes: "Retire a chave na portaria apresentando documento.", plantao: "34999998888" }, { onConflict: "contrato_id" });
    const d2 = await abrir(browser, dono.email);
    await d2.goto(`/dashboard/estadia/${ids.contrato}#instrucoes`, { waitUntil: "networkidle" });
    await expect(d2.getByTestId("instrucoes-como_entrar")).toHaveValue("Retire a chave na portaria apresentando documento.");
    await expect(d2.getByTestId("instrucoes-wifi_senha")).toHaveValue("senha-do-lab");
    await expect(d2.getByTestId("instrucoes-como-entrar-do-contrato")).toBeVisible();
    await d2.getByTestId("instrucoes-como_entrar").fill("Chave com o zelador, das 8 h às 18 h.");
    await d2.getByTestId("instrucoes-salvar").click();
    await expect(d2.getByTestId("estadia-ok")).toBeVisible();
    await d2.context().close();
    const m2 = await abrir(browser, morador.email, 390);
    await m2.goto(`/dashboard/estadia/${ids.contrato}`, { waitUntil: "networkidle" });
    await expect(m2.getByTestId("instrucoes-liberadas")).toContainText("Chave com o zelador");
    await expect(m2.getByTestId("instrucoes-liberadas")).not.toContainText("Retire a chave");
    await m2.context().close();
    const { data: im } = await adm().from("imovel_instrucoes_chegada").select("como_entrar").eq("property_id", ids.imovel!).single();
    expect(im?.como_entrar, "o \"como entrar\" do imóvel fica como estava").toBe("Portaria 24 h: diga o seu nome na entrada.");
  });

  test("ocupantes: o morador preenche até o limite; o dono baixa a lista da portaria", async ({ browser }) => {
    test.setTimeout(150_000);
    const m = await abrir(browser, morador.email, 390);
    await m.goto(`/dashboard/estadia/${ids.contrato}/ocupantes`, { waitUntil: "networkidle" });
    await expect(m.getByTestId("ocupantes-aviso")).toHaveText("Estes dados são usados só para a liberação na portaria.");
    for (const [nome, doc] of [["Moacir Estadia", "529.982.247-25"], ["Lia Estadia", "MG-12.345.678"]]) {
      await m.getByTestId("ocupante-nome").fill(nome);
      await m.getByTestId("ocupante-documento").fill(doc);
      await m.getByTestId("ocupante-salvar").click();
      await expect(m.getByTestId("ocupante").filter({ hasText: nome })).toBeVisible();
    }
    await expect(m.getByTestId("ocupante-form")).toHaveCount(0);
    await expect(m.getByTestId("ocupantes-teto")).toBeVisible();
    await semRolagemLateral(m);
    await print(m, "ocupantes-390");
    await m.context().close();

    const d = await abrir(browser, dono.email);
    await d.goto(`/dashboard/estadia/${ids.contrato}`, { waitUntil: "networkidle" });
    await d.getByTestId("lista-portaria-abrir").click();
    await expect(d.getByTestId("lista-portaria-texto")).toHaveValue(/Lista para a portaria — Studio da estadia/);
    await expect(d.getByTestId("lista-portaria-texto")).toHaveValue(/1\. Moacir Estadia — 529\.982\.247-25\n2\. Lia Estadia — MG-12\.345\.678/);
    const baixando = d.waitForEvent("download");
    await d.getByTestId("lista-portaria-baixar").click();
    expect((await baixando).suggestedFilename()).toBe("lista-para-a-portaria.txt");
    await expect(d.getByTestId("checklist-ocupantes")).toHaveAttribute("data-feito", "sim");
    await d.context().close();
  });

  test("nota privada: o dono escreve e o morador não vê", async ({ browser }) => {
    test.setTimeout(90_000);
    const d = await abrir(browser, dono.email);
    await d.goto(`/dashboard/estadia/${ids.contrato}`, { waitUntil: "networkidle" });
    await d.getByTestId("nota-texto").fill("Trocar a resistência do chuveiro antes da entrada.");
    await d.getByTestId("nota-salvar").click();
    await expect(d.getByTestId("estadia-ok")).toHaveText("Nota salva.");
    await d.reload({ waitUntil: "networkidle" });
    await expect(d.getByTestId("nota-texto")).toHaveValue(/resistência do chuveiro/);
    await d.context().close();
    const m = await abrir(browser, morador.email, 390);
    await m.goto(`/dashboard/estadia/${ids.contrato}`, { waitUntil: "networkidle" });
    await expect(m.getByTestId("nota-texto")).toHaveValue("");
    await expect(m.getByText("resistência do chuveiro")).toHaveCount(0);
    await m.context().close();
  });

  test("propor alteração +1 mês → aceite → aditivo assinado pelos dois com código → blocos e taxa atualizados", async ({ browser }) => {
    test.setTimeout(240_000);
    const m = await abrir(browser, morador.email, 390);
    await m.goto(`/dashboard/estadia/${ids.contrato}/alteracao`, { waitUntil: "networkidle" });
    await m.getByTestId("alteracao-meses").selectOption("4");
    await m.getByTestId("alteracao-enviar").click();
    await expect(m).toHaveURL(new RegExp(`/dashboard/estadia/${ids.contrato}$`));
    await expect(m.getByTestId("aditivo-resumo")).toHaveText("Meses: de 3 para 4");
    await expect(m.getByTestId("aditivo-taxa")).toHaveCount(0);
    // Nada muda antes do aceite e das duas assinaturas.
    const { count: antes } = await adm().from("contrato_blocos").select("id", { count: "exact", head: true }).eq("contrato_id", ids.contrato!);
    expect(antes).toBe(2);

    const d = await abrir(browser, dono.email);
    await d.goto(`/dashboard/estadia/${ids.contrato}`, { waitUntil: "networkidle" });
    await d.getByTestId("aditivo-aceitar").click();
    // A mensagem vem antes do status: se a ação falhar, o erro da tela aparece no relatório.
    await expect(d.getByTestId("estadia-ok").or(d.getByTestId("estadia-erro"))).toHaveText("Proposta aceita. Agora as duas partes assinam o aditivo.", { timeout: 30_000 });
    await expect(d.getByTestId("estadia-aditivo")).toHaveAttribute("data-status", "aceito", { timeout: 20_000 });
    // Taxa só sobre o mês acrescentado, na faixa atual, com a base escrita — só na visão do dono.
    await expect(d.getByTestId("aditivo-taxa")).toContainText(/R\$ 3\.000,00 × 1 mês acrescentado × \d+(,\d)?% \(faixa atual\)/);
    for (const [pagina, quem] of [[d, ids.dono!], [m, ids.morador!]] as const) {
      await pagina.reload({ waitUntil: "networkidle" });
      const desde = new Date().toISOString();
      await pagina.getByTestId("aditivo-pedir-codigo").click();
      await expect(pagina.getByTestId("estadia-ok").or(pagina.getByTestId("estadia-erro"))).toHaveText("Código enviado para o seu e-mail.", { timeout: 30_000 });
      await pagina.getByTestId("aditivo-codigo").fill(await codigoDaCaixa(quem, desde));
      await pagina.getByTestId("aditivo-aceite").check();
      await pagina.getByTestId("aditivo-assinar").click();
      await expect(pagina.getByTestId("estadia-ok").or(pagina.getByTestId("estadia-erro"))).toHaveText("Assinatura registrada.", { timeout: 30_000 });
    }
    const { data: blocos } = await adm().from("contrato_blocos").select("numero_bloco, meses, status").eq("contrato_id", ids.contrato!).order("numero_bloco");
    expect(blocos!.reduce((s, b) => s + Number(b.meses), 0)).toBe(4);
    const { data: ct } = await adm().from("contratos").select("prazo_total_dias").eq("id", ids.contrato!).single();
    expect(ct!.prazo_total_dias).toBe(120);
    const { data: ev } = await adm().from("contrato_eventos").select("tipo").eq("contrato_id", ids.contrato!).eq("tipo", "estadia_remarcada");
    expect(ev).toHaveLength(1);
    await d.reload({ waitUntil: "networkidle" });
    await expect(d.getByTestId("estadia-historico")).toContainText(/Aditivo 1 — \d{2}\/\d{2}\/\d{4} — Meses: de 3 para 4/);
    await expect(d.getByTestId("estadia-historico")).toContainText("mês acrescentado");
    await m.reload({ waitUntil: "networkidle" });
    await expect(m.getByTestId("estadia-historico")).not.toContainText("acrescentado");
    await d.context().close();
    await m.context().close();
  });

  test("encerrar com a chave desligada: motivo → consequências sem valor → confirmar → pedido no admin", async ({ browser }) => {
    test.setTimeout(150_000);
    const m = await abrir(browser, morador.email, 1280);
    await m.goto(`/dashboard/estadia/${ids.contrato}/encerrar`, { waitUntil: "networkidle" });
    await m.getByTestId("encerrar-motivo-mudanca_planos_morador").check();
    await m.getByTestId("encerrar-continuar").click();
    await expect(m.getByTestId("encerrar-consequencias")).toHaveText(
      "As regras de encerramento estão sendo finalizadas. Ao confirmar, a Viva recebe o pedido e conduz o encerramento com vocês.",
    );
    await expect(m.getByTestId("encerrar-form")).not.toContainText(/multa|R\$/i);
    await print(m, "encerrar-1280");
    await m.getByTestId("encerrar-confirmar").click();
    await m.getByTestId("encerrar-confirmar-confirmar").click();
    await expect(m).toHaveURL(new RegExp(`/dashboard/estadia/${ids.contrato}$`));
    await expect(m.getByTestId("estadia-encerramento")).toContainText("Mudança de planos do morador");
    await m.context().close();
    const { data: pedido } = await adm().from("contrato_encerramento_pedidos").select("status, motivo").eq("contrato_id", ids.contrato!).single();
    expect(pedido).toEqual({ status: "aberto", motivo: "mudanca_planos_morador" });

    test.skip(!hasAccount("admin"), "Sem conta admin de teste: a fila do admin fica para o reteste.");
    const ctx = await browser.newContext({ storageState: authFile("admin"), viewport: { width: 1280, height: 900 } });
    const a = await ctx.newPage();
    await a.goto("/admin/contratos/encerramentos", { waitUntil: "networkidle" });
    const cartao = a.locator(`[data-testid="admin-encerramento"][data-contrato="${ids.contrato}"]`);
    await expect(cartao).toBeVisible();
    await expect(cartao).toContainText("Mudança de planos do morador");
    await expect(cartao).not.toContainText(/multa/i);
    await ctx.close();
  });
});
