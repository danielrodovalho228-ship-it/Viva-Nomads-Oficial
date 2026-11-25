import { test, expect } from "@playwright/test";
import { authFile } from "../fixtures/auth";
import { NO_LABORATORIO, adm, apagarContas, cnpjAleatorio, criarConta, criarImovelPronto, novaSenha, novoSufixo } from "../fixtures/laboratorio";

/*
  T1776 — E1170 @E1170 (ORDENS-DUET 740, 745 e 759; linha Parceiros). As duas listas de /admin/avaliadores — "Recusas e
  ausências" e "Propostas expiradas ou descartadas" — liam as 50 linhas mais recentes e só depois separavam as de conta
  de teste. Com 50 ou mais linhas de teste recentes, as reais mais antigas não chegavam a ser lidas: a lista de trabalho
  saía curta e o número do topo contava menos do que havia.
  A cura: a leitura vai por páginas até a lista de trabalho encher (forma 1 da folha, sem migração).
  Massa só no banco, em pedidos já cancelados (nenhuma rotina lhes toca): de uma dona de teste, 60 recusas e 60
  propostas expiradas, de há 20 dias; de uma dona que não é conta de teste, 3 recusas e 3 propostas expiradas, de há 25
  dias. Antes das 3 reais há, portanto, sempre mais de 50 linhas de teste.
   1. Recusas: as 3 da conta real aparecem na lista de trabalho; o bloco das contas de teste para em 50; o número do
      topo é o tamanho da lista de trabalho; nenhum aviso de lista incompleta. Print a 390 e a 1280 px.
   2. Propostas expiradas: as 3 da conta real aparecem na lista de trabalho; o bloco das contas de teste para em 50;
      nenhum aviso de lista incompleta.
   3. Propostas descartadas (ORDEM-DUET-802): a coluna das descartadas tem a sua própria leitura. Com 60 de conta de
      teste mais recentes, as 3 da conta real chegam à lista de trabalho, cada uma como "descartada".
  O aviso do teto de 20 páginas está na trava de unidade (1 000 linhas não cabem numa massa de tela).
  Laboratório; não é prova ao vivo no site.
*/
const LARGURAS = [1280, 390] as const;
const SAIDA = "tests/laboratorio/saida";
const CIDADE = "Tapira";
const DIA = 86_400_000;
const DE_TESTE = 60;
const REAIS = 3;
const senha = novaSenha();
const sufixo = novoSufixo();
const donaTeste = { email: `dona.teste.t1776.${sufixo}@lab.vivanomads.test`, nome: "Tina Limite", role: "owner" as const };
const donaReal = { email: `dona.real.t1776.${sufixo}@lab.vivanomads.test`, nome: "Rosa Limite", role: "owner" as const };
const avaliador = { email: `aval.t1776.${sufixo}@lab.vivanomads.test`, nome: "Vito Limite", role: "tenant" as const };
const TITULO = { teste: `Casa de teste t1776 ${sufixo}`, real: `Casa real t1776 ${sufixo}`, realDescartada: `Casa real das descartadas t1776 ${sufixo}` };
const ids: Record<string, string> = {};
let numero = "";
/** `dias` atrás, menos `i` segundos: cada linha com a sua hora, para a ordem ser uma só. */
const ha = (dias: number, i = 0) => new Date(Date.now() - dias * DIA - i * 1000).toISOString();

/** `n` pedidos cancelados do imóvel, cada um com a designação do avaliador fechada como `fecho(i)` diz. */
async function designacoesFechadas(n: number, imovel: string, dono: string, fecho: (i: number) => Record<string, unknown>): Promise<void> {
  const { data: pedidos, error } = await adm()
    .from("vistoria_pedidos")
    .insert(Array.from({ length: n }, () => ({ property_id: imovel, owner_id: dono, cidade: CIDADE, porte: "q1_2", valor_tabela: 350, teste: true, status: "cancelada" })))
    .select("id");
  if (error) throw error;
  const { error: eD } = await adm()
    .from("vistoria_designacoes")
    .insert((pedidos ?? []).map((p, i) => ({ pedido_id: p.id as string, avaliador_id: ids.cred, designado_em: ha(28), ...fecho(i) })));
  if (eD) throw eD;
}

test.describe("T1776 — E1170: as contas de teste saem antes do limite, nas duas listas da equipe @E1170", () => {
  test.skip(!NO_LABORATORIO, "Só no laboratório.");
  test.describe.configure({ mode: "serial", timeout: 180_000 });

  test.beforeAll(async () => {
    ids.donaTeste = await criarConta(donaTeste, senha);
    ids.avaliador = await criarConta(avaliador, senha);
    // A dona "real" do laboratório: uma conta que NÃO é de teste (o is_teste fica como nasce, falso).
    ids.donaReal = await criarConta(donaReal, senha);
    const real = await adm().from("profiles").select("is_teste").eq("id", ids.donaReal).single();
    if (real.error) throw real.error;
    expect(real.data.is_teste, "a dona real não pode nascer conta de teste").not.toBe(true);
    for (const u of [ids.donaTeste, ids.avaliador]) {
      const t = await adm().from("profiles").update({ is_teste: true }).eq("id", u);
      if (t.error) throw t.error;
    }
    const { data: parc, error: eP } = await adm()
      .from("parceiros")
      .insert({ user_id: ids.avaliador, tipo_pessoa: "pj", documento: cnpjAleatorio(), nome_publico: avaliador.nome, slug: `aval-t1776-${sufixo}`, categorias: ["fotografia"], cidades: [CIDADE] })
      .select("id")
      .single();
    if (eP) throw eP;
    ids.parc = parc.id as string;
    const { data: n } = await adm().rpc("proximo_numero_avaliador", { p_sigla: "UDI" });
    numero = n as string;
    const { data: cred, error: eC } = await adm()
      .from("avaliadores_credenciamento")
      .insert({ parceiro_id: ids.parc, cidade: CIDADE, numero_credenciado: numero, status: "ativo", experiencia_link: "https://portfolio.lab.vivanomads.test/t1776", conduta_versao: "2026-10-23", ativado_em: "2025-01-01T00:00:00Z" })
      .select("id")
      .single();
    if (eC) throw eC;
    ids.cred = cred.id as string;
    ids.imovelTeste = await criarImovelPronto(ids.donaTeste, TITULO.teste, { ativo: true });
    ids.imovelReal = await criarImovelPronto(ids.donaReal, TITULO.real, { ativo: true });
    // As descartadas da dona real ficam noutro imóvel: o caso 2 conta as expiradas pelo título do primeiro.
    ids.imovelRealDescartada = await criarImovelPronto(ids.donaReal, TITULO.realDescartada, { ativo: true });
    const cid = await adm().from("properties").update({ city: CIDADE }).in("id", [ids.imovelTeste, ids.imovelReal, ids.imovelRealDescartada]);
    if (cid.error) throw cid.error;

    // As recusas: 60 da dona de teste (há 20 dias) e, mais antigas, 3 da dona real (há 25 dias).
    await designacoesFechadas(DE_TESTE, ids.imovelTeste, ids.donaTeste, (i) => ({ resposta: "recusada", respondido_em: ha(20, i) }));
    await designacoesFechadas(REAIS, ids.imovelReal, ids.donaReal, (i) => ({ resposta: "recusada", respondido_em: ha(25, i) }));
    // As propostas expiradas: a hora da proposta em respondido_em e o fim do prazo do dono em proposta_expirada_em.
    await designacoesFechadas(DE_TESTE, ids.imovelTeste, ids.donaTeste, (i) => ({ resposta: "expirada", respondido_em: ha(22, i), proposta_expirada_em: ha(20, i) }));
    await designacoesFechadas(REAIS, ids.imovelReal, ids.donaReal, (i) => ({ resposta: "expirada", respondido_em: ha(27, i), proposta_expirada_em: ha(25, i) }));
    // As propostas descartadas: ficam "recusada" com a marca do descarte (E1146); a hora da resposta é a da proposta.
    await designacoesFechadas(DE_TESTE, ids.imovelTeste, ids.donaTeste, (i) => ({ resposta: "recusada", respondido_em: ha(23, i), proposta_descartada_em: ha(21, i) }));
    await designacoesFechadas(REAIS, ids.imovelRealDescartada, ids.donaReal, (i) => ({ resposta: "recusada", respondido_em: ha(28, i), proposta_descartada_em: ha(26, i) }));
  });

  test.afterAll(async () => {
    const imoveis = [ids.imovelTeste, ids.imovelReal, ids.imovelRealDescartada].filter(Boolean);
    if (ids.cred) await adm().from("vistoria_designacoes").delete().eq("avaliador_id", ids.cred);
    if (imoveis.length) await adm().from("vistoria_pedidos").delete().in("property_id", imoveis);
    if (ids.cred) await adm().from("avaliadores_credenciamento").delete().eq("id", ids.cred);
    if (ids.parc) await adm().from("parceiros").delete().eq("id", ids.parc);
    if (imoveis.length) await adm().from("properties").delete().in("id", imoveis);
    const contas = [ids.donaTeste, ids.donaReal, ids.avaliador].filter(Boolean);
    if (contas.length) await adm().from("emails_teste").delete().in("usuario_id", contas);
    await apagarContas(contas);
  });

  test("1. recusas: as 3 da conta real chegam à lista de trabalho, mesmo com 60 de conta de teste mais recentes", async ({ browser }) => {
    for (const w of LARGURAS) {
      const ctx = await browser.newContext({ storageState: authFile("admin"), viewport: { width: w, height: w === 390 ? 844 : 900 } });
      const p = await ctx.newPage();
      await p.goto("/admin/avaliadores", { waitUntil: "domcontentloaded" });
      const painel = p.getByTestId("avaliacoes-recusas");
      await expect(painel).toBeVisible({ timeout: 30_000 });
      // Só as do avaliador desta spec (o laboratório pode ter outras).
      const doAvaliador = { hasText: `nº ${numero} ·` };
      const deTrabalho = painel.locator('[data-testid="recusa-item"][data-conta-teste="nao"]');
      await expect(deTrabalho.filter(doAvaliador), `a ${w} px: as 3 recusas da conta real estão na lista de trabalho`).toHaveCount(REAIS);
      // O número do topo é o tamanho da lista de trabalho (número = lista), e conta as 3.
      const quantas = await deTrabalho.count();
      expect(quantas).toBeGreaterThanOrEqual(REAIS);
      await expect(p.getByTestId("avaliacoes-decidir").getByTestId("decidir-numero-recusas")).toHaveAttribute("data-valor", String(quantas));
      // O bloco das contas de teste tem o seu próprio limite: para em 50, e só tem linhas de conta de teste.
      const bloco = painel.getByTestId("recusas-de-teste");
      await expect(bloco, `a ${w} px: as de conta de teste têm bloco próprio`).toBeVisible();
      await expect(bloco).toHaveAttribute("data-valor", "50");
      await expect(bloco.locator('[data-testid="recusa-item"]')).toHaveCount(50);
      await expect(bloco.locator('[data-testid="recusa-item"]:not([data-conta-teste="sim"])')).toHaveCount(0);
      await expect(bloco.locator("p").first()).toHaveText("Mais 50 de conta de teste, fora do número:");
      // O teto de páginas não foi atingido: nenhum aviso.
      await expect(painel.getByTestId("recusas-incompletas")).toHaveCount(0);
      expect(await p.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth + 1), `a ${w} px: sem rolagem lateral`).toBe(true);
      await deTrabalho.filter(doAvaliador).first().scrollIntoViewIfNeeded();
      await p.screenshot({ path: `${SAIDA}/t1776-recusas-${w}.png` });
      await ctx.close();
    }
  });

  test("2. propostas expiradas: as 3 da conta real chegam à lista de trabalho, mesmo com 60 de conta de teste mais recentes", async ({ browser }) => {
    for (const w of LARGURAS) {
      const ctx = await browser.newContext({ storageState: authFile("admin"), viewport: { width: w, height: w === 390 ? 844 : 900 } });
      const p = await ctx.newPage();
      await p.goto("/admin/avaliadores", { waitUntil: "domcontentloaded" });
      const secao = p.getByTestId("avaliacoes-recusas").getByTestId("propostas-expiradas");
      await expect(secao).toBeVisible({ timeout: 30_000 });
      const deTrabalho = secao.locator('[data-testid="proposta-encerrada-item"][data-conta-teste="nao"]').filter({ hasText: TITULO.real });
      await expect(deTrabalho, `a ${w} px: as 3 propostas da conta real estão na lista de trabalho`).toHaveCount(REAIS);
      for (let i = 0; i < REAIS; i++) await expect(deTrabalho.nth(i)).toHaveAttribute("data-motivo", "expirada");
      const bloco = secao.getByTestId("propostas-expiradas-de-teste");
      await expect(bloco, `a ${w} px: as de conta de teste têm bloco próprio`).toBeVisible();
      await expect(bloco).toHaveAttribute("data-valor", "50");
      await expect(bloco.locator('[data-testid="proposta-encerrada-item"]:not([data-conta-teste="sim"])')).toHaveCount(0);
      await expect(secao.getByTestId("propostas-incompletas")).toHaveCount(0);
      expect(await p.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth + 1), `a ${w} px: sem rolagem lateral`).toBe(true);
      await ctx.close();
    }
  });

  test("3. propostas descartadas: as 3 da conta real chegam à lista de trabalho, mesmo com 60 de conta de teste mais recentes", async ({ browser }) => {
    for (const w of LARGURAS) {
      const ctx = await browser.newContext({ storageState: authFile("admin"), viewport: { width: w, height: w === 390 ? 844 : 900 } });
      const p = await ctx.newPage();
      await p.goto("/admin/avaliadores", { waitUntil: "domcontentloaded" });
      const secao = p.getByTestId("avaliacoes-recusas").getByTestId("propostas-expiradas");
      await expect(secao).toBeVisible({ timeout: 30_000 });
      const deTrabalho = secao.locator('[data-testid="proposta-encerrada-item"][data-conta-teste="nao"]').filter({ hasText: TITULO.realDescartada });
      await expect(deTrabalho, `a ${w} px: as 3 propostas descartadas da conta real estão na lista de trabalho`).toHaveCount(REAIS);
      for (let i = 0; i < REAIS; i++) await expect(deTrabalho.nth(i)).toHaveAttribute("data-motivo", "descartada");
      // As descartadas não entram nas recusas: a leitura das recusas deixa de fora quem tem a marca do descarte.
      await expect(p.getByTestId("avaliacoes-recusas").locator('[data-testid="recusa-item"][data-conta-teste="nao"]').filter({ hasText: `nº ${numero} ·` })).toHaveCount(REAIS);
      await expect(secao.getByTestId("propostas-incompletas")).toHaveCount(0);
      expect(await p.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth + 1), `a ${w} px: sem rolagem lateral`).toBe(true);
      await ctx.close();
    }
  });
});
