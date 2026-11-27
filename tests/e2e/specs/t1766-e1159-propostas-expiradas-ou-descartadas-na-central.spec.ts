import { test, expect } from "@playwright/test";
import { authFile } from "../fixtures/auth";
import { NO_LABORATORIO, adm, apagarContas, cnpjAleatorio, criarConta, criarImovelPronto, novaSenha, novoSufixo } from "../fixtures/laboratorio";

/*
  T1766 — E1159 @E1159 (ORDENS-DUET 658 e 679; linha Parceiros). A proposta de avaliação que expirou sem o aceite do
  dono (E1142) e a que o dono descartou (E1146) saíram da lista "Recusas e ausências" da equipe — não são recusa do
  avaliador — e ficaram sem lugar nenhum. Passam a ter uma secção própria no mesmo painel de /admin/avaliadores:
  "Propostas expiradas ou descartadas (30 dias)", com o avaliador, o imóvel e quando. Não conta no "Para decidir".
  ORDEM-DUET-735: a proposta de conta de teste (pelo dono do pedido) fica FORA da lista de trabalho, num bloco próprio
  por baixo dela — a regra do E1163.
  Massa só no banco, em pedidos já cancelados (nenhuma rotina lhes toca), de um avaliador, uma dona de teste e uma dona
  que NÃO é conta de teste:
   • da dona de teste: EXPIRADA há 2 dias, num imóvel; DESCARTADA há 1 dia, noutro;
   • da dona que não é de teste: EXPIRADA há 3 dias, num terceiro imóvel;
   • uma expirada há 40 dias (fora da janela) e uma recusa comum do avaliador, há 3 dias.
   1. A lista de trabalho mostra só a da dona que não é de teste; as duas da dona de teste ficam no bloco "Mais N de
      conta de teste, fora do número:", a mais recente primeiro. Cada linha tem o nº do avaliador, o título do imóvel
      com o código VN, o rótulo da casa e a data; a de 40 dias não entra; a recusa comum fica na lista das recusas e
      não na secção. Print a 390 e a 1280 px.
   2. O número do topo "recusas e ausências" continua a ser o da lista das recusas: as propostas não o aumentam.
  E1169 @E1169 (ORDEM-DUET-738): a lista "Recusas e ausências" também não mistura contas de teste. A massa ganha uma
  recusa comum no pedido da dona que não é de teste, há 4 dias.
   3. A lista de trabalho mostra só a recusa da conta real; a da conta de teste fica no bloco "Mais N de conta de teste,
      fora do número:"; o número do topo é o tamanho da lista de trabalho. Print a 390 e a 1280 px.
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
const donaReal = { email: `dona.real.t1766.${sufixo}@lab.vivanomads.test`, nome: "Rita Propostas", role: "owner" as const };
const avaliador = { email: `aval.t1766.${sufixo}@lab.vivanomads.test`, nome: "Valdo Propostas", role: "tenant" as const };
const TITULO = { expirada: `Casa da expirada t1766 ${sufixo}`, descartada: `Casa da descartada t1766 ${sufixo}`, real: `Casa da dona real t1766 ${sufixo}` };
const ids: Record<string, string> = {};
let numero = "";
const ha = (dias: number) => new Date(Date.now() - dias * DIA).toISOString();
const dataDeBrasilia = (iso: string) => new Intl.DateTimeFormat("pt-BR", { timeZone: "America/Sao_Paulo", day: "2-digit", month: "2-digit", year: "numeric" }).format(new Date(iso));
const codigoVN = (id: string) => `VN-${id.replace(/[^a-zA-Z0-9]/g, "").slice(0, 6).toUpperCase()}`; // codigoDoImovel (imovel-pagina.ts)

/** Um pedido cancelado do imóvel (da dona de teste, salvo outra), com a designação do avaliador fechada como `fecho` diz. */
async function designacaoFechada(chave: string, imovel: string, fecho: Record<string, unknown>, dono: string = ids.dona): Promise<void> {
  const { data: p, error } = await adm()
    .from("vistoria_pedidos")
    .insert({ property_id: imovel, owner_id: dono, cidade: CIDADE, porte: "q1_2", valor_tabela: 350, teste: true, status: "cancelada" })
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
    // A dona "real" do laboratório: uma conta que NÃO é de teste (o is_teste fica como nasce, falso).
    ids.donaReal = await criarConta(donaReal, senha);
    const real = await adm().from("profiles").select("is_teste").eq("id", ids.donaReal).single();
    if (real.error) throw real.error;
    expect(real.data.is_teste, "a dona real não pode nascer conta de teste").not.toBe(true);
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
    ids.imovelReal = await criarImovelPronto(ids.donaReal, TITULO.real, { ativo: true });
    const cid = await adm().from("properties").update({ city: CIDADE }).in("id", [ids.imovelExpirada, ids.imovelDescartada, ids.imovelReal]);
    if (cid.error) throw cid.error;
    ids.quandoExpirou = ha(2);
    ids.quandoDescartou = ha(1);
    ids.quandoExpirouReal = ha(3);
    await designacaoFechada("real", ids.imovelReal, { resposta: "expirada", respondido_em: ha(6), proposta_expirada_em: ids.quandoExpirouReal }, ids.donaReal);
    // A expirada guarda a hora da proposta em respondido_em e o fim do prazo do dono em proposta_expirada_em (E1142).
    await designacaoFechada("expirada", ids.imovelExpirada, { resposta: "expirada", respondido_em: ha(5), proposta_expirada_em: ids.quandoExpirou });
    // A descartada fica "recusada" com a marca do descarte (E1146); a hora da resposta é a da proposta.
    await designacaoFechada("descartada", ids.imovelDescartada, { resposta: "recusada", respondido_em: ha(2), proposta_descartada_em: ids.quandoDescartou });
    await designacaoFechada("velha", ids.imovelExpirada, { resposta: "expirada", respondido_em: ha(43), proposta_expirada_em: ha(40) });
    ids.quandoRecusouTeste = ha(3);
    ids.quandoRecusouReal = ha(4);
    await designacaoFechada("recusaComum", ids.imovelExpirada, { resposta: "recusada", respondido_em: ids.quandoRecusouTeste });
    // E1169: a mesma recusa comum, no pedido da dona que não é conta de teste.
    await designacaoFechada("recusaReal", ids.imovelReal, { resposta: "recusada", respondido_em: ids.quandoRecusouReal }, ids.donaReal);
  });

  test.afterAll(async () => {
    const imoveis = [ids.imovelExpirada, ids.imovelDescartada, ids.imovelReal].filter(Boolean);
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
    const contas = [ids.dona, ids.donaReal, ids.avaliador].filter(Boolean);
    if (contas.length) await adm().from("emails_teste").delete().in("usuario_id", contas);
    await apagarContas(contas);
  });

  test("1. a lista de trabalho mostra só a da conta real; as de conta de teste ficam no bloco próprio; a de fora da janela e a recusa comum não entram", async ({ browser }) => {
    for (const w of LARGURAS) {
      const ctx = await browser.newContext({ storageState: authFile("admin"), viewport: { width: w, height: w === 390 ? 844 : 900 } });
      const p = await ctx.newPage();
      await p.goto("/admin/avaliadores", { waitUntil: "domcontentloaded" });
      const painel = p.getByTestId("avaliacoes-recusas");
      const secao = painel.getByTestId("propostas-expiradas");
      await expect(secao, `a ${w} px: a secção fica dentro do painel das recusas`).toBeVisible({ timeout: 30_000 });
      await expect(secao.getByRole("heading", { name: "Propostas expiradas ou descartadas (30 dias)" })).toBeVisible();
      // Só as do avaliador desta spec (o laboratório pode ter outras).
      const doAvaliador = { hasText: `nº ${numero} ·` };
      // A lista de trabalho: só a da dona que não é conta de teste (ORDEM-735).
      const deTrabalho = secao.locator('[data-testid="proposta-encerrada-item"][data-conta-teste="nao"]').filter(doAvaliador);
      await expect(deTrabalho, `a ${w} px: na lista de trabalho só entra a da conta real`).toHaveCount(1);
      await expect(deTrabalho.first()).toHaveAttribute("data-motivo", "expirada");
      await expect(deTrabalho.first()).toHaveText(`nº ${numero} · ${TITULO.real} · ${codigoVN(ids.imovelReal)} · ${ROTULO_EXPIRADA} · ${dataDeBrasilia(ids.quandoExpirouReal)}`);
      // O bloco das contas de teste, por baixo: o texto da casa, a contagem dele e as duas da dona de teste.
      const bloco = secao.getByTestId("propostas-expiradas-de-teste");
      await expect(bloco, `a ${w} px: as de conta de teste têm bloco próprio`).toBeVisible();
      const noBloco = bloco.locator('[data-testid="proposta-encerrada-item"]');
      const quantas = await noBloco.count();
      await expect(bloco).toHaveAttribute("data-valor", String(quantas));
      await expect(bloco.locator("p").first()).toHaveText(`Mais ${quantas} de conta de teste, fora do número:`);
      await expect(bloco.locator('[data-testid="proposta-encerrada-item"]:not([data-conta-teste="sim"])'), "no bloco só há linhas de conta de teste").toHaveCount(0);
      const minhas = noBloco.filter(doAvaliador);
      await expect(minhas, `a ${w} px: a expirada de há 40 dias fica de fora`).toHaveCount(2);
      await expect(minhas.nth(0)).toHaveAttribute("data-motivo", "descartada");
      await expect(minhas.nth(0)).toHaveText(`nº ${numero} · ${TITULO.descartada} · ${codigoVN(ids.imovelDescartada)} · ${ROTULO_DESCARTADA} · ${dataDeBrasilia(ids.quandoDescartou)}`);
      await expect(minhas.nth(1)).toHaveAttribute("data-motivo", "expirada");
      // A data é a do fim do prazo do dono (quando expirou), não a da proposta do avaliador.
      await expect(minhas.nth(1)).toHaveText(`nº ${numero} · ${TITULO.expirada} · ${codigoVN(ids.imovelExpirada)} · ${ROTULO_EXPIRADA} · ${dataDeBrasilia(ids.quandoExpirou)}`);
      // Nas recusas do avaliador ficam só as duas recusas comuns (a da dona de teste e a da dona real, E1169): as três
      // propostas não são recusa dele.
      const recusas = painel.locator('[data-testid="recusa-item"]').filter({ hasText: `nº ${numero} ·` });
      await expect(recusas, `a ${w} px`).toHaveCount(2);
      for (const i of [0, 1]) {
        await expect(recusas.nth(i)).toHaveAttribute("data-resposta", "recusada");
        await expect(recusas.nth(i)).toContainText("Recusou");
      }
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
    // E1169: o número é o da lista de trabalho; as recusas de conta de teste ficam fora dele.
    const naLista = await painel.locator('[data-testid="recusa-item"][data-conta-teste="nao"]').count();
    const naSecao = await painel.locator('[data-testid="proposta-encerrada-item"]').count();
    expect(naSecao, "a secção tem pelo menos as três desta spec").toBeGreaterThanOrEqual(3);
    await expect(p.getByTestId("decidir-numero-recusas"), "o topo conta as recusas e ausências, não as propostas").toHaveAttribute("data-valor", String(naLista));
    await ctx.close();
  });

  test("3. E1169: a recusa de conta de teste fica fora da lista de trabalho e do número do topo, num bloco próprio @E1169", async ({ browser }) => {
    for (const w of LARGURAS) {
      const ctx = await browser.newContext({ storageState: authFile("admin"), viewport: { width: w, height: w === 390 ? 844 : 900 } });
      const p = await ctx.newPage();
      await p.goto("/admin/avaliadores", { waitUntil: "domcontentloaded" });
      const painel = p.getByTestId("avaliacoes-recusas");
      await expect(painel, `a ${w} px`).toBeVisible({ timeout: 30_000 });
      const doAvaliador = { hasText: `nº ${numero} ·` };
      // A lista de trabalho: só a recusa no pedido da dona que não é conta de teste.
      const deTrabalho = painel.locator('[data-testid="recusa-item"][data-conta-teste="nao"]');
      await expect(deTrabalho.filter(doAvaliador), `a ${w} px: na lista de trabalho só entra a recusa da conta real`).toHaveCount(1);
      await expect(deTrabalho.filter(doAvaliador).first()).toHaveText(`nº ${numero} · Recusou · ${CIDADE} · ${dataDeBrasilia(ids.quandoRecusouReal)}`);
      // O bloco das contas de teste, por baixo: o texto da casa, a contagem dele e a recusa da dona de teste.
      const bloco = painel.getByTestId("recusas-de-teste");
      await expect(bloco, `a ${w} px: as recusas de conta de teste têm bloco próprio`).toBeVisible();
      const noBloco = bloco.locator('[data-testid="recusa-item"]');
      const quantas = await noBloco.count();
      await expect(bloco).toHaveAttribute("data-valor", String(quantas));
      await expect(bloco.locator("p").first()).toHaveText(`Mais ${quantas} de conta de teste, fora do número:`);
      await expect(bloco.locator('[data-testid="recusa-item"]:not([data-conta-teste="sim"])'), "no bloco só há linhas de conta de teste").toHaveCount(0);
      await expect(noBloco.filter(doAvaliador), `a ${w} px: a recusa da dona de teste fica no bloco`).toHaveCount(1);
      await expect(noBloco.filter(doAvaliador).first()).toHaveText(`nº ${numero} · Recusou · ${CIDADE} · ${dataDeBrasilia(ids.quandoRecusouTeste)}`);
      // O número do topo é o tamanho da lista de trabalho: as de conta de teste não contam.
      const naLista = await deTrabalho.count();
      const todas = await painel.locator('[data-testid="recusa-item"]').count();
      expect(todas, "há recusas de conta de teste a mais do que as que contam").toBe(naLista + quantas);
      expect(quantas, "pelo menos a desta spec").toBeGreaterThanOrEqual(1);
      await expect(p.getByTestId("decidir-numero-recusas"), `a ${w} px: o topo não conta as recusas de conta de teste`).toHaveAttribute("data-valor", String(naLista));
      expect(await p.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth + 1), `a ${w} px: sem rolagem lateral`).toBe(true);
      await painel.scrollIntoViewIfNeeded();
      await p.screenshot({ path: `${SAIDA}/t1766-3-recusas-sem-contas-de-teste-${w}.png` });
      await ctx.close();
    }
  });
});
