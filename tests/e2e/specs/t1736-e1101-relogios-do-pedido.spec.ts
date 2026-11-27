import { test, expect, type Page } from "@playwright/test";
import { NO_LABORATORIO, adm, apagarContas, cnpjAleatorio, criarConta, criarImovelPronto, entrar, novaSenha, novoSufixo } from "../fixtures/laboratorio";

/*
  T1736 — E1101 @E1101 (ORDEM-DUET-465): os relógios do mesmo pedido, dos DOIS lados. O dono via a proposta viva com 72 h
  para aceitar enquanto o avaliador, que já tinha proposto, lia outro estado. Cenário do piloto, como em produção: a
  chave desligada (sem o cookie do laboratório), dono e avaliador de conta de teste na lista do piloto, e o pedido feito
  pela própria tela (o pedido nasce "de teste" e escolhido pelo dono). Cidade própria do spec (Araxá).
   1. Antes da proposta: a vez é do avaliador. Ele vê "Responda em …" pelo prazo que declarou (12 h, não 24); o dono lê
      que o avaliador tem 12 horas.
   2. Enviada a proposta: o relógio de resposta PARA. O avaliador vê "Proposta enviada" e até quando o dono pode aceitar
      (72 h depois da proposta), na tela do pedido e na lista; não vê "Aceito pelo proprietário", nem agenda, nem
      formulário de proposta. O dono vê a proposta com as 72 horas. Print a 390 e a 1280 px.
   3. 30 horas depois da escolha (a proposta feita há 1 h): nada de "prazo de resposta vencido" para o avaliador; o
      prazo do dono continua contado da proposta.
   4. O dono aceita: os dois lados passam a "aceito" — o avaliador vê "Aceito pelo proprietário" e agenda.
  Laboratório; não é prova ao vivo no site.
*/
const LARGURAS = [390, 1280] as const;
const SAIDA = "tests/laboratorio/saida";
const CIDADE = "Araxá";
const senha = novaSenha();
const sufixo = novoSufixo();
const dono = { email: `dono.t1736.${sufixo}@lab.vivanomads.test`, nome: "Dalila Relógio", role: "owner" as const };
const aval = { email: `av.t1736.${sufixo}@lab.vivanomads.test`, nome: "Amaro Avaliador", role: "tenant" as const };
const ids: Record<string, string> = {};
let pedido = "";

async function largura(page: Page, w: number) {
  await page.setViewportSize({ width: w, height: w === 390 ? 844 : 900 });
}
const semRolagemLateral = async (page: Page) => expect(await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth)).toBeLessThanOrEqual(1);
/** "25/11/2026 11:00 (horário de Brasília)", como a tela escreve. */
function dataHoraDeBrasilia(iso: string): string {
  const p = Object.fromEntries(new Intl.DateTimeFormat("pt-BR", { timeZone: "America/Sao_Paulo", day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit", hour12: false }).formatToParts(new Date(iso)).map((x) => [x.type, x.value]));
  return `${p.day}/${p.month}/${p.year} ${p.hour}:${p.minute} (horário de Brasília)`;
}
const textoDoAceite = (propostaEm: string) =>
  `O proprietário tem até ${dataHoraDeBrasilia(new Date(Date.parse(propostaEm) + 72 * 3_600_000).toISOString())} para aceitar: 72 horas depois da proposta. Sem o aceite, o pedido volta para ele escolher de novo.`;
const linha = async () => (await adm().from("vistoria_pedidos").select("status, teste, escolhido_em, designado_em, proposta_em, proposta_aceita_em").eq("id", pedido).single()).data!;

test.describe("T1736 — E1101: os relógios do mesmo pedido, dos dois lados @E1101", () => {
  test.skip(!NO_LABORATORIO, "Só no laboratório.");
  test.describe.configure({ mode: "serial", timeout: 240_000 });

  test.beforeAll(async () => {
    ids.dono = await criarConta(dono, senha);
    ids.aval = await criarConta(aval, senha);
    const t = await adm().from("profiles").update({ is_teste: true }).in("id", [ids.dono, ids.aval]);
    if (t.error) throw t.error;
    const { data: parc, error } = await adm()
      .from("parceiros")
      .insert({ user_id: ids.aval, tipo_pessoa: "pj", documento: cnpjAleatorio(), nome_publico: aval.nome, slug: `av-t1736-${sufixo}`, categorias: ["fotografia"], cidades: [CIDADE] })
      .select("id")
      .single();
    if (error) throw error;
    ids.parc = parc.id as string;
    const { data: n } = await adm().rpc("proximo_numero_avaliador", { p_sigla: "UDI" });
    // O avaliador declarou responder em 12 horas (E682): o relógio dele é esse, não as 24 h padrão.
    const { data: c, error: e2 } = await adm()
      .from("avaliadores_credenciamento")
      .insert({ parceiro_id: parc.id, cidade: CIDADE, numero_credenciado: n, status: "ativo", prazo_resposta_horas: 12, experiencia_link: "https://portfolio.lab.vivanomads.test/t1736", conduta_versao: "2026-10-23", ativado_em: "2025-01-01T00:00:00Z" })
      .select("id")
      .single();
    if (e2) throw e2;
    ids.cred = c.id as string;
    for (const u of [ids.dono, ids.aval]) {
      const p = await adm().from("vistoria_piloto").insert({ user_id: u, nota: "T1736 (laboratório)" });
      if (p.error) throw p.error;
    }
    ids.imovel = await criarImovelPronto(ids.dono, `Casa t1736 ${sufixo}`, { ativo: true });
    const cid = await adm().from("properties").update({ city: CIDADE }).eq("id", ids.imovel);
    if (cid.error) throw cid.error;
    const { error: eT } = await adm()
      .from("vistoria_precos")
      .insert(["estudio", "q1_2", "q3_mais"].map((porte) => ({ cidade: CIDADE, porte, valor: 350 })));
    if (eT) throw eT;
  });

  test.afterAll(async () => {
    if (ids.imovel) {
      const ped = ((await adm().from("vistoria_pedidos").select("id").eq("property_id", ids.imovel)).data ?? []).map((x) => x.id as string);
      if (ped.length) await adm().from("vistoria_fila_admin").delete().in("pedido_id", ped);
      await adm().from("vistoria_pedidos").delete().eq("property_id", ids.imovel);
    }
    await adm().from("vistoria_precos").delete().eq("cidade", CIDADE);
    const contas = [ids.dono, ids.aval].filter(Boolean);
    if (contas.length) await adm().from("vistoria_piloto").delete().in("user_id", contas);
    if (ids.cred) {
      await adm().from("vistoria_designacoes").delete().eq("avaliador_id", ids.cred);
      await adm().from("avaliadores_credenciamento").delete().eq("id", ids.cred);
    }
    if (ids.parc) await adm().from("parceiros").delete().eq("id", ids.parc);
    if (ids.imovel) await adm().from("properties").delete().eq("id", ids.imovel);
    await apagarContas(contas);
  });

  test("1. antes da proposta: a vez é do avaliador, pelo prazo que ELE declarou (12 h)", async ({ browser }) => {
    const d = await entrar(browser, dono.email, senha);
    await largura(d, 390);
    await d.goto(`/dashboard/imoveis/${ids.imovel}/nivel`, { waitUntil: "domcontentloaded" });
    await d.getByTestId("pedir-avaliacao").getByRole("button", { name: "Pedir avaliação do imóvel" }).click({ timeout: 30_000 });
    await expect(d.getByTestId("avaliacao-escolha")).toBeVisible({ timeout: 30_000 });
    await d.getByTestId("avaliacao-sugerido").first().getByRole("button").click();
    await expect(d.getByTestId("avaliacao-aguarda-proposta")).toContainText("O avaliador tem 12 horas para responder", { timeout: 30_000 });
    pedido = (await adm().from("vistoria_pedidos").select("id").eq("property_id", ids.imovel).single()).data!.id as string;
    const l = await linha();
    expect(l.status).toBe("designado");
    expect(l.teste, "no piloto o pedido nasce de teste").toBe(true);
    expect(l.escolhido_em, "e foi o dono que escolheu").not.toBeNull();
    await d.context().close();

    const a = await entrar(browser, aval.email, senha);
    await largura(a, 390);
    await a.goto(`/dashboard/parceiro/avaliacao/${pedido}`, { waitUntil: "domcontentloaded" });
    const tela = a.getByTestId("pedido-avaliador");
    await expect(tela).toHaveAttribute("data-etapa", "novo", { timeout: 30_000 });
    // 12 horas declaradas: logo depois da escolha faltam 11 h e alguns minutos (com 24 h fixas seriam 23 h).
    await expect(tela.getByTestId("pedido-prazo-resposta")).toHaveText(/^Responda em 11 h \d{2} min$/);
    await a.goto("/dashboard/parceiro/avaliacao", { waitUntil: "domcontentloaded" });
    const item = a.locator(`[data-testid="avaliacao-designada"][data-pedido="${pedido}"]`);
    await expect(item.getByTestId("prazo-resposta")).toHaveText(/^Responda em 11 h \d{2} min$/, { timeout: 30_000 });
    await a.context().close();
  });

  test("2. enviada a proposta: o relógio de resposta para; os dois lados dizem que falta o aceite do dono, em 72 h da proposta", async ({ browser }) => {
    const a = await entrar(browser, aval.email, senha);
    await largura(a, 390);
    await a.goto(`/dashboard/parceiro/avaliacao/${pedido}`, { waitUntil: "domcontentloaded" });
    const tela = a.getByTestId("pedido-avaliador");
    await tela.getByRole("button", { name: "Aceitar pedido" }).click({ timeout: 30_000 });
    await tela.getByLabel("Seu valor (R$)").fill("250");
    await tela.getByLabel(/Prazo do laudo \(dias úteis/).fill("2");
    await tela.getByRole("button", { name: "Enviar proposta" }).click();
    await expect.poll(async () => (await linha()).proposta_em, { timeout: 20_000 }).not.toBeNull();
    const propostaEm = (await linha()).proposta_em as string;

    for (const w of LARGURAS) {
      await largura(a, w);
      // A tela do pedido: "Proposta enviada", com o prazo do DONO; nada de "aceito", agenda ou prazo de resposta.
      await a.goto(`/dashboard/parceiro/avaliacao/${pedido}`, { waitUntil: "domcontentloaded" });
      await expect(tela).toHaveAttribute("data-etapa", "proposta_enviada", { timeout: 30_000 });
      await expect(tela.getByTestId("pedido-etiqueta")).toHaveText("Proposta enviada");
      await expect(tela.getByTestId("pedido-aguarda-dono")).toContainText("Falta o proprietário aceitar a sua proposta");
      await expect(tela.getByTestId("pedido-prazo-aceite")).toHaveText(textoDoAceite(propostaEm));
      await expect(tela.getByTestId("pedido-prazo-resposta")).toHaveCount(0);
      await expect(tela.getByTestId("pedido-agendar")).toHaveCount(0);
      await expect(tela).not.toContainText("Aceito pelo proprietário");
      await expect(tela.getByRole("button", { name: "Aceitar pedido" })).toHaveCount(0);
      await semRolagemLateral(a);
      await a.screenshot({ path: `${SAIDA}/t1736-2-avaliador-pedido-${w}.png`, fullPage: true });

      // A lista do avaliador diz o mesmo.
      await a.goto("/dashboard/parceiro/avaliacao", { waitUntil: "domcontentloaded" });
      const item = a.locator(`[data-testid="avaliacao-designada"][data-pedido="${pedido}"]`);
      await expect(item.getByTestId("aguarda-aceite-proprietario")).toContainText("Falta o proprietário aceitar para agendar a visita.", { timeout: 30_000 });
      await expect(item.getByTestId("prazo-aceite")).toHaveText(textoDoAceite(propostaEm));
      await expect(item.getByTestId("prazo-resposta")).toHaveCount(0);
      await expect(item.getByTestId("proposta-avaliador")).toHaveCount(0);
      await expect(item.getByTestId("agendar-visita")).toHaveCount(0);
      await semRolagemLateral(a);
      await item.scrollIntoViewIfNeeded();
      await a.screenshot({ path: `${SAIDA}/t1736-2-avaliador-lista-${w}.png` });
    }
    await a.context().close();

    // O dono: a proposta viva, com as 72 horas dele — e sem agendar antes de aceitar.
    const d = await entrar(browser, dono.email, senha);
    for (const w of LARGURAS) {
      await largura(d, w);
      await d.goto(`/dashboard/imoveis/${ids.imovel}/nivel`, { waitUntil: "domcontentloaded" });
      const proposta = d.getByTestId("avaliacao-proposta");
      // E1156 (asserção alterada, ORDENS-DUET 712 e 713): o prazo do laudo é o combinado, em dias úteis depois da visita.
      await expect(proposta).toContainText("Proposta do avaliador: R$ 250,00 · laudo em até 2 dias úteis depois da visita", { timeout: 30_000 });
      await expect(proposta.getByTestId("avaliacao-proposta-prazo")).toContainText("Aceite em até 72 horas depois da proposta");
      await expect(d.getByTestId("dono-agendar")).toHaveCount(0);
      await expect(d.getByTestId("avaliacao-aguarda-proposta")).toHaveCount(0);
      await proposta.scrollIntoViewIfNeeded();
      await d.screenshot({ path: `${SAIDA}/t1736-2-dono-proposta-${w}.png` });
    }
    await d.context().close();
  });

  test("3. 30 horas depois da escolha, com a proposta feita há 1 hora: nenhum 'prazo de resposta vencido'; o prazo é o do dono", async ({ browser }) => {
    const hAtras = (n: number) => new Date(Date.now() - n * 3_600_000).toISOString();
    const propostaEm = hAtras(1);
    const p = await adm().from("vistoria_pedidos").update({ designado_em: hAtras(30), escolhido_em: hAtras(30), proposta_em: propostaEm }).eq("id", pedido);
    const g = await adm().from("vistoria_designacoes").update({ designado_em: hAtras(30), respondido_em: propostaEm }).eq("pedido_id", pedido);
    if (p.error ?? g.error) throw p.error ?? g.error;
    const gravada = (await linha()).proposta_em as string;

    const a = await entrar(browser, aval.email, senha);
    await largura(a, 390);
    await a.goto(`/dashboard/parceiro/avaliacao/${pedido}`, { waitUntil: "domcontentloaded" });
    const tela = a.getByTestId("pedido-avaliador");
    await expect(tela).toHaveAttribute("data-etapa", "proposta_enviada", { timeout: 30_000 });
    await expect(tela.getByTestId("pedido-prazo-aceite")).toHaveText(textoDoAceite(gravada));
    await expect(tela).not.toContainText("vencido");
    await expect(tela).not.toContainText("Responda em");
    await a.goto("/dashboard/parceiro/avaliacao", { waitUntil: "domcontentloaded" });
    const item = a.locator(`[data-testid="avaliacao-designada"][data-pedido="${pedido}"]`);
    await expect(item.getByTestId("prazo-aceite")).toHaveText(textoDoAceite(gravada), { timeout: 30_000 });
    await expect(item).not.toContainText("vencido");
    await expect(item.getByTestId("proposta-avaliador")).toHaveCount(0);
    await a.context().close();

    const d = await entrar(browser, dono.email, senha);
    await largura(d, 390);
    await d.goto(`/dashboard/imoveis/${ids.imovel}/nivel`, { waitUntil: "domcontentloaded" });
    await expect(d.getByTestId("avaliacao-proposta")).toContainText("Proposta do avaliador: R$ 250,00 · laudo em até 2 dias úteis depois da visita", { timeout: 30_000 });
    await d.context().close();
  });

  test("4. o dono aceita: os dois lados passam a 'aceito' e o avaliador pode agendar", async ({ browser }) => {
    const d = await entrar(browser, dono.email, senha);
    await largura(d, 390);
    await d.goto(`/dashboard/imoveis/${ids.imovel}/nivel`, { waitUntil: "domcontentloaded" });
    await d.getByTestId("avaliacao-proposta").getByRole("button", { name: "Aceitar valor e prazo" }).click({ timeout: 30_000 });
    await expect.poll(async () => (await linha()).proposta_aceita_em, { timeout: 20_000 }).not.toBeNull();
    await expect(d.getByTestId("avaliacao-proposta-aceita")).toContainText("Combinado com o avaliador: R$ 250,00 · laudo em até 2 dias úteis depois da visita.", { timeout: 30_000 });
    await expect(d.getByTestId("dono-agendar")).toBeVisible();
    await d.context().close();

    const a = await entrar(browser, aval.email, senha);
    await largura(a, 390);
    await a.goto(`/dashboard/parceiro/avaliacao/${pedido}`, { waitUntil: "domcontentloaded" });
    const tela = a.getByTestId("pedido-avaliador");
    await expect(tela).toHaveAttribute("data-etapa", "aceito", { timeout: 30_000 });
    await expect(tela.getByTestId("pedido-etiqueta")).toHaveText("Aceito pelo proprietário");
    await expect(tela.getByTestId("pedido-agendar")).toBeVisible();
    await expect(tela.getByTestId("pedido-prazo-aceite")).toHaveCount(0);
    await a.goto("/dashboard/parceiro/avaliacao", { waitUntil: "domcontentloaded" });
    const item = a.locator(`[data-testid="avaliacao-designada"][data-pedido="${pedido}"]`);
    await expect(item.getByTestId("agendar-visita")).toBeVisible({ timeout: 30_000 });
    await expect(item.getByTestId("aguarda-aceite-proprietario")).toHaveCount(0);
    await a.context().close();
  });
});
