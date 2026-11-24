import { test, expect } from "@playwright/test";
import { authFile } from "../fixtures/auth";
import { NO_LABORATORIO, adm, apagarContas, cnpjAleatorio, criarConta, criarImovelPronto, novaSenha, novoSufixo } from "../fixtures/laboratorio";

/*
  T1766 — E1159 @E1159 (ORDENS-DUET 658 e 679; linha Parceiros). A proposta de avaliação que expirou sem o aceite do
  dono (E1142) e a que o dono descartou (E1146) saíram da lista "Recusas e ausências" da equipe — não são recusa do
  avaliador — e ficaram sem lugar nenhum. Passam a ter uma secção própria no mesmo painel de /admin/avaliadores:
  "Propostas expiradas ou descartadas (30 dias)", com o avaliador, o imóvel e quando. Não conta no "Para decidir".
  Massa só no banco, em pedidos já cancelados (nenhuma rotina lhes toca), de um avaliador e uma dona de teste:
   • EXPIRADA há 2 dias, num imóvel; DESCARTADA há 1 dia, noutro;
   • uma expirada há 40 dias (fora da janela) e uma recusa comum do avaliador, há 3 dias.
   1. A secção mostra as duas, a mais recente primeiro, cada uma com o nº do avaliador, o título do imóvel com o código
      VN, o rótulo da casa e a data; a de 40 dias não entra; a recusa comum fica na lista das recusas e não na secção.
      Print a 390 e a 1280 px.
   2. O número do topo "recusas e ausências" continua a ser o da lista das recusas: as propostas não o aumentam.
  Laboratório; não é prova ao vivo no site.
*/
const LARGURAS = [1280, 390] as const;
const SAIDA = "tests/laboratorio/saida";
const CIDADE = "Abadia dos Dourados";
const DIA = 86_400_000;
const ROTULO_EXPIRADA = "Proposta expirada sem o aceite do proprietário"; // ROTULO_PROPOSTA_EXPIRADA (relogio-do-pedido.ts)
const ROTULO_DESCARTADA = "Proposta recusada pelo proprietário"; // ROTULO_PROPOSTA_DESCARTADA
const senha = novaSenha();
const sufixo = novoSufixo();
const dona = { email: `dona.t1766.${sufixo}@lab.vivanomads.test`, nome: "Dora Propostas", role: "owner" as const };
const avaliador = { email: `aval.t1766.${sufixo}@lab.vivanomads.test`, nome: "Valdo Propostas", role: "tenant" as const };
const TITULO = { expirada: `Casa da expirada t1766 ${sufixo}`, descartada: `Casa da descartada t1766 ${sufixo}` };
const ids: Record<string, string> = {};
let numero = "";
const ha = (dias: number) => new Date(Date.now() - dias * DIA).toISOString();
const dataDeBrasilia = (iso: string) => new Intl.DateTimeFormat("pt-BR", { timeZone: "America/Sao_Paulo", day: "2-digit", month: "2-digit", year: "numeric" }).format(new Date(iso));
const codigoVN = (id: string) => `VN-${id.replace(/[^a-zA-Z0-9]/g, "").slice(0, 6).toUpperCase()}`; // codigoDoImovel (imovel-pagina.ts)

/** Um pedido cancelado do imóvel, com a designação do avaliador fechada como `fecho` diz. */
async function designacaoFechada(chave: string, imovel: string, fecho: Record<string, unknown>): Promise<void> {
  const { data: p, error } = await adm()
    .from("vistoria_pedidos")
    .insert({ property_id: imovel, owner_id: ids.dona, cidade: CIDADE, porte: "q1_2", valor_tabela: 350, teste: true, status: "cancelada" })
    .select("id")
    .single();
  if (error) throw error;
  const { data: d, error: eD } = await adm()
    .from("vistoria_designacoes")
    .insert({ pedido_id: p.id, avaliador_id: ids.cred, designado_em: ha(45), ...fecho })
    .select("id")
    .single();
  if (eD) throw eD;
  ids[chave] = d.id as string;
}

test.describe("T1766 — E1159: a equipe lê as propostas expiradas ou descartadas numa secção própria @E1159", () => {
  test.skip(!NO_LABORATORIO, "Só no laboratório.");
  test.describe.configure({ mode: "serial", timeout: 120_000 });

  test.beforeAll(async () => {
    ids.dona = await criarConta(dona, senha);
    ids.avaliador = await criarConta(avaliador, senha);
    for (const u of [ids.dona, ids.avaliador]) {
      const t = await adm().from("profiles").update({ is_teste: true }).eq("id", u);
      if (t.error) throw t.error;
    }
    const { data: parc, error: eP } = await adm()
      .from("parceiros")
      .insert({ user_id: ids.avaliador, tipo_pessoa: "pj", documento: cnpjAleatorio(), nome_publico: avaliador.nome, slug: `aval-t1766-${sufixo}`, categorias: ["fotografia"], cidades: [CIDADE] })
      .select("id")
      .single();
    if (eP) throw eP;
    ids.parc = parc.id as string;
    const { data: n } = await adm().rpc("proximo_numero_avaliador", { p_sigla: "UDI" });
    numero = n as string;
    const { data: cred, error: eC } = await adm()
      .from("avaliadores_credenciamento")
      .insert({ parceiro_id: ids.parc, cidade: CIDADE, numero_credenciado: numero, status: "ativo", experiencia_link: "https://portfolio.lab.vivanomads.test/t1766", conduta_versao: "2026-10-23", ativado_em: "2025-01-01T00:00:00Z" })
      .select("id")
      .single();
    if (eC) throw eC;
    ids.cred = cred.id as string;
    ids.imovelExpirada = await criarImovelPronto(ids.dona, TITULO.expirada, { ativo: true });
    ids.imovelDescartada = await criarImovelPronto(ids.dona, TITULO.descartada, { ativo: true });
    const cid = await adm().from("properties").update({ city: CIDADE }).in("id", [ids.imovelExpirada, ids.imovelDescartada]);
    if (cid.error) throw cid.error;
    ids.quandoExpirou = ha(2);
    ids.quandoDescartou = ha(1);
    // A expirada guarda a hora da proposta em respondido_em e o fim do prazo do dono em proposta_expirada_em (E1142).
    await designacaoFechada("expirada", ids.imovelExpirada, { resposta: "expirada", respondido_em: ha(5), proposta_expirada_em: ids.quandoExpirou });
    // A descartada fica "recusada" com a marca do descarte (E1146); a hora da resposta é a da proposta.
    await designacaoFechada("descartada", ids.imovelDescartada, { resposta: "recusada", respondido_em: ha(2), proposta_descartada_em: ids.quandoDescartou });
    await designacaoFechada("velha", ids.imovelExpirada, { resposta: "expirada", respondido_em: ha(43), proposta_expirada_em: ha(40) });
    await designacaoFechada("recusaComum", ids.imovelExpirada, { resposta: "recusada", respondido_em: ha(3) });
  });

  test.afterAll(async () => {
    const imoveis = [ids.imovelExpirada, ids.imovelDescartada].filter(Boolean);
    if (ids.cred) await adm().from("vistoria_designacoes").delete().eq("avaliador_id", ids.cred);
    if (imoveis.length) {
      const { data: meus } = await adm().from("vistoria_pedidos").select("id").in("property_id", imoveis);
      const pedidos = (meus ?? []).map((x) => x.id as string);
      if (pedidos.length) {
        await adm().from("avisos").delete().in("ref_id", pedidos);
        await adm().from("vistoria_fila_admin").delete().in("pedido_id", pedidos);
      }
      await adm().from("vistoria_pedidos").delete().in("property_id", imoveis);
    }
    if (ids.cred) await adm().from("avaliadores_credenciamento").delete().eq("id", ids.cred);
    if (ids.parc) await adm().from("parceiros").delete().eq("id", ids.parc);
    if (imoveis.length) await adm().from("properties").delete().in("id", imoveis);
    const contas = [ids.dona, ids.avaliador].filter(Boolean);
    if (contas.length) await adm().from("emails_teste").delete().in("usuario_id", contas);
    await apagarContas(contas);
  });

  test("1. a secção mostra a expirada e a descartada, com o avaliador, o imóvel e quando; a de fora da janela e a recusa comum não entram", async ({ browser }) => {
    for (const w of LARGURAS) {
      const ctx = await browser.newContext({ storageState: authFile("admin"), viewport: { width: w, height: w === 390 ? 844 : 900 } });
      const p = await ctx.newPage();
      await p.goto("/admin/avaliadores", { waitUntil: "domcontentloaded" });
      const painel = p.getByTestId("avaliacoes-recusas");
      const secao = painel.getByTestId("propostas-expiradas");
      await expect(secao, `a ${w} px: a secção fica dentro do painel das recusas`).toBeVisible({ timeout: 30_000 });
      await expect(secao.getByRole("heading", { name: "Propostas expiradas ou descartadas (30 dias)" })).toBeVisible();
      // Só as do avaliador desta spec (o laboratório pode ter outras): duas, a mais recente primeiro.
      const minhas = secao.locator('[data-testid="proposta-encerrada-item"]').filter({ hasText: `nº ${numero} ·` });
      await expect(minhas, `a ${w} px: a expirada de há 40 dias fica de fora`).toHaveCount(2);
      await expect(minhas.nth(0)).toHaveAttribute("data-motivo", "descartada");
      await expect(minhas.nth(0)).toHaveText(`nº ${numero} · ${TITULO.descartada} · ${codigoVN(ids.imovelDescartada)} · ${ROTULO_DESCARTADA} · ${dataDeBrasilia(ids.quandoDescartou)}`);
      await expect(minhas.nth(1)).toHaveAttribute("data-motivo", "expirada");
      // A data é a do fim do prazo do dono (quando expirou), não a da proposta do avaliador.
      await expect(minhas.nth(1)).toHaveText(`nº ${numero} · ${TITULO.expirada} · ${codigoVN(ids.imovelExpirada)} · ${ROTULO_EXPIRADA} · ${dataDeBrasilia(ids.quandoExpirou)}`);
      // Na lista das recusas do avaliador fica só a recusa comum: as duas propostas não são recusa dele.
      const recusas = painel.locator('[data-testid="recusa-item"]').filter({ hasText: `nº ${numero} ·` });
      await expect(recusas, `a ${w} px`).toHaveCount(1);
      await expect(recusas.first()).toHaveAttribute("data-resposta", "recusada");
      await expect(recusas.first()).toContainText("Recusou");
      expect(await p.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth + 1), `a ${w} px: sem rolagem lateral`).toBe(true);
      await secao.scrollIntoViewIfNeeded();
      await p.screenshot({ path: `${SAIDA}/t1766-1-propostas-expiradas-ou-descartadas-${w}.png` });
      await ctx.close();
    }
  });

  test("2. é só leitura: o número do topo continua a ser o da lista das recusas", async ({ browser }) => {
    const ctx = await browser.newContext({ storageState: authFile("admin"), viewport: { width: 1280, height: 900 } });
    const p = await ctx.newPage();
    await p.goto("/admin/avaliadores", { waitUntil: "domcontentloaded" });
    const painel = p.getByTestId("avaliacoes-recusas");
    await expect(painel.getByTestId("propostas-expiradas")).toBeVisible({ timeout: 30_000 });
    const naLista = await painel.locator('[data-testid="recusa-item"]').count();
    const naSecao = await painel.locator('[data-testid="proposta-encerrada-item"]').count();
    expect(naSecao, "a secção tem pelo menos as duas desta spec").toBeGreaterThanOrEqual(2);
    await expect(p.getByTestId("decidir-numero-recusas"), "o topo conta as recusas e ausências, não as propostas").toHaveAttribute("data-valor", String(naLista));
    await ctx.close();
  });
});
