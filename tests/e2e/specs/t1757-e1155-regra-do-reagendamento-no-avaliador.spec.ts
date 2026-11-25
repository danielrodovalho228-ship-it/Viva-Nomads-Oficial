import { test, expect, type Page } from "@playwright/test";
import { NO_LABORATORIO, adm, apagarContas, cnpjAleatorio, criarConta, criarImovelPronto, entrar, novaSenha, novoSufixo } from "../fixtures/laboratorio";

/*
  T1757 — E1155 @E1155 (ORDEM-DUET-652, linha Parceiros, achado da passagem ao vivo): com a visita marcada, o dono lia
  junto do "Reagendar" a regra "Reagendar sem custo: uma vez, com pelo menos 24 horas de aviso."; o avaliador, no
  formulário dele, não lia regra nenhuma — e ela vale igual para os dois.
  Só contas de teste; cidade própria do spec. Laboratório; não é prova ao vivo no site.
   1. O dono (já era assim): com a visita marcada, "Reagendar" e a regra; sem data, "Propor data" e nenhuma regra.
   2. O avaliador: com a visita marcada, "Reagendar" e a MESMA regra, dentro do formulário; sem data, "Agendar" e
      nenhuma regra. Print a 390 e a 1280 px.
*/
const LARGURAS = [390, 1280] as const;
const SAIDA = "tests/laboratorio/saida";
const CIDADE = "Santa Juliana";
const REGRA = "Reagendar sem custo: uma vez, com pelo menos 24 horas de aviso."; // REGRA_DO_REAGENDAMENTO (regras.ts)
const HORA = 3_600_000;
const senha = novaSenha();
const sufixo = novoSufixo();
const dono = { email: `dono.t1757.${sufixo}@lab.vivanomads.test`, nome: "Dora Agenda", role: "owner" as const };
const avaliador = { email: `aval.t1757.${sufixo}@lab.vivanomads.test`, nome: "Abel Avaliador", role: "tenant" as const };
const TITULOS = { semData: `Lar sem data ${sufixo}`, marcada: `Lar com visita ${sufixo}` };
const ids: Record<string, string> = {};

async function largura(page: Page, w: number) {
  await page.setViewportSize({ width: w, height: w === 390 ? 844 : 900 });
}
const semRolagemLateral = (p: Page) => p.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth + 1);

/** O pedido com a proposta do avaliador (R$ 380,00 · 5 dias) aceita pelo dono; com `visita`, já agendado para essa data. */
async function pedidoAceito(imovel: string, visita: string | null): Promise<string> {
  const escolha = new Date(Date.now() - 30 * HORA).toISOString();
  const proposta = new Date(Date.now() - 28 * HORA).toISOString();
  const aceite = new Date(Date.now() - 26 * HORA).toISOString();
  const { data, error } = await adm()
    .from("vistoria_pedidos")
    .insert({ property_id: imovel, owner_id: ids.dono, cidade: CIDADE, porte: "q1_2", valor_tabela: 350, status: visita ? "agendado" : "designado", teste: true, avaliador_id: ids.cred, designado_em: escolha, escolhido_em: escolha, valor_proposto: 380, prazo_proposto_dias: 5, proposta_em: proposta, proposta_aceita_em: aceite, agendado_para: visita })
    .select("id")
    .single();
  if (error) throw error;
  const d = await adm().from("vistoria_designacoes").insert({ pedido_id: data.id, avaliador_id: ids.cred, designado_em: escolha, resposta: "aceita", respondido_em: proposta });
  if (d.error) throw d.error;
  return data.id as string;
}

test.describe("T1757 — E1155: o avaliador lê a regra do reagendamento no formulário dele, a mesma do dono @E1155", () => {
  test.skip(!NO_LABORATORIO, "Só no laboratório.");
  test.describe.configure({ mode: "serial", timeout: 240_000 });

  test.beforeAll(async () => {
    for (const [k, c] of [["dono", dono], ["avaliador", avaliador]] as const) {
      ids[k] = await criarConta(c, senha);
      const t = await adm().from("profiles").update({ is_teste: true }).eq("id", ids[k]);
      if (t.error) throw t.error;
    }
    const { data: parc, error: eP } = await adm()
      .from("parceiros")
      .insert({ user_id: ids.avaliador, tipo_pessoa: "pj", documento: cnpjAleatorio(), nome_publico: avaliador.nome, slug: `aval-t1757-${sufixo}`, categorias: ["fotografia"], cidades: [CIDADE] })
      .select("id")
      .single();
    if (eP) throw eP;
    ids.parc = parc.id as string;
    const { data: n } = await adm().rpc("proximo_numero_avaliador", { p_sigla: "UDI" });
    const { data: cred, error: eC } = await adm()
      .from("avaliadores_credenciamento")
      .insert({ parceiro_id: ids.parc, cidade: CIDADE, numero_credenciado: n as string, status: "ativo", experiencia_link: "https://portfolio.lab.vivanomads.test/t1757", conduta_versao: "2026-10-23", ativado_em: "2025-01-01T00:00:00Z" })
      .select("id")
      .single();
    if (eC) throw eC;
    ids.cred = cred.id as string;
    for (const u of [ids.dono, ids.avaliador]) {
      const p = await adm().from("vistoria_piloto").insert({ user_id: u, nota: "T1757 (laboratório)" });
      if (p.error) throw p.error;
    }
    ids.imovelSemData = await criarImovelPronto(ids.dono, TITULOS.semData, { ativo: true });
    ids.imovelMarcada = await criarImovelPronto(ids.dono, TITULOS.marcada, { ativo: true });
    const cid = await adm().from("properties").update({ city: CIDADE }).in("id", [ids.imovelSemData, ids.imovelMarcada]);
    if (cid.error) throw cid.error;
    const { error: eT } = await adm()
      .from("vistoria_precos")
      .insert(["estudio", "q1_2", "q3_mais"].map((porte) => ({ cidade: CIDADE, porte, valor: porte === "q1_2" ? 350 : 300 })));
    if (eT) throw eT;
    // Dois pedidos com a proposta aceita pelo dono: um ainda sem data de visita, outro com a visita marcada.
    ids.pedidoSemData = await pedidoAceito(ids.imovelSemData, null);
    ids.pedidoMarcada = await pedidoAceito(ids.imovelMarcada, new Date(Date.now() + 3 * 24 * HORA).toISOString());
  });

  test.afterAll(async () => {
    const contas = [ids.dono, ids.avaliador].filter(Boolean);
    const imoveis = [ids.imovelSemData, ids.imovelMarcada].filter(Boolean);
    const pedidos = [ids.pedidoSemData, ids.pedidoMarcada].filter(Boolean);
    if (contas.length) {
      await adm().from("emails_teste").delete().in("usuario_id", contas);
      await adm().from("avisos").delete().in("usuario_id", contas);
    }
    if (pedidos.length) {
      await adm().from("vistoria_fila_admin").delete().in("pedido_id", pedidos);
      await adm().from("vistoria_designacoes").delete().in("pedido_id", pedidos);
    }
    if (imoveis.length) await adm().from("vistoria_pedidos").delete().in("property_id", imoveis);
    await adm().from("vistoria_precos").delete().eq("cidade", CIDADE);
    if (contas.length) await adm().from("vistoria_piloto").delete().in("user_id", contas);
    if (ids.cred) {
      await adm().from("vistoria_designacoes").delete().eq("avaliador_id", ids.cred);
      await adm().from("avaliadores_credenciamento").delete().eq("id", ids.cred);
    }
    if (ids.parc) await adm().from("parceiros").delete().eq("id", ids.parc);
    if (imoveis.length) await adm().from("properties").delete().in("id", imoveis);
    await apagarContas(contas);
  });

  test("1. o dono (como já era): com a visita marcada, 'Reagendar' e a regra; sem data, 'Propor data' e nenhuma regra", async ({ browser }) => {
    const d = await entrar(browser, dono.email, senha);
    await largura(d, 390);
    await d.goto(`/dashboard/imoveis/${ids.imovelMarcada}/nivel`, { waitUntil: "domcontentloaded" });
    const marcada = d.getByTestId("dono-agendar");
    await expect(marcada.getByRole("button", { name: "Reagendar" })).toBeVisible({ timeout: 30_000 });
    await expect(marcada).toContainText(REGRA);
    await d.goto(`/dashboard/imoveis/${ids.imovelSemData}/nivel`, { waitUntil: "domcontentloaded" });
    const semData = d.getByTestId("dono-agendar");
    await expect(semData.getByRole("button", { name: "Propor data" })).toBeVisible({ timeout: 30_000 });
    await expect(semData).not.toContainText("Reagendar sem custo");
    await d.context().close();
  });

  test("2. o avaliador: com a visita marcada, 'Reagendar' e a MESMA regra dentro do formulário; sem data, 'Agendar' e nenhuma regra", async ({ browser }) => {
    const a = await entrar(browser, avaliador.email, senha);
    for (const w of LARGURAS) {
      await largura(a, w);
      await a.goto("/dashboard/parceiro/avaliacao", { waitUntil: "domcontentloaded" });
      const marcada = a.locator(`[data-testid="avaliacao-designada"][data-pedido="${ids.pedidoMarcada}"]`).getByTestId("agendar-visita");
      await expect(marcada.getByRole("button", { name: "Reagendar" })).toBeVisible({ timeout: 30_000 });
      await expect(marcada.getByTestId("regra-reagendar"), `a ${w} px`).toHaveText(REGRA);
      // A regra é dita uma vez só no formulário, depois do botão.
      expect(((await marcada.innerText()).match(/Reagendar sem custo/g) ?? []).length).toBe(1);
      const ordem = await marcada.evaluate((f) => {
        const b = f.querySelector('button[type="submit"]')!.getBoundingClientRect();
        const r = f.querySelector('[data-testid="regra-reagendar"]')!.getBoundingClientRect();
        return { fimDoBotao: b.bottom, topoDaRegra: r.top };
      });
      expect(ordem.topoDaRegra, "a regra vem depois do botão").toBeGreaterThanOrEqual(ordem.fimDoBotao - 1);
      const semData = a.locator(`[data-testid="avaliacao-designada"][data-pedido="${ids.pedidoSemData}"]`).getByTestId("agendar-visita");
      await expect(semData.getByRole("button", { name: "Agendar", exact: true })).toBeVisible();
      await expect(semData.getByTestId("regra-reagendar"), "sem visita marcada não há o que reagendar").toHaveCount(0);
      expect(await semRolagemLateral(a), `a ${w} px: sem rolagem lateral`).toBe(true);
      await marcada.scrollIntoViewIfNeeded();
      await a.screenshot({ path: `${SAIDA}/t1757-2-avaliador-${w}.png` });
    }
    await a.context().close();
  });
});
