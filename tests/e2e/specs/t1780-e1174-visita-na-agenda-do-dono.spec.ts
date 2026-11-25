import { test, expect, type Page } from "@playwright/test";
import { NO_LABORATORIO, adm, apagarContas, cnpjAleatorio, criarConta, criarImovelPronto, entrar, novaSenha, novoSufixo } from "../fixtures/laboratorio";

/*
  T1780 — E1174 @E1174 (ORDENS-DUET 752 e 788; linha Parceiros).
  A visita CONFIRMADA de uma avaliação aparecia na Agenda do avaliador (E1103) e no bloco do imóvel, mas não na Agenda
  do dono. A cura: a Agenda do dono lê também as visitas de avaliação dos imóveis dele, pela mesma regra do avaliador
  (pedido "agendado" com data). O imóvel ocupado só chega a "agendado" quando o morador concorda.
  Cenário do piloto, como em produção: chave desligada (sem o cookie do laboratório), contas de teste na lista do
  piloto. Massa e cidade próprias (Iraí de Minas); só contas de teste.
   1. Imóvel livre com a visita marcada: a Agenda do dono mostra "15:00 Visita de avaliação" com o imóvel, sem
      "Interessado(a)", e a linha leva ao bloco da avaliação daquele imóvel. A 390 e a 1280 px, com print.
   2. Imóvel ocupado: enquanto o morador não concorda, a data é uma proposta e não entra na Agenda; depois da
      concordância, entra.
   3. O filtro por imóvel vale para a visita de avaliação como para os outros itens.
   4. Outro dono não vê a visita na Agenda dele.
  A concordância do caso 2 é gravada direto no banco, com os mesmos campos que a ação do morador grava; a ação em si
  está na t303 e na t1767.
  Laboratório; não é prova ao vivo no site.
*/
const LARGURAS = [390, 1280] as const;
const SAIDA = "tests/laboratorio/saida";
const CIDADE = "Iraí de Minas";
const senha = novaSenha();
const sufixo = novoSufixo();
const dono = { email: `dono.t1780.${sufixo}@lab.vivanomads.test`, nome: "Dora Agenda", role: "owner" as const };
const outroDono = { email: `outro.t1780.${sufixo}@lab.vivanomads.test`, nome: "Olavo Agenda", role: "owner" as const };
const aval = { email: `av.t1780.${sufixo}@lab.vivanomads.test`, nome: "Ari Agenda", role: "tenant" as const };
const TITULO = { livre: `[TESTE QA] t1780 Casa livre ${sufixo}`, ocupado: `[TESTE QA] t1780 Casa ocupada ${sufixo}`, alheio: `[TESTE QA] t1780 Casa do outro ${sufixo}` };
const ids: Record<string, string> = {};
const imoveis: string[] = [];
/** Daqui a `dias`, às 15:00 de Brasília (18:00 UTC): cai no mesmo dia nos dois fusos. */
function as15h(dias: number): string {
  const d = new Date(Date.now() + dias * 86_400_000);
  d.setUTCHours(18, 0, 0, 0);
  return d.toISOString();
}
const ha = (horas: number) => new Date(Date.now() - horas * 3_600_000).toISOString();

async function largura(page: Page, w: number) {
  await page.setViewportSize({ width: w, height: w === 390 ? 844 : 900 });
}
const semRolagemLateral = async (page: Page) => expect(await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth)).toBeLessThanOrEqual(1);
/** A Agenda do dono, na vista de lista (os próximos dias, sem depender do mês aberto). */
async function agendaEmLista(page: Page) {
  await page.goto("/dashboard/agenda", { waitUntil: "domcontentloaded" });
  await expect(page.getByTestId("agenda")).toBeVisible({ timeout: 30_000 });
  await expect(async () => {
    await page.getByTestId("agenda-vista-lista").click();
    await expect(page.getByTestId("agenda-vista-lista")).toHaveAttribute("aria-selected", "true", { timeout: 2_000 });
  }).toPass({ timeout: 20_000 });
}
const linhaDaAvaliacao = (page: Page, pedido: string) => page.locator(`[data-testid="agenda-item"][data-id="avaliacao-${pedido}"]`);

async function pedido(chave: string, imovel: string, campos: Record<string, unknown>): Promise<void> {
  const { data, error } = await adm()
    .from("vistoria_pedidos")
    .insert({ property_id: imovel, owner_id: ids.dono, cidade: CIDADE, porte: "q1_2", valor_tabela: 350, avaliador_id: ids.cred, teste: true, designado_em: ha(72), escolhido_em: ha(72), valor_proposto: 300, prazo_proposto_dias: 3, prazo_laudo_dias_uteis: 3, proposta_em: ha(60), proposta_aceita_em: ha(48), ...campos })
    .select("id")
    .single();
  if (error) throw error;
  const { error: e2 } = await adm().from("vistoria_designacoes").insert({ pedido_id: data.id, avaliador_id: ids.cred, designado_em: ha(72), resposta: "aceita", respondido_em: ha(60) });
  if (e2) throw e2;
  ids[chave] = data.id as string;
}

test.describe("T1780 — E1174: a visita de avaliação confirmada aparece na Agenda do dono @E1174", () => {
  test.skip(!NO_LABORATORIO, "Só no laboratório.");
  test.describe.configure({ mode: "serial", timeout: 240_000 });

  test.beforeAll(async () => {
    ids.dono = await criarConta(dono, senha);
    ids.outroDono = await criarConta(outroDono, senha);
    ids.aval = await criarConta(aval, senha);
    const t = await adm().from("profiles").update({ is_teste: true }).in("id", [ids.dono, ids.outroDono, ids.aval]);
    if (t.error) throw t.error;
    const { data: parc, error } = await adm()
      .from("parceiros")
      .insert({ user_id: ids.aval, tipo_pessoa: "pj", documento: cnpjAleatorio(), nome_publico: aval.nome, slug: `av-t1780-${sufixo}`, categorias: ["fotografia"], cidades: [CIDADE] })
      .select("id")
      .single();
    if (error) throw error;
    ids.parc = parc.id as string;
    const { data: n } = await adm().rpc("proximo_numero_avaliador", { p_sigla: "UDI" });
    const { data: c, error: e2 } = await adm()
      .from("avaliadores_credenciamento")
      .insert({ parceiro_id: parc.id, cidade: CIDADE, numero_credenciado: n, status: "ativo", experiencia_link: "https://portfolio.lab.vivanomads.test/t1780", conduta_versao: "2026-10-23", ativado_em: "2025-01-01T00:00:00Z" })
      .select("id")
      .single();
    if (e2) throw e2;
    ids.cred = c.id as string;
    for (const u of [ids.dono, ids.outroDono, ids.aval]) {
      const p = await adm().from("vistoria_piloto").insert({ user_id: u, nota: "T1780 (laboratório)" });
      if (p.error) throw p.error;
    }
    ids.imovelLivre = await criarImovelPronto(ids.dono, TITULO.livre, { ativo: true });
    ids.imovelOcupado = await criarImovelPronto(ids.dono, TITULO.ocupado, { ativo: true });
    ids.imovelAlheio = await criarImovelPronto(ids.outroDono, TITULO.alheio, { ativo: true });
    imoveis.push(ids.imovelLivre, ids.imovelOcupado, ids.imovelAlheio);
    const cid = await adm().from("properties").update({ city: CIDADE }).in("id", imoveis);
    if (cid.error) throw cid.error;
    // Imóvel livre: a visita marcada fica logo confirmada ("agendado").
    await pedido("pedidoLivre", ids.imovelLivre, { status: "agendado", agendado_para: as15h(2) });
    // Imóvel ocupado: a data proposta espera o morador; o pedido segue "designado" até ele concordar.
    await pedido("pedidoOcupado", ids.imovelOcupado, { status: "designado", ocupado: true, agendado_para: as15h(3), concordancia_pedida_em: ha(1) });
  });

  test.afterAll(async () => {
    if (imoveis.length) {
      const ped = ((await adm().from("vistoria_pedidos").select("id").in("property_id", imoveis)).data ?? []).map((x) => x.id as string);
      if (ped.length) await adm().from("vistoria_fila_admin").delete().in("pedido_id", ped);
      if (ids.cred) await adm().from("vistoria_designacoes").delete().eq("avaliador_id", ids.cred);
      await adm().from("vistoria_pedidos").delete().in("property_id", imoveis);
    }
    const contas = [ids.dono, ids.outroDono, ids.aval].filter(Boolean);
    if (contas.length) await adm().from("vistoria_piloto").delete().in("user_id", contas);
    if (ids.cred) await adm().from("avaliadores_credenciamento").delete().eq("id", ids.cred);
    if (ids.parc) await adm().from("parceiros").delete().eq("id", ids.parc);
    if (imoveis.length) await adm().from("properties").delete().in("id", imoveis);
    if (contas.length) {
      await adm().from("emails_teste").delete().in("usuario_id", contas);
      await adm().from("avisos").delete().in("usuario_id", contas);
    }
    await apagarContas(contas);
  });

  test("1. imóvel livre com a visita marcada: a Agenda do dono mostra a visita de avaliação e leva ao bloco do imóvel", async ({ browser }) => {
    const d = await entrar(browser, dono.email, senha);
    for (const w of LARGURAS) {
      await largura(d, w);
      await agendaEmLista(d);
      const linha = linhaDaAvaliacao(d, ids.pedidoLivre);
      await expect(linha, `a ${w} px: a visita de avaliação está na Agenda do dono`).toBeVisible({ timeout: 20_000 });
      await expect(linha).toHaveAttribute("data-avaliacao", "1");
      await expect(linha).toContainText("15:00");
      await expect(linha).toContainText("Visita de avaliação");
      await expect(linha).toContainText(TITULO.livre);
      // Quem vem é o avaliador: a linha não diz "Interessado(a)" nem "Visita presencial".
      await expect(linha).not.toContainText("Interessado(a)");
      await expect(linha).not.toContainText("presencial");
      await expect(linha.getByRole("link")).toHaveAttribute("href", `/dashboard/imoveis/${ids.imovelLivre}/nivel#avaliacao`);
      await semRolagemLateral(d);
      await linha.scrollIntoViewIfNeeded();
      await d.screenshot({ path: `${SAIDA}/t1780-1-agenda-do-dono-${w}.png` });
    }
    // O clique leva ao bloco da avaliação daquele imóvel.
    await linhaDaAvaliacao(d, ids.pedidoLivre).getByRole("link").click();
    await expect(d).toHaveURL(new RegExp(`/dashboard/imoveis/${ids.imovelLivre}/nivel#avaliacao$`), { timeout: 30_000 });
    await expect(d.getByTestId("avaliacao-dono")).toBeVisible({ timeout: 30_000 });
    await d.context().close();
  });

  test("2. imóvel ocupado: a data proposta não entra na Agenda; depois de o morador concordar, entra", async ({ browser }) => {
    const d = await entrar(browser, dono.email, senha);
    await agendaEmLista(d);
    await expect(linhaDaAvaliacao(d, ids.pedidoLivre), "a Agenda carregou").toBeVisible({ timeout: 20_000 });
    await expect(linhaDaAvaliacao(d, ids.pedidoOcupado), "sem a concordância do morador, a data é só uma proposta").toHaveCount(0);
    // O morador concorda: os mesmos campos que a ação dele grava.
    const up = await adm().from("vistoria_pedidos").update({ concordancia_em: new Date().toISOString(), status: "agendado" }).eq("id", ids.pedidoOcupado);
    if (up.error) throw up.error;
    await agendaEmLista(d);
    const linha = linhaDaAvaliacao(d, ids.pedidoOcupado);
    await expect(linha, "depois da concordância, a visita está na Agenda do dono").toBeVisible({ timeout: 20_000 });
    await expect(linha).toContainText("Visita de avaliação");
    await expect(linha).toContainText(TITULO.ocupado);
    await d.context().close();
  });

  test("3. o filtro por imóvel vale para a visita de avaliação", async ({ browser }) => {
    const d = await entrar(browser, dono.email, senha);
    await largura(d, 1280);
    await agendaEmLista(d);
    await expect(linhaDaAvaliacao(d, ids.pedidoLivre)).toBeVisible({ timeout: 20_000 });
    await expect(linhaDaAvaliacao(d, ids.pedidoOcupado)).toBeVisible();
    await d.getByTestId("agenda-filtro-imovel").selectOption(ids.imovelOcupado);
    await expect(linhaDaAvaliacao(d, ids.pedidoLivre)).toHaveCount(0);
    await expect(linhaDaAvaliacao(d, ids.pedidoOcupado)).toBeVisible();
    await d.context().close();
  });

  test("4. outro dono não vê a visita na Agenda dele", async ({ browser }) => {
    const o = await entrar(browser, outroDono.email, senha);
    await agendaEmLista(o);
    await expect(o.locator('[data-testid="agenda-item"][data-avaliacao="1"]')).toHaveCount(0);
    await expect(o.getByTestId("agenda")).not.toContainText("Visita de avaliação");
    await o.context().close();
  });
});
