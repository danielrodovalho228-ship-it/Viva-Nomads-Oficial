import { test, expect, type Page } from "@playwright/test";
import { NO_LABORATORIO, adm, apagarContas, cnpjAleatorio, criarConta, criarImovelPronto, entrar, novaSenha, novoSufixo } from "../fixtures/laboratorio";

/*
  T1756 — E1154 @E1154 (ORDEM-DUET-651; D3 da varredura do lado do dono, ORDEM-DUET-656; linha Parceiros): para o mesmo
  prazo de aceite, o avaliador lia a hora de fim ("O proprietário tem até 27/11/2026 03:46…") e o dono, que é quem tem
  de agir, lia só "Aceite em até 72 horas depois da proposta". O bloco da proposta do dono passa a mostrar o mesmo
  instante, no mesmo formato, do mesmo relógio.
  Só contas de teste; cidade própria do spec. Laboratório; não é prova ao vivo no site.
   1. O dono lê a frase de sempre com a hora de fim: 72 horas depois da proposta, no horário de Brasília. 390 e 1280 px.
   2. O avaliador lê essa MESMA hora, escrita igual, na lista e na tela do pedido.
*/
const LARGURAS = [390, 1280] as const;
const SAIDA = "tests/laboratorio/saida";
const CIDADE = "Nova Ponte";
const HORA = 3_600_000;
// A proposta foi enviada há 10 horas, num minuto inteiro (a tela escreve a hora de fim até ao minuto).
const PROPOSTA_EM = new Date(Math.floor((Date.now() - 10 * HORA) / 60_000) * 60_000).toISOString();
/** "27/11/2026 03:46 (horário de Brasília)", como a tela escreve. */
function dataHoraDeBrasilia(iso: string): string {
  const p = Object.fromEntries(new Intl.DateTimeFormat("pt-BR", { timeZone: "America/Sao_Paulo", day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit", hour12: false }).formatToParts(new Date(iso)).map((x) => [x.type, x.value]));
  return `${p.day}/${p.month}/${p.year} ${p.hour}:${p.minute} (horário de Brasília)`;
}
const FIM = dataHoraDeBrasilia(new Date(Date.parse(PROPOSTA_EM) + 72 * HORA).toISOString());
const senha = novaSenha();
const sufixo = novoSufixo();
const dono = { email: `dono.t1756.${sufixo}@lab.vivanomads.test`, nome: "Dora Prazo", role: "owner" as const };
const avaliador = { email: `aval.t1756.${sufixo}@lab.vivanomads.test`, nome: "Abel Avaliador", role: "tenant" as const };
const TITULO = `Lar QA ${sufixo}`;
const ids: Record<string, string> = {};

async function largura(page: Page, w: number) {
  await page.setViewportSize({ width: w, height: w === 390 ? 844 : 900 });
}
const semRolagemLateral = (p: Page) => p.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth + 1);

test.describe("T1756 — E1154: o dono lê a hora exata em que o prazo do aceite termina, a mesma do avaliador @E1154", () => {
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
      .insert({ user_id: ids.avaliador, tipo_pessoa: "pj", documento: cnpjAleatorio(), nome_publico: avaliador.nome, slug: `aval-t1756-${sufixo}`, categorias: ["fotografia"], cidades: [CIDADE] })
      .select("id")
      .single();
    if (eP) throw eP;
    ids.parc = parc.id as string;
    const { data: n } = await adm().rpc("proximo_numero_avaliador", { p_sigla: "UDI" });
    const { data: cred, error: eC } = await adm()
      .from("avaliadores_credenciamento")
      .insert({ parceiro_id: ids.parc, cidade: CIDADE, numero_credenciado: n as string, status: "ativo", experiencia_link: "https://portfolio.lab.vivanomads.test/t1756", conduta_versao: "2026-10-23", ativado_em: "2025-01-01T00:00:00Z" })
      .select("id")
      .single();
    if (eC) throw eC;
    ids.cred = cred.id as string;
    for (const u of [ids.dono, ids.avaliador]) {
      const p = await adm().from("vistoria_piloto").insert({ user_id: u, nota: "T1756 (laboratório)" });
      if (p.error) throw p.error;
    }
    ids.imovel = await criarImovelPronto(ids.dono, TITULO, { ativo: true });
    const cid = await adm().from("properties").update({ city: CIDADE }).eq("id", ids.imovel);
    if (cid.error) throw cid.error;
    const { error: eT } = await adm()
      .from("vistoria_precos")
      .insert(["estudio", "q1_2", "q3_mais"].map((porte) => ({ cidade: CIDADE, porte, valor: porte === "q1_2" ? 350 : 300 })));
    if (eT) throw eT;
    // O avaliador escolhido pelo dono já enviou a proposta (R$ 380,00 · laudo em 5 dias), há 10 horas: dentro do prazo.
    const proposta = PROPOSTA_EM;
    const escolha = new Date(Date.now() - 12 * HORA).toISOString();
    const { data: ped, error: ePed } = await adm()
      .from("vistoria_pedidos")
      .insert({ property_id: ids.imovel, owner_id: ids.dono, cidade: CIDADE, porte: "q1_2", valor_tabela: 350, status: "designado", teste: true, avaliador_id: ids.cred, designado_em: escolha, escolhido_em: escolha, valor_proposto: 380, prazo_proposto_dias: 5, proposta_em: proposta })
      .select("id")
      .single();
    if (ePed) throw ePed;
    ids.pedido = ped.id as string;
    const d = await adm().from("vistoria_designacoes").insert({ pedido_id: ids.pedido, avaliador_id: ids.cred, designado_em: escolha, resposta: "aceita", respondido_em: proposta });
    if (d.error) throw d.error;
  });

  test.afterAll(async () => {
    const contas = [ids.dono, ids.avaliador].filter(Boolean);
    if (contas.length) {
      await adm().from("emails_teste").delete().in("usuario_id", contas);
      await adm().from("avisos").delete().in("usuario_id", contas);
    }
    if (ids.pedido) {
      await adm().from("vistoria_fila_admin").delete().eq("pedido_id", ids.pedido);
      await adm().from("vistoria_designacoes").delete().eq("pedido_id", ids.pedido);
    }
    if (ids.imovel) await adm().from("vistoria_pedidos").delete().eq("property_id", ids.imovel);
    await adm().from("vistoria_precos").delete().eq("cidade", CIDADE);
    if (contas.length) await adm().from("vistoria_piloto").delete().in("user_id", contas);
    if (ids.cred) {
      await adm().from("vistoria_designacoes").delete().eq("avaliador_id", ids.cred);
      await adm().from("avaliadores_credenciamento").delete().eq("id", ids.cred);
    }
    if (ids.parc) await adm().from("parceiros").delete().eq("id", ids.parc);
    if (ids.imovel) await adm().from("properties").delete().eq("id", ids.imovel);
    await apagarContas(contas);
  });

  test("1. o dono lê o prazo do aceite com a hora de fim: 72 horas depois da proposta, no horário de Brasília", async ({ browser }) => {
    const d = await entrar(browser, dono.email, senha);
    for (const w of LARGURAS) {
      await largura(d, w);
      await d.goto(`/dashboard/imoveis/${ids.imovel}/nivel`, { waitUntil: "domcontentloaded" });
      const proposta = d.getByTestId("avaliacao-proposta");
      await expect(proposta).toBeVisible({ timeout: 30_000 });
      await expect(proposta).toContainText("Proposta do avaliador: R$ 380,00 · laudo em 5 dias");
      await expect(proposta.getByTestId("avaliacao-proposta-prazo"), `a ${w} px`).toHaveText(`Aceite em até 72 horas depois da proposta, até ${FIM}; passado o prazo, você escolhe outro avaliador.`);
      // O prazo é dito uma vez só no bloco da proposta, e o botão continua lá.
      expect(((await proposta.innerText()).match(/72 horas/g) ?? []).length).toBe(1);
      await expect(proposta.getByTestId("aceitar-proposta").getByRole("button", { name: "Aceitar valor e prazo" })).toBeVisible();
      expect(await semRolagemLateral(d), `a ${w} px: sem rolagem lateral`).toBe(true);
      await proposta.scrollIntoViewIfNeeded();
      await d.screenshot({ path: `${SAIDA}/t1756-1-dono-${w}.png` });
    }
    await d.context().close();
  });

  test("2. o avaliador lê a MESMA hora de fim, escrita igual, na lista e na tela do pedido", async ({ browser }) => {
    const a = await entrar(browser, avaliador.email, senha);
    await largura(a, 390);
    await a.goto("/dashboard/parceiro/avaliacao", { waitUntil: "domcontentloaded" });
    const item = a.locator(`[data-testid="avaliacao-designada"][data-pedido="${ids.pedido}"]`);
    await expect(item.getByTestId("prazo-aceite")).toHaveText(`O proprietário tem até ${FIM} para aceitar: 72 horas depois da proposta. Sem o aceite, o pedido volta para ele escolher de novo.`, { timeout: 30_000 });
    await a.goto(`/dashboard/parceiro/avaliacao/${ids.pedido}`, { waitUntil: "domcontentloaded" });
    await expect(a.getByTestId("pedido-avaliador").getByTestId("pedido-prazo-aceite")).toContainText(`até ${FIM}`, { timeout: 30_000 });
    await a.context().close();
  });
});
