import { test, expect, type Browser, type Page } from "@playwright/test";
import { authFile } from "../fixtures/auth";
import { NO_LABORATORIO, adm, apagarContas, cpfAleatorio, criarConta, criarImovelPronto, entrar, novaSenha, novoSufixo } from "../fixtures/laboratorio";

/*
  T322 — Prompt 62-A, Parte 1, sobre o 62-B3: credenciamento (pedido único com os 5 passos e o estado), agenda do
  avaliador, página pública e admin "Avaliações do imóvel" (laboratório; a chave VISTORIA_ATIVA liga só no navegador do
  teste, pelo cookie de laboratório). Tudo a 390 e 1280 px, sem rolagem lateral, com print.
   1. Candidato que ainda não é parceiro: os 5 passos e o pedido único; enviado → "Em análise", identidade pendente.
   2. Dono: chave desligada esconde o bloco; com a chave, pede → a Viva designa (nenhum botão de escolher avaliador).
   3. Avaliador: "Para responder" com o contador das 24 h; aceita e agenda → "Esta semana" e a hora sem segundos.
   4. Página pública: a linha da designação e nenhum link de contratar.
   5. Admin: decisões primeiro, números clicáveis, "Aprovar para teste" com a pendência, rodízio e tabela vigente.
*/
const LARGURAS = [390, 1280] as const;
const SAIDA = "tests/laboratorio/saida";
const senha = novaSenha();
const sufixo = novoSufixo();
const conta = (p: string, nome: string, role: "owner" | "tenant" = "tenant") => ({ email: `${p}.t322.${sufixo}@lab.vivanomads.test`, nome, role });
const dono = conta("dono", "Dina Dona", "owner");
const avA = conta("ava", "Ana Avaliadora");
const novo = conta("avn", "Nuno Novo");
let numeroN = "";
const ids: Record<string, string> = {};
let numeroA = "";
let pedidoId = "";

async function semRolagemLateral(page: Page) {
  const sobra = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
  expect(sobra, "sem rolagem lateral").toBeLessThanOrEqual(1);
}
async function largura(page: Page, w: number) {
  await page.setViewportSize({ width: w, height: w === 390 ? 844 : 900 });
}
async function comChave(page: Page) {
  await page.context().addCookies([{ name: "vn_lab_vistoria", value: "1", url: new URL(page.url() === "about:blank" ? "http://localhost:3123" : page.url()).origin }]);
}
/** Botões e links com o fundo do primário dentro do conteúdo (o "Fale com a Viva" flutuante fica fora do main). */
async function primariosNoMain(page: Page): Promise<number> {
  return page.locator("main").locator("button.bg-forest:visible, a.bg-forest:visible").count();
}
async function admin(browser: Browser, w: number): Promise<Page> {
  const ctx = await browser.newContext({ storageState: authFile("admin"), viewport: { width: w, height: w === 390 ? 844 : 900 } });
  return ctx.newPage();
}

test.describe("T322 — Prompt 62-A, Parte 1: telas da avaliação do imóvel", () => {
  test.skip(!NO_LABORATORIO, "Só no laboratório.");
  test.describe.configure({ mode: "serial", timeout: 240_000 });

  test.beforeAll(async () => {
    ids.dono = await criarConta(dono, senha);
    ids.A = await criarConta(avA, senha);
    ids.N = await criarConta(novo, senha);
    for (const [l, uid, nome] of [["A", ids.A, avA.nome]] as const) {
      const { data, error } = await adm()
        .from("parceiros")
        .insert({ user_id: uid, tipo_pessoa: "pf", documento: cpfAleatorio(), nome_publico: nome, slug: `aval-${l.toLowerCase()}-t322-${sufixo}`, categorias: ["fotografia"], cidades: ["Uberlândia"] })
        .select("id")
        .single();
      if (error) throw error;
      ids[`parc${l}`] = data.id as string;
    }
    // A já credenciado e ativo, o primeiro do rodízio (nunca designado, ativado há muito tempo).
    const { data: n } = await adm().rpc("proximo_numero_avaliador", { p_sigla: "UDI" });
    numeroA = n as string;
    const { error: eC } = await adm().from("avaliadores_credenciamento").insert({ parceiro_id: ids.parcA, cidade: "Uberlândia", numero_credenciado: numeroA, status: "ativo", experiencia_link: "https://portfolio.lab.vivanomads.test/a", conduta_versao: "2026-10-23", ativado_em: "2025-01-01T00:00:00Z" });
    if (eC) throw eC;
    // Imóvel publicado (desocupado: o pedido segue direto para a designação).
    ids.imovel = await criarImovelPronto(ids.dono, `Avaliação t322 ${sufixo}`, { ativo: true });
    // Tabela da cidade com os 3 portes (o laboratório pode ter linhas de outros specs: esta é a mais recente).
    const { data: precos } = await adm()
      .from("vistoria_precos")
      .insert([
        { cidade: "Uberlândia", porte: "estudio", valor: 280 },
        { cidade: "Uberlândia", porte: "q1_2", valor: 350 },
        { cidade: "Uberlândia", porte: "q3_mais", valor: 420 },
      ])
      .select("id");
    ids.precos = ((precos ?? []) as { id: string }[]).map((x) => x.id).join(",");
  });

  test.afterAll(async () => {
    if (ids.imovel) await adm().from("vistoria_pedidos").delete().eq("property_id", ids.imovel);
    if (ids.precos) await adm().from("vistoria_precos").delete().in("id", ids.precos.split(","));
    // Sem sobra para o próximo spec (o rodízio da cidade leria um avaliador antigo como o primeiro da fila).
    await adm().from("vistoria_designacoes").delete().in("avaliador_id", ((await adm().from("avaliadores_credenciamento").select("id").or(`parceiro_id.eq.${ids.parcA},user_id.eq.${ids.N}`)).data ?? []).map((x) => x.id as string));
    await adm().from("avaliadores_credenciamento").delete().in("parceiro_id", [ids.parcA, ids.parcN].filter(Boolean));
    await adm().from("avaliadores_credenciamento").delete().eq("user_id", ids.N ?? "");
    await adm().from("parceiro_solicitacoes").delete().eq("user_id", ids.N ?? "");
    await apagarContas([ids.A, ids.N, ids.dono]);
  });

  test("1. candidato: os 5 passos e o pedido único; enviado → 'Em análise' com a identidade pendente", async ({ browser }) => {
    const pub = await (await browser.newContext()).newPage();
    const p = await entrar(browser, novo.email, senha);
    for (const w of LARGURAS) {
      await largura(pub, w);
      await pub.goto("/parceiros", { waitUntil: "domcontentloaded" });
      await expect(pub.getByRole("link", { name: "Ser avaliador credenciado" })).toBeVisible({ timeout: 30_000 });

      await largura(p, w);
      await p.goto("/dashboard/parceiro/avaliacao", { waitUntil: "domcontentloaded" });
      const passos = p.getByTestId("credenciamento-passos");
      await expect(passos.locator("li")).toHaveText([/1\. Identidade verificada/, /2\. Experiência comprovada/, /3\. Código de conduta aceito/, /4\. Relações declaradas/, /5\. Avaliação de teste revisada pela Viva/], { timeout: 30_000 });
      await expect(passos.locator('[data-feito="1"]')).toHaveCount(0);
      const form = p.getByTestId("credenciamento-form");
      await expect(form.getByTestId("credenciamento-dados-parceiro")).toBeVisible();
      await expect(form.getByTestId("credenciamento-pendencia")).toContainText("verificar a sua identidade");
      expect(await primariosNoMain(p), "um primário: o envio do pedido").toBe(1);
      await semRolagemLateral(p);
      await p.screenshot({ path: `${SAIDA}/t322-1-credenciamento-${w}.png`, fullPage: true });
    }
    await pub.context().close();
    const form = p.getByTestId("credenciamento-form");
    await form.getByLabel(/Nome público/).fill(novo.nome);
    await form.getByLabel("Tipo de pessoa").selectOption("pf");
    await form.getByLabel("CPF ou CNPJ").fill(cpfAleatorio());
    await form.getByLabel("Cidade onde vai avaliar").fill("Uberlândia");
    await form.getByLabel(/Portfólio ou referência/).fill("https://portfolio.lab.vivanomads.test/nuno");
    await form.getByLabel(/Li e aceito o código de conduta/).check();
    await form.getByTestId("credenciamento-enviar").click();
    await expect.poll(async () => ((await adm().from("avaliadores_credenciamento").select("numero_credenciado").eq("user_id", ids.N).maybeSingle()).data?.numero_credenciado as string | undefined) ?? "", { timeout: 20_000 }).not.toBe("");
    numeroN = (await adm().from("avaliadores_credenciamento").select("numero_credenciado").eq("user_id", ids.N).single()).data!.numero_credenciado as string;
    for (const w of LARGURAS) {
      await largura(p, w);
      await p.goto("/dashboard/parceiro/avaliacao", { waitUntil: "domcontentloaded" });
      await expect(p.getByTestId("credenciamento-estado")).toHaveText("Em análise", { timeout: 30_000 });
      await expect(p.getByTestId("credenciamento-situacao")).toHaveAttribute("data-status", "solicitado");
      await expect(p.getByTestId("passo-identidade")).toHaveAttribute("data-feito", "0");
      for (const k of ["experiencia", "conduta", "relacoes"]) await expect(p.getByTestId(`passo-${k}`)).toHaveAttribute("data-feito", "1");
      await expect(p.getByTestId("passo-teste")).toHaveAttribute("data-feito", "0");
      await expect(p.getByTestId("credenciamento-pendencia").getByRole("link", { name: "Verificar a identidade" })).toHaveAttribute("href", "/dashboard/verificacao");
      await semRolagemLateral(p);
      await p.screenshot({ path: `${SAIDA}/t322-1-em-analise-${w}.png`, fullPage: true });
    }
    await p.context().close();
  });

  test("2. dono: chave desligada esconde o bloco; com a chave, pede e a Viva designa (sem escolher avaliador)", async ({ browser }) => {
    const semChave = await entrar(browser, dono.email, senha);
    await semChave.goto(`/dashboard/imoveis/${ids.imovel}/nivel`, { waitUntil: "domcontentloaded" });
    await expect(semChave.getByTestId("nivel-resumo")).toBeVisible({ timeout: 30_000 });
    await expect(semChave.getByTestId("avaliacao-dono")).toHaveCount(0);
    await semChave.context().close();

    const d = await entrar(browser, dono.email, senha);
    await comChave(d);
    await largura(d, 390);
    await d.goto(`/dashboard/imoveis/${ids.imovel}/nivel`, { waitUntil: "domcontentloaded" });
    const bloco = d.getByTestId("avaliacao-dono");
    await expect(bloco.getByTestId("frase-paga")).toHaveText("Você paga a avaliação, não o resultado.", { timeout: 30_000 });
    await expect(d.getByText(/escolh(er|a) o avaliador/i)).toHaveCount(0);
    await expect(d.locator('select[name^="avaliador"], input[name^="avaliador"]')).toHaveCount(0);
    await d.getByTestId("pedir-avaliacao").getByRole("button", { name: "Pedir avaliação do imóvel" }).click();
    await expect.poll(async () => ((await adm().from("vistoria_pedidos").select("id, status").eq("property_id", ids.imovel).maybeSingle()).data?.status as string | undefined) ?? "", { timeout: 20_000 }).toBe("designado");
    pedidoId = (await adm().from("vistoria_pedidos").select("id").eq("property_id", ids.imovel).single()).data!.id as string;
    await d.goto(`/dashboard/imoveis/${ids.imovel}/nivel`, { waitUntil: "domcontentloaded" });
    await expect(bloco.getByTestId("avaliador-designado")).toHaveText(`Avaliador designado pela Viva: nº ${numeroA}`, { timeout: 30_000 });
    await d.context().close();
  });

  test("3. avaliador: contador das 24 h; aceita e agenda → 'Esta semana' e a hora sem segundos", async ({ browser }) => {
    const p = await entrar(browser, avA.email, senha);
    for (const w of LARGURAS) {
      await largura(p, w);
      await p.goto("/dashboard/parceiro/avaliacao", { waitUntil: "domcontentloaded" });
      await expect(p.getByTestId("credenciamento-estado")).toHaveText("Ativo", { timeout: 30_000 });
      const item = p.locator(`[data-testid="avaliacao-designada"][data-pedido="${pedidoId}"]`);
      await expect(item.getByTestId("prazo-resposta")).toHaveText(/^Responda em 2[0-3] h \d{2} min$/);
      await semRolagemLateral(p);
      await p.screenshot({ path: `${SAIDA}/t322-3-avaliador-responder-${w}.png`, fullPage: true });
    }
    const item = p.locator(`[data-testid="avaliacao-designada"][data-pedido="${pedidoId}"]`);
    await item.getByTestId("designacao-aceitar").click();
    await expect(p.getByTestId("avaliacoes-visitas").locator(`[data-pedido="${pedidoId}"]`).getByTestId("agendar-visita")).toBeVisible({ timeout: 20_000 });
    const quando = new Date(Date.now() + 2 * 86_400_000);
    const dia = new Date(quando.getTime() - 3 * 3_600_000).toISOString().slice(0, 10);
    const agendar = p.getByTestId("avaliacoes-visitas").locator(`[data-pedido="${pedidoId}"]`).getByTestId("agendar-visita");
    await agendar.getByLabel("Data e hora da visita").fill(`${dia}T10:00`);
    await agendar.getByRole("button", { name: "Agendar" }).click();
    await expect.poll(async () => ((await adm().from("vistoria_pedidos").select("agendado_para").eq("id", pedidoId).single()).data?.agendado_para as string | null) ?? null, { timeout: 20_000 }).not.toBeNull();
    const [a, m, d] = dia.split("-");
    for (const w of LARGURAS) {
      await largura(p, w);
      await p.goto("/dashboard/parceiro/avaliacao", { waitUntil: "domcontentloaded" });
      const visita = p.getByTestId("avaliacoes-visitas").locator(`[data-pedido="${pedidoId}"]`);
      await expect(visita.getByTestId("visita-semana")).toHaveText("Esta semana", { timeout: 30_000 });
      await expect(visita.getByTestId("avaliador-visita")).toContainText(`Visita: ${d}/${m}/${a} às 10:00, horário de Brasília`);
      await expect(visita.getByTestId("avaliador-visita")).not.toContainText(/\d\d:\d\d:\d\d/);
      expect(await primariosNoMain(p)).toBeLessThanOrEqual(1);
      await semRolagemLateral(p);
      await p.screenshot({ path: `${SAIDA}/t322-3-avaliador-agenda-${w}.png`, fullPage: true });
    }
    await p.context().close();
  });

  test("4. página pública: a linha da designação, os dados e nenhum link de contratar", async ({ browser }) => {
    const pub = await (await browser.newContext()).newPage();
    for (const w of LARGURAS) {
      await largura(pub, w);
      await pub.goto(`/avaliadores/${numeroA}`, { waitUntil: "domcontentloaded" });
      const pg = pub.getByTestId("avaliador-publico");
      await expect(pg.getByTestId("avaliador-linha-designacao")).toHaveText("A Viva designa o avaliador. O proprietário não escolhe.", { timeout: 30_000 });
      await expect(pg.getByTestId("avaliador-numero")).toHaveText(numeroA);
      await expect(pg.getByTestId("avaliador-cidade")).toHaveText("Uberlândia");
      await expect(pg.locator("a")).toHaveCount(0);
      await semRolagemLateral(pub);
      await pub.screenshot({ path: `${SAIDA}/t322-4-publica-${w}.png` });
    }
    await pub.context().close();
  });

  test("5. admin 'Avaliações do imóvel': decisões primeiro, números clicáveis, 'Aprovar para teste' com a pendência, rodízio e tabela", async ({ browser }) => {
    for (const w of LARGURAS) {
      const p = await admin(browser, w);
      await p.goto("/admin/avaliadores", { waitUntil: "domcontentloaded" });
      await expect(p.getByRole("heading", { level: 1 })).toHaveText("Avaliações do imóvel", { timeout: 30_000 });
      const topo = p.getByTestId("avaliacoes-decidir");
      await expect(topo.getByTestId("decidir-numero-credenciamentos")).toBeVisible();
      // Decisões antes da fila e do rodízio.
      const y = async (t: string) => (await p.getByTestId(t).boundingBox())!.y;
      expect(await y("avaliacoes-decidir")).toBeLessThan(await y("avaliadores-chave"));
      expect(await y("avaliadores-credenciamento")).toBeLessThan(await y("avaliacoes-rodizio"));
      const itemA = p.locator(`[data-testid="credenciamento-item"][data-numero="${numeroA}"]`);
      await expect(itemA.getByTestId("decidir-suspenso").getByRole("button")).toHaveText("Suspender");
      await expect(itemA.getByTestId("decidir-descredenciado").getByRole("button")).toHaveText("Descredenciar");
      const itemN = p.locator(`[data-testid="credenciamento-item"][data-numero="${numeroN}"]`);
      await expect(itemN.getByTestId("credenciamento-dados-parceiro")).toContainText("Ainda não é parceiro");
      await expect(itemN.getByTestId("credenciamento-pendencia")).toBeVisible();
      await expect(itemN.getByTestId("decidir-em_teste").getByRole("button")).toHaveText("Aprovar para teste");
      await expect(topo.getByTestId("decidir-numero-credenciamentos")).not.toHaveAttribute("data-valor", "0");
      await expect(p.getByText(/escolh(er|a) o avaliador/i)).toHaveCount(0);
      const rod = p.locator('[data-testid="rodizio-cidade"][data-cidade="Uberlândia"]');
      await expect(rod.getByTestId("rodizio-item").filter({ hasText: `nº ${numeroA}` })).toBeVisible();
      await expect(p.getByTestId("precos-historico").locator('[data-vigente="sim"]').first()).toContainText("vigente");
      await topo.getByTestId("decidir-numero-credenciamentos").click();
      await expect(p).toHaveURL(/#credenciamento$/);
      await semRolagemLateral(p);
      await p.screenshot({ path: `${SAIDA}/t322-5-admin-${w}.png` });
      await p.context().close();
    }
  });
});
