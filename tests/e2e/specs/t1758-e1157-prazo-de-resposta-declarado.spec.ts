import { test, expect, type Page } from "@playwright/test";
import { authFile } from "../fixtures/auth";
import { NO_LABORATORIO, adm, apagarContas, cnpjAleatorio, criarConta, criarImovelPronto, entrar, novaSenha, novoSufixo } from "../fixtures/laboratorio";

/*
  T1758 — E1157 @E1157 (ORDEM-DUET-654, P2; ORDEM-DUET-658, A1; linha Parceiros): o avaliador declara em "Meus termos" em
  quantas horas responde (até 72), e é esse prazo que devolve o pedido ao dono. Mas as telas diziam sempre "24 horas".
  Dois avaliadores na mesma cidade: a Ana declarou 48 horas; o Beto não declarou nada (vale o padrão, 24).
  Só contas de teste; cidade própria do spec. Laboratório; não é prova ao vivo no site.
   1. O histórico vazio: a Ana lê "…as que passaram de 48 horas sem resposta…"; o Beto lê 24. Print da Ana a 390 e 1280.
   2. Um pedido de cada um volta ao dono sem resposta: no histórico, a Ana lê "Sem resposta em 48 horas" e o Beto
      "Sem resposta em 24 horas". Print da Ana a 390 e 1280.
   3. A equipe, nas "Recusas e ausências": a linha da Ana diz 48 horas e a do Beto 24. Print a 390 e 1280.
  O terceiro texto do item (o aviso quando a lista não carrega) não tem como ser provocado na tela: está na unidade.
*/
const LARGURAS = [390, 1280] as const;
const SAIDA = "tests/laboratorio/saida";
const CIDADE = "Perdizes";
const HORA = 3_600_000;
const senha = novaSenha();
const sufixo = novoSufixo();
const dono = { email: `dono.t1758.${sufixo}@lab.vivanomads.test`, nome: "Dora Prazo", role: "owner" as const };
const ana = { email: `ana.t1758.${sufixo}@lab.vivanomads.test`, nome: "Ana Avaliadora", role: "tenant" as const };
const beto = { email: `beto.t1758.${sufixo}@lab.vivanomads.test`, nome: "Beto Avaliador", role: "tenant" as const };
const ids: Record<string, string> = {};
const numero: Record<string, string> = {};
const vazio = (horas: number) => `Aqui ficam as avaliações que você concluiu, as que recusou, as que passaram de ${horas} horas sem resposta e as ausências registradas. Ainda não há nenhuma.`;

async function largura(page: Page, w: number) {
  await page.setViewportSize({ width: w, height: w === 390 ? 844 : 900 });
}
const semRolagemLateral = (p: Page) => p.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth + 1);

/** O avaliador credenciado e ativo na cidade; `prazo` é o que ele declarou em "Meus termos" (null = não declarou). */
async function avaliador(chave: "ana" | "beto", conta: typeof ana, prazo: number | null) {
  ids[chave] = await criarConta(conta, senha);
  const t = await adm().from("profiles").update({ is_teste: true }).eq("id", ids[chave]);
  if (t.error) throw t.error;
  const { data: parc, error: eP } = await adm()
    .from("parceiros")
    .insert({ user_id: ids[chave], tipo_pessoa: "pj", documento: cnpjAleatorio(), nome_publico: conta.nome, slug: `${chave}-t1758-${sufixo}`, categorias: ["fotografia"], cidades: [CIDADE] })
    .select("id")
    .single();
  if (eP) throw eP;
  ids[`${chave}Parc`] = parc.id as string;
  const { data: n } = await adm().rpc("proximo_numero_avaliador", { p_sigla: "UDI" });
  numero[chave] = n as string;
  const { data: cred, error: eC } = await adm()
    .from("avaliadores_credenciamento")
    .insert({ parceiro_id: ids[`${chave}Parc`], cidade: CIDADE, numero_credenciado: numero[chave], status: "ativo", experiencia_link: "https://portfolio.lab.vivanomads.test/t1758", conduta_versao: "2026-10-23", ativado_em: "2025-01-01T00:00:00Z", prazo_resposta_horas: prazo })
    .select("id")
    .single();
  if (eC) throw eC;
  ids[`${chave}Cred`] = cred.id as string;
}

/** Um pedido que o dono escolheu para este avaliador e que voltou ao dono sem resposta (como a rotina o deixa). */
async function pedidoSemResposta(chave: "ana" | "beto", imovel: string) {
  const escolha = new Date(Date.now() - 60 * HORA).toISOString();
  const { data, error } = await adm()
    .from("vistoria_pedidos")
    .insert({ property_id: imovel, owner_id: ids.dono, cidade: CIDADE, porte: "q1_2", valor_tabela: 350, status: "pedido", teste: true })
    .select("id")
    .single();
  if (error) throw error;
  const d = await adm().from("vistoria_designacoes").insert({ pedido_id: data.id, avaliador_id: ids[`${chave}Cred`], designado_em: escolha, resposta: "expirada", respondido_em: new Date(Date.now() - HORA).toISOString() });
  if (d.error) throw d.error;
}

test.describe("T1758 — E1157: os textos do prazo de resposta leem o prazo que o avaliador declarou @E1157", () => {
  test.skip(!NO_LABORATORIO, "Só no laboratório.");
  test.describe.configure({ mode: "serial", timeout: 240_000 });

  test.beforeAll(async () => {
    ids.dono = await criarConta(dono, senha);
    const t = await adm().from("profiles").update({ is_teste: true }).eq("id", ids.dono);
    if (t.error) throw t.error;
    await avaliador("ana", ana, 48);
    await avaliador("beto", beto, null);
    ids.imovelAna = await criarImovelPronto(ids.dono, `Lar da Ana ${sufixo}`, { ativo: true });
    ids.imovelBeto = await criarImovelPronto(ids.dono, `Lar do Beto ${sufixo}`, { ativo: true });
    const cid = await adm().from("properties").update({ city: CIDADE }).in("id", [ids.imovelAna, ids.imovelBeto]);
    if (cid.error) throw cid.error;
  });

  test.afterAll(async () => {
    const contas = [ids.dono, ids.ana, ids.beto].filter(Boolean);
    const imoveis = [ids.imovelAna, ids.imovelBeto].filter(Boolean);
    const creds = [ids.anaCred, ids.betoCred].filter(Boolean);
    const parcs = [ids.anaParc, ids.betoParc].filter(Boolean);
    if (creds.length) await adm().from("vistoria_designacoes").delete().in("avaliador_id", creds);
    if (imoveis.length) await adm().from("vistoria_pedidos").delete().in("property_id", imoveis);
    if (creds.length) await adm().from("avaliadores_credenciamento").delete().in("id", creds);
    if (parcs.length) await adm().from("parceiros").delete().in("id", parcs);
    if (imoveis.length) await adm().from("properties").delete().in("id", imoveis);
    await apagarContas(contas);
  });

  test("1. o histórico vazio diz o prazo de cada um: 48 horas para quem declarou 48; 24 para quem não declarou", async ({ browser }) => {
    const a = await entrar(browser, ana.email, senha);
    for (const w of LARGURAS) {
      await largura(a, w);
      await a.goto("/dashboard/parceiro/avaliacao", { waitUntil: "domcontentloaded" });
      const texto = a.getByTestId("avaliacoes-historico").getByTestId("avaliacoes-historico-vazio");
      await expect(texto, `a ${w} px`).toHaveText(vazio(48), { timeout: 30_000 });
      await expect(a.getByTestId("avaliacoes-historico")).not.toContainText("24 horas");
      // "Meus termos" mostra o mesmo prazo que o texto diz.
      await expect(a.locator('input[name="prazoRespostaHoras"]')).toHaveValue("48");
      expect(await semRolagemLateral(a), `a ${w} px: sem rolagem lateral`).toBe(true);
      await texto.scrollIntoViewIfNeeded();
      await a.screenshot({ path: `${SAIDA}/t1758-1-historico-vazio-${w}.png` });
    }
    await a.context().close();
    const b = await entrar(browser, beto.email, senha);
    await largura(b, 390);
    await b.goto("/dashboard/parceiro/avaliacao", { waitUntil: "domcontentloaded" });
    await expect(b.getByTestId("avaliacoes-historico").getByTestId("avaliacoes-historico-vazio")).toHaveText(vazio(24), { timeout: 30_000 });
    await b.context().close();
  });

  test("2. o pedido que voltou ao dono sem resposta: 'Sem resposta em 48 horas' para a Ana e 'em 24 horas' para o Beto", async ({ browser }) => {
    await pedidoSemResposta("ana", ids.imovelAna);
    await pedidoSemResposta("beto", ids.imovelBeto);
    const a = await entrar(browser, ana.email, senha);
    for (const w of LARGURAS) {
      await largura(a, w);
      await a.goto("/dashboard/parceiro/avaliacao", { waitUntil: "domcontentloaded" });
      const linha = a.getByTestId("avaliacoes-historico").locator('[data-testid="avaliacao-fora"][data-resposta="expirada"]');
      await expect(linha, `a ${w} px`).toHaveCount(1, { timeout: 30_000 });
      await expect(linha).toContainText("Sem resposta em 48 horas");
      await expect(linha).not.toContainText("24 horas");
      expect(await semRolagemLateral(a), `a ${w} px: sem rolagem lateral`).toBe(true);
      await linha.scrollIntoViewIfNeeded();
      await a.screenshot({ path: `${SAIDA}/t1758-2-sem-resposta-${w}.png` });
    }
    await a.context().close();
    const b = await entrar(browser, beto.email, senha);
    await largura(b, 390);
    await b.goto("/dashboard/parceiro/avaliacao", { waitUntil: "domcontentloaded" });
    const linhaDoBeto = b.getByTestId("avaliacoes-historico").locator('[data-testid="avaliacao-fora"][data-resposta="expirada"]');
    await expect(linhaDoBeto).toHaveCount(1, { timeout: 30_000 });
    await expect(linhaDoBeto).toContainText("Sem resposta em 24 horas");
    await b.context().close();
  });

  test("3. a equipe lê o prazo de cada avaliador nas 'Recusas e ausências'", async ({ browser }) => {
    for (const w of LARGURAS) {
      const ctx = await browser.newContext({ storageState: authFile("admin"), viewport: { width: w, height: w === 390 ? 844 : 900 } });
      const c = await ctx.newPage();
      await c.goto("/admin/avaliadores", { waitUntil: "domcontentloaded" });
      const recusas = c.getByTestId("avaliacoes-recusas");
      const daAna = recusas.locator('[data-testid="recusa-item"][data-resposta="expirada"]').filter({ hasText: `nº ${numero.ana}` });
      const doBeto = recusas.locator('[data-testid="recusa-item"][data-resposta="expirada"]').filter({ hasText: `nº ${numero.beto}` });
      await expect(daAna, `a ${w} px`).toHaveCount(1, { timeout: 30_000 });
      await expect(daAna).toContainText(`nº ${numero.ana} · Sem resposta em 48 horas · ${CIDADE}`);
      await expect(doBeto).toHaveCount(1);
      await expect(doBeto).toContainText(`nº ${numero.beto} · Sem resposta em 24 horas · ${CIDADE}`);
      expect(await semRolagemLateral(c), `a ${w} px: sem rolagem lateral`).toBe(true);
      await daAna.scrollIntoViewIfNeeded();
      await c.screenshot({ path: `${SAIDA}/t1758-3-equipe-${w}.png` });
      await ctx.close();
    }
  });
});
