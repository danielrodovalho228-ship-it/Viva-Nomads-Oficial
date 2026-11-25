import { test, expect } from "@playwright/test";
import { authFile } from "../fixtures/auth";
import { NO_LABORATORIO, adm, apagarContas, cnpjAleatorio, criarConta, criarImovelPronto, novaSenha, novoSufixo } from "../fixtures/laboratorio";

/*
  T1777 — E1175 @E1175 (ORDENS-DUET 752, 776, 780, 782, 785 e 793). A Central conta os pedidos de avaliação do imóvel
  ocupado que esperam o morador, numa linha só com dois estados: a data à espera da concordância e o pedido recusado
  pelo morador, à espera de nova data. A página dos avaliadores mostra os dois no painel "Avaliações à espera do
  morador" (#espera-moradora), com as contas de teste à parte e fora do número.
  Massa só no banco (pedidos com a data a semanas de distância, longe das rotinas da véspera):
   · dona real (não é conta de teste): o pedido A, com data proposta e sem concordância; o pedido B, recusado (sem data);
   · dona de teste: o pedido C, com data proposta e sem concordância.
   1. A Central (/admin/pendencias) tem a linha da fila com os dois estados; a página mostra A no estado "espera", B no
      estado "recusado" e C no bloco das contas de teste. Print a 390 e a 1280 px.
   2. Quando o morador concorda com A (agendado) e uma nova data chega a B, A sai da fila e B passa ao estado "espera".
  Laboratório; não é prova ao vivo no site.
*/
const LARGURAS = [1280, 390] as const;
const SAIDA = "tests/laboratorio/saida";
const CIDADE = "Tapira";
const DIA = 86_400_000;
const senha = novaSenha();
const sufixo = novoSufixo();
const donaReal = { email: `dona.real.t1777.${sufixo}@lab.vivanomads.test`, nome: "Rita Espera", role: "owner" as const };
const donaTeste = { email: `dona.teste.t1777.${sufixo}@lab.vivanomads.test`, nome: "Tais Espera", role: "owner" as const };
const morador = { email: `morador.t1777.${sufixo}@lab.vivanomads.test`, nome: "Mauro Espera", role: "tenant" as const };
const avaliador = { email: `aval.t1777.${sufixo}@lab.vivanomads.test`, nome: "Vera Espera", role: "tenant" as const };
const ids: Record<string, string> = {};
const ha = (dias: number) => new Date(Date.now() - dias * DIA).toISOString();
const daqui = (dias: number) => new Date(Date.now() + dias * DIA).toISOString();

async function pedido(imovel: string, dono: string, extra: Record<string, unknown>): Promise<string> {
  const { data, error } = await adm()
    .from("vistoria_pedidos")
    .insert({ property_id: imovel, owner_id: dono, cidade: CIDADE, porte: "q1_2", valor_tabela: 350, status: "designado", teste: true, ocupado: true, morador_id: ids.morador, avaliador_id: ids.cred, designado_em: ha(4), escolhido_em: ha(4), valor_proposto: 380, prazo_proposto_dias: 5, proposta_em: ha(3), proposta_aceita_em: ha(3), ...extra })
    .select("id")
    .single();
  if (error) throw error;
  return data.id as string;
}

test.describe("T1777 — E1175: a Central conta os pedidos que esperam o morador, nos dois estados @E1175", () => {
  test.skip(!NO_LABORATORIO, "Só no laboratório.");
  test.describe.configure({ mode: "serial", timeout: 180_000 });

  test.beforeAll(async () => {
    ids.donaReal = await criarConta(donaReal, senha);
    ids.donaTeste = await criarConta(donaTeste, senha);
    ids.morador = await criarConta(morador, senha);
    ids.avaliador = await criarConta(avaliador, senha);
    const real = await adm().from("profiles").select("is_teste").eq("id", ids.donaReal).single();
    if (real.error) throw real.error;
    expect(real.data.is_teste, "a dona real não pode nascer conta de teste").not.toBe(true);
    for (const u of [ids.donaTeste, ids.avaliador]) {
      const t = await adm().from("profiles").update({ is_teste: true }).eq("id", u);
      if (t.error) throw t.error;
    }
    const { data: parc, error: eP } = await adm()
      .from("parceiros")
      .insert({ user_id: ids.avaliador, tipo_pessoa: "pj", documento: cnpjAleatorio(), nome_publico: avaliador.nome, slug: `aval-t1777-${sufixo}`, categorias: ["fotografia"], cidades: [CIDADE] })
      .select("id")
      .single();
    if (eP) throw eP;
    ids.parc = parc.id as string;
    const { data: n } = await adm().rpc("proximo_numero_avaliador", { p_sigla: "UDI" });
    const { data: cred, error: eC } = await adm()
      .from("avaliadores_credenciamento")
      .insert({ parceiro_id: ids.parc, cidade: CIDADE, numero_credenciado: n as string, status: "ativo", experiencia_link: "https://portfolio.lab.vivanomads.test/t1777", conduta_versao: "2026-10-23", ativado_em: "2025-01-01T00:00:00Z" })
      .select("id")
      .single();
    if (eC) throw eC;
    ids.cred = cred.id as string;
    ids.imovelReal = await criarImovelPronto(ids.donaReal, `Casa ocupada t1777 ${sufixo}`, { ativo: true });
    // Um pedido aberto por imóvel (vistoria_pedidos_um_aberto): o B vai num segundo imóvel da mesma dona.
    ids.imovelReal2 = await criarImovelPronto(ids.donaReal, `Apartamento ocupado t1777 ${sufixo}`, { ativo: true });
    ids.imovelTeste = await criarImovelPronto(ids.donaTeste, `Casa de teste t1777 ${sufixo}`, { ativo: true });
    const cid = await adm().from("properties").update({ city: CIDADE }).in("id", [ids.imovelReal, ids.imovelReal2, ids.imovelTeste]);
    if (cid.error) throw cid.error;
    // A: data proposta, à espera da concordância. B: recusado pelo morador (a recusa limpa a data, fica o pedido).
    ids.a = await pedido(ids.imovelReal, ids.donaReal, { agendado_para: daqui(20), concordancia_pedida_em: ha(2) });
    ids.b = await pedido(ids.imovelReal2, ids.donaReal, { agendado_para: null, concordancia_pedida_em: ha(3) });
    ids.c = await pedido(ids.imovelTeste, ids.donaTeste, { agendado_para: daqui(21), concordancia_pedida_em: ha(1) });
  });

  test.afterAll(async () => {
    const pedidos = [ids.a, ids.b, ids.c].filter(Boolean);
    if (pedidos.length) {
      await adm().from("vistoria_fila_admin").delete().in("pedido_id", pedidos);
      await adm().from("vistoria_designacoes").delete().in("pedido_id", pedidos);
      await adm().from("vistoria_pedidos").delete().in("id", pedidos);
    }
    if (ids.cred) await adm().from("avaliadores_credenciamento").delete().eq("id", ids.cred);
    if (ids.parc) await adm().from("parceiros").delete().eq("id", ids.parc);
    const imoveis = [ids.imovelReal, ids.imovelReal2, ids.imovelTeste].filter(Boolean);
    if (imoveis.length) await adm().from("properties").delete().in("id", imoveis);
    const contas = [ids.donaReal, ids.donaTeste, ids.morador, ids.avaliador].filter(Boolean);
    if (contas.length) {
      await adm().from("emails_teste").delete().in("usuario_id", contas);
      await adm().from("avisos").delete().in("usuario_id", contas);
    }
    await apagarContas(contas);
  });

  test("1. a Central tem a linha com os dois estados; o painel mostra cada pedido no seu estado e a conta de teste à parte", async ({ browser }) => {
    for (const w of LARGURAS) {
      const ctx = await browser.newContext({ storageState: authFile("admin"), viewport: { width: w, height: w === 390 ? 844 : 900 } });
      const p = await ctx.newPage();
      await p.goto("/admin/pendencias", { waitUntil: "domcontentloaded" });
      const linha = p.locator('[data-testid="central-linha-decisao"][data-decisao="avaliacao_espera_moradora"]');
      await expect(linha, `a ${w} px: a linha da fila está na Central`).toBeVisible({ timeout: 30_000 });
      await expect(linha).toContainText("à espera da concordância do morador");
      await expect(linha).toContainText("recusado pelo morador — à espera de nova data");
      expect(Number(await linha.getAttribute("data-n"))).toBeGreaterThanOrEqual(2);
      await expect(linha.getByRole("link", { name: "Ver" })).toHaveAttribute("href", "/admin/avaliadores#espera-moradora");

      await p.goto("/admin/avaliadores#espera-moradora", { waitUntil: "domcontentloaded" });
      const painel = p.getByTestId("avaliacoes-espera-moradora");
      await expect(painel).toBeVisible({ timeout: 30_000 });
      await expect(painel.getByRole("heading", { name: "Avaliações à espera do morador" })).toBeVisible();
      const espera = painel.locator('[data-testid="espera-moradora-estado"][data-estado="espera"]');
      const recusado = painel.locator('[data-testid="espera-moradora-estado"][data-estado="recusado"]');
      await expect(espera.locator(`[data-testid="espera-moradora-item"][data-pedido="${ids.a}"][data-conta-teste="nao"]`)).toHaveCount(1);
      await expect(recusado.locator(`[data-testid="espera-moradora-item"][data-pedido="${ids.b}"][data-conta-teste="nao"]`)).toHaveCount(1);
      // A conta de teste fica à parte (fora do número), no estado dela.
      await expect(espera.locator(`[data-testid="espera-moradora-item"][data-pedido="${ids.c}"][data-conta-teste="sim"]`)).toHaveCount(1);
      await expect(painel.locator(`[data-testid="espera-moradora-item"][data-pedido="${ids.c}"][data-conta-teste="nao"]`)).toHaveCount(0);
      expect(await p.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth + 1), `a ${w} px: sem rolagem lateral`).toBe(true);
      await painel.scrollIntoViewIfNeeded();
      await p.screenshot({ path: `${SAIDA}/t1777-espera-moradora-${w}.png` });
      await ctx.close();
    }
  });

  test("2. o morador concorda com A e uma nova data chega a B: A sai da fila e B passa ao estado de espera", async ({ browser }) => {
    const a = await adm().from("vistoria_pedidos").update({ status: "agendado", concordancia_em: new Date().toISOString() }).eq("id", ids.a);
    if (a.error) throw a.error;
    const b = await adm().from("vistoria_pedidos").update({ agendado_para: daqui(22), concordancia_pedida_em: new Date().toISOString() }).eq("id", ids.b);
    if (b.error) throw b.error;
    const ctx = await browser.newContext({ storageState: authFile("admin"), viewport: { width: 1280, height: 900 } });
    const p = await ctx.newPage();
    await p.goto("/admin/avaliadores#espera-moradora", { waitUntil: "domcontentloaded" });
    const painel = p.getByTestId("avaliacoes-espera-moradora");
    await expect(painel).toBeVisible({ timeout: 30_000 });
    await expect(painel.locator(`[data-testid="espera-moradora-item"][data-pedido="${ids.a}"]`), "o concordado sai da fila").toHaveCount(0);
    await expect(painel.locator(`[data-testid="espera-moradora-estado"][data-estado="espera"] [data-testid="espera-moradora-item"][data-pedido="${ids.b}"]`), "com data nova, B espera a concordância").toHaveCount(1);
    await expect(painel.locator(`[data-testid="espera-moradora-estado"][data-estado="recusado"] [data-testid="espera-moradora-item"][data-pedido="${ids.b}"]`)).toHaveCount(0);
    await ctx.close();
  });
});
