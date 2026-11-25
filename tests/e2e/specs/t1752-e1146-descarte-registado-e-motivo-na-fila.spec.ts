import { test, expect, type Page } from "@playwright/test";
import { spawn, type ChildProcess } from "node:child_process";
import { createWriteStream, existsSync } from "node:fs";
import { authFile } from "../fixtures/auth";
import { NO_LABORATORIO, adm, apagarContas, cnpjAleatorio, criarConta, criarImovelPronto, entrar, novaSenha, novoSufixo } from "../fixtures/laboratorio";
import { devolverAVezDaRotinaDaVistoria, pegarAVezDaRotinaDaVistoria } from "../fixtures/vez-da-rotina-da-vistoria";

/*
  T1752 — E1146 @E1146 (ORDENS-DUET 628 e 631, classe A). Duas partes que não dependem da decisão "o descartado volta?":
   a) o descarte da proposta pelo dono ("Escolher outro avaliador", E1100) fica REGISTADO na designação — antes ela
      continuava a dizer "aceita" para sempre, com o pedido já devolvido (caso VN-1202DF);
   b) o item "sem avaliador" da fila do admin diz, por avaliador da cidade, a REGRA que o impede — antes dizia só
      "Nenhum avaliador disponível…" (casos VN-F6CDC7 e VN-BD237F: a avaliação anterior do imóvel era do único
      avaliador da cidade, e ninguém lia isso em lado nenhum).
  E a trava pedida para a escolha: o pedido parado em "Aguardando avaliador" reabre quando passa a haver candidato
  elegível, e o dono vê-o na lista.
  Só contas de teste; cidade própria do spec, com UM avaliador ativo (o segundo começa por credenciar). A rotina corre
  num 2º servidor do mesmo build (porta 3152, CRON_SECRET só dele; padrão do t2131, da t1750 e da t1751) e, por correr
  sobre o banco inteiro, esta spec pega a vez da rotina.
   1. O dono descarta a proposta: a designação fica "recusada" com a marca do descarte (nunca "aceita"), a hora da
      proposta fica; o item do admin nasce com a regra; o avaliador lê "Proposta recusada pelo proprietário" (e não
      "Você recusou"); a Central mostra o motivo no pedido e não conta o descarte como recusa do avaliador.
   2. O pedido parado por uma regra de independência, com o item aberto no texto antigo: o tique ESCREVE a regra no
      mesmo item. (E1177, ORDEM-DUET-778: a avaliação anterior, sozinha, já não deixa o pedido parado — o avaliador
      volta à lista com a marca. Aqui ele tem TAMBÉM relação declarada com o imóvel, que nunca cede.) Depois, com um 2º avaliador ativo na cidade, o tique reabre a escolha: o dono vê esse avaliador (e só
      ele) nos dois pedidos, e os itens do admin resolvem-se.
  Print a 390 e a 1280 px. Laboratório; não é prova ao vivo no site.
*/
const LARGURAS = [390, 1280] as const;
const SAIDA = "tests/laboratorio/saida";
const CIDADE = "Tapira";
const PORTA = 3152;
const SEGREDO = `lab-t1752-${Math.random().toString(36).slice(2)}`;
const HORA = 3_600_000;
// E1177 (asserção alterada, ORDEM-DUET-778): a lista vazia diz o motivo — aqui, o único avaliador da cidade já foi escolhido
// neste pedido e saiu dele. A promessa "a Viva avisa quando houver" só vale quando a cidade não tem avaliador nenhum.
const AGUARDANDO = "Os avaliadores da sua cidade já foram escolhidos neste pedido e não continuam nele. A equipe da Viva foi avisada.";
const TEXTO_ANTIGO = `Nenhum avaliador disponível para o dono escolher em ${CIDADE}.`;
const senha = novaSenha();
const sufixo = novoSufixo();
const dono = { email: `dono.t1752.${sufixo}@lab.vivanomads.test`, nome: "Dalva Descarta", role: "owner" as const };
const unico = { email: `aval1.t1752.${sufixo}@lab.vivanomads.test`, nome: "Xisto Único", role: "tenant" as const };
const novo = { email: `aval2.t1752.${sufixo}@lab.vivanomads.test`, nome: "Yara Nova", role: "tenant" as const };
const ids: Record<string, string> = {};
const numero: Record<string, string> = {};
let servidor: ChildProcess | null = null;

async function largura(page: Page, w: number) {
  await page.setViewportSize({ width: w, height: w === 390 ? 844 : 900 });
}
const haHoras = (h: number) => new Date(Date.now() - h * HORA).toISOString();
const linha = async (pedido: string) => (await adm().from("vistoria_pedidos").select("status, avaliador_id, aguardando_avaliador, proposta_em").eq("id", pedido).single()).data!;
const designacoes = async (pedido: string) =>
  ((await adm().from("vistoria_designacoes").select("avaliador_id, resposta, respondido_em, proposta_expirada_em, proposta_descartada_em").eq("pedido_id", pedido)).data ?? []) as {
    avaliador_id: string;
    resposta: string | null;
    respondido_em: string | null;
    proposta_expirada_em: string | null;
    proposta_descartada_em: string | null;
  }[];
const itensDoAdmin = async (pedido: string) =>
  ((await adm().from("vistoria_fila_admin").select("id, motivo, resolvido_em").eq("tipo", "sem_avaliador").eq("pedido_id", pedido).order("criado_em")).data ?? []) as { id: string; motivo: string | null; resolvido_em: string | null }[];
const abertos = async (pedido: string) => (await itensDoAdmin(pedido)).filter((i) => !i.resolvido_em);

async function credenciar(conta: { nome: string }, userId: string, chave: string, status: "ativo" | "solicitado"): Promise<void> {
  const { data: parc, error: eP } = await adm()
    .from("parceiros")
    .insert({ user_id: userId, tipo_pessoa: "pj", documento: cnpjAleatorio(), nome_publico: conta.nome, slug: `${chave}-t1752-${sufixo}`, categorias: ["fotografia"], cidades: [CIDADE] })
    .select("id")
    .single();
  if (eP) throw eP;
  ids[`parc_${chave}`] = parc.id as string;
  const { data: n } = await adm().rpc("proximo_numero_avaliador", { p_sigla: "UDI" });
  const { data: cred, error: eC } = await adm()
    .from("avaliadores_credenciamento")
    .insert({ parceiro_id: parc.id, cidade: CIDADE, numero_credenciado: n as string, status, experiencia_link: `https://portfolio.lab.vivanomads.test/t1752-${chave}`, conduta_versao: "2026-10-23", ativado_em: status === "ativo" ? "2025-01-01T00:00:00Z" : null })
    .select("id")
    .single();
  if (eC) throw eC;
  ids[`cred_${chave}`] = cred.id as string;
  numero[chave] = n as string;
}

async function tique(): Promise<{ expiradas?: number; reprocessados?: number }> {
  const r = await fetch(`http://localhost:${PORTA}/api/cron/vistoria`, { headers: { authorization: `Bearer ${SEGREDO}` } });
  const resumo = (await r.json().catch(() => ({}))) as { ok?: boolean; expiradas?: number; reprocessados?: number };
  expect(r.status, JSON.stringify(resumo)).toBe(200);
  return resumo;
}

test.describe("T1752 — E1146: o descarte fica registado e a fila do admin diz a regra que impede cada avaliador @E1146", () => {
  test.skip(!NO_LABORATORIO, "Só no laboratório.");
  test.describe.configure({ mode: "serial", timeout: 300_000 });

  test.beforeAll(async () => {
    // A rotina corre sobre o banco inteiro: esta spec só monta a massa quando nenhuma outra spec de rotina está a meio.
    await pegarAVezDaRotinaDaVistoria("t1752");
    for (const [k, c] of [["dono", dono], ["unico", unico], ["novo", novo]] as const) {
      ids[k] = await criarConta(c, senha);
      const t = await adm().from("profiles").update({ is_teste: true }).eq("id", ids[k]);
      if (t.error) throw t.error;
      const p = await adm().from("vistoria_piloto").insert({ user_id: ids[k], nota: "T1752 (laboratório)" });
      if (p.error) throw p.error;
    }
    await credenciar(unico, ids.unico, "unico", "ativo");
    // O segundo avaliador ainda está por credenciar: só entra na escolha quando for ativado (caso 2).
    await credenciar(novo, ids.novo, "novo", "solicitado");
    for (const c of ["Descarte", "Parado"] as const) ids[`imovel${c}`] = await criarImovelPronto(ids.dono, `Casa ${c} t1752 ${sufixo}`, { ativo: true });
    const cid = await adm().from("properties").update({ city: CIDADE }).in("id", [ids.imovelDescarte, ids.imovelParado]);
    if (cid.error) throw cid.error;
    const { error: eT } = await adm()
      .from("vistoria_precos")
      .insert(["estudio", "q1_2", "q3_mais"].map((porte) => ({ cidade: CIDADE, porte, valor: porte === "q1_2" ? 350 : 300 })));
    if (eT) throw eT;

    // Pedido do DESCARTE: o avaliador único foi escolhido e a proposta dele está viva (enviada há 2 horas).
    const proposta = haHoras(2);
    const escolha = haHoras(3);
    const a = await adm()
      .from("vistoria_pedidos")
      .insert({ property_id: ids.imovelDescarte, owner_id: ids.dono, cidade: CIDADE, porte: "q1_2", valor_tabela: 350, status: "designado", teste: true, avaliador_id: ids.cred_unico, designado_em: escolha, escolhido_em: escolha, valor_proposto: 380, prazo_proposto_dias: 5, proposta_em: proposta })
      .select("id")
      .single();
    if (a.error) throw a.error;
    ids.pedidoDescarte = a.data.id as string;
    ids.propostaEm = proposta;
    const da = await adm().from("vistoria_designacoes").insert({ pedido_id: ids.pedidoDescarte, avaliador_id: ids.cred_unico, designado_em: escolha, resposta: "aceita", respondido_em: proposta });
    if (da.error) throw da.error;

    // Pedido PARADO pela regra da avaliação anterior: a última avaliação feita deste imóvel foi do avaliador único.
    const anterior = await adm()
      .from("vistoria_pedidos")
      .insert({ property_id: ids.imovelParado, owner_id: ids.dono, cidade: CIDADE, porte: "q1_2", valor_tabela: 350, status: "laudo_emitido", teste: true, avaliador_id: ids.cred_unico, designado_em: haHoras(300), criado_em: haHoras(320) })
      .select("id")
      .single();
    if (anterior.error) throw anterior.error;
    ids.pedidoAnterior = anterior.data.id as string;
    // E1177 (massa alterada, ORDEM-DUET-778): só com a avaliação anterior ele voltaria à lista pela exceção da
    // alternância. A relação declarada com este imóvel mantém-no impedido — e é ela o motivo que o item passa a dizer.
    const relacao = await adm().from("avaliadores_credenciamento").update({ relacoes_imoveis: [ids.imovelParado] }).eq("id", ids.cred_unico);
    if (relacao.error) throw relacao.error;
    const b = await adm()
      .from("vistoria_pedidos")
      .insert({ property_id: ids.imovelParado, owner_id: ids.dono, cidade: CIDADE, porte: "q1_2", valor_tabela: 350, status: "pedido", teste: true, aguardando_avaliador: true })
      .select("id")
      .single();
    if (b.error) throw b.error;
    ids.pedidoParado = b.data.id as string;
    // O item do admin como estava em produção: aberto, com o texto que não dizia a regra.
    const f = await adm().from("vistoria_fila_admin").insert({ tipo: "sem_avaliador", pedido_id: ids.pedidoParado, avaliador_id: null, motivo: TEXTO_ANTIGO });
    if (f.error) throw f.error;
  });

  test.afterAll(async () => {
    servidor?.kill("SIGTERM");
    const imoveis = [ids.imovelDescarte, ids.imovelParado].filter(Boolean);
    const pedidos = [ids.pedidoDescarte, ids.pedidoParado, ids.pedidoAnterior].filter(Boolean);
    const contas = [ids.dono, ids.unico, ids.novo].filter(Boolean);
    const creds = [ids.cred_unico, ids.cred_novo].filter(Boolean);
    if (contas.length) await adm().from("emails_teste").delete().in("usuario_id", contas);
    if (pedidos.length) {
      await adm().from("avisos").delete().in("ref_id", pedidos);
      await adm().from("vistoria_fila_admin").delete().in("pedido_id", pedidos);
      await adm().from("vistoria_designacoes").delete().in("pedido_id", pedidos);
    }
    if (imoveis.length) await adm().from("vistoria_pedidos").delete().in("property_id", imoveis);
    await adm().from("vistoria_precos").delete().eq("cidade", CIDADE);
    if (contas.length) await adm().from("vistoria_piloto").delete().in("user_id", contas);
    if (creds.length) {
      await adm().from("vistoria_designacoes").delete().in("avaliador_id", creds);
      await adm().from("avaliadores_credenciamento").delete().in("id", creds);
    }
    const parceiros = [ids.parc_unico, ids.parc_novo].filter(Boolean);
    if (parceiros.length) await adm().from("parceiros").delete().in("id", parceiros);
    if (imoveis.length) await adm().from("properties").delete().in("id", imoveis);
    await apagarContas(contas);
    devolverAVezDaRotinaDaVistoria();
  });

  test("1. o dono descarta a proposta: a designação deixa de dizer 'aceita', o item do admin nasce com a regra e ninguém lê o descarte como recusa do avaliador", async ({ browser }) => {
    const d = await entrar(browser, dono.email, senha);
    await largura(d, 390);
    await d.goto(`/dashboard/imoveis/${ids.imovelDescarte}/nivel`, { waitUntil: "domcontentloaded" });
    const proposta = d.getByTestId("avaliacao-proposta");
    await expect(proposta).toBeVisible({ timeout: 30_000 });
    await proposta.getByTestId("trocar-avaliador").click();
    await proposta.getByTestId("troca-confirmacao").getByRole("button", { name: "Descartar e escolher outro" }).click();
    await expect.poll(async () => (await linha(ids.pedidoDescarte)).status, { timeout: 20_000 }).toBe("pedido");
    await expect(d.getByTestId("avaliacao-situacao")).toHaveText(AGUARDANDO, { timeout: 20_000 });
    await d.context().close();

    // O registo: a designação e o pedido deixam de divergir.
    const p = await linha(ids.pedidoDescarte);
    expect(p.avaliador_id).toBeNull();
    expect(p.proposta_em).toBeNull();
    expect(p.aguardando_avaliador, "não há outro avaliador na cidade").toBe(true);
    const des = await designacoes(ids.pedidoDescarte);
    expect(des).toHaveLength(1);
    expect(des[0].resposta, "a designação não fica 'aceita' com o pedido devolvido").toBe("recusada");
    expect(des[0].proposta_descartada_em, "o descarte do dono leva a marca própria").not.toBeNull();
    expect(des[0].proposta_expirada_em).toBeNull();
    expect(Date.parse(des[0].respondido_em!), "a hora da proposta do avaliador fica").toBe(Date.parse(ids.propostaEm));

    // A fila do admin: um item, aberto, com a regra que impede o avaliador da cidade.
    const itens = await abertos(ids.pedidoDescarte);
    expect(itens).toHaveLength(1);
    const motivoDescarte = `${TEXTO_ANTIGO} Avaliador nº ${numero.unico}: já foi designado neste pedido.`;
    expect(itens[0].motivo).toBe(motivoDescarte);

    // O avaliador lê o que aconteceu — e não que ELE recusou.
    const a = await entrar(browser, unico.email, senha);
    for (const w of LARGURAS) {
      await largura(a, w);
      await a.goto("/dashboard/parceiro/avaliacao", { waitUntil: "domcontentloaded" });
      const historico = a.getByTestId("avaliacoes-historico");
      const fora = historico.locator('[data-testid="avaliacao-fora"][data-resposta="recusada"]');
      await expect(fora, `a ${w} px`).toHaveCount(1, { timeout: 30_000 });
      await expect(fora).toContainText("Proposta recusada pelo proprietário");
      await expect(fora).not.toContainText("Você recusou");
      await expect(a.locator(`[data-testid="avaliacao-designada"][data-pedido="${ids.pedidoDescarte}"]`)).toHaveCount(0);
      expect(await a.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth + 1)).toBe(true);
      await fora.scrollIntoViewIfNeeded();
      await a.screenshot({ path: `${SAIDA}/t1752-1-historico-do-avaliador-${w}.png`, fullPage: true });
    }
    await a.context().close();

    // A Central: o motivo no pedido sem avaliador; o descarte fora das "Recusas e ausências".
    for (const w of LARGURAS) {
      const ctx = await browser.newContext({ storageState: authFile("admin"), viewport: { width: w, height: w === 390 ? 844 : 900 } });
      const c = await ctx.newPage();
      await c.goto("/admin/avaliadores", { waitUntil: "domcontentloaded" });
      const item = c.locator(`[data-testid="sem-avaliador-item"][data-pedido="${ids.pedidoDescarte}"]`);
      await expect(item, `a ${w} px`).toBeVisible({ timeout: 30_000 });
      await expect(item.getByTestId("sem-avaliador-motivo")).toHaveText(motivoDescarte);
      await expect(c.getByTestId("avaliacoes-recusas").getByTestId("recusa-item").filter({ hasText: `nº ${numero.unico}` }), "o descarte do dono não é recusa do avaliador").toHaveCount(0);
      expect(await c.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth + 1)).toBe(true);
      await item.scrollIntoViewIfNeeded();
      await c.screenshot({ path: `${SAIDA}/t1752-1-central-motivo-${w}.png` });
      await ctx.close();
    }
  });

  test("2. o pedido parado: o tique escreve a regra no item que já estava aberto; com um avaliador elegível na cidade, a escolha reabre e o dono vê-o", async ({ browser }) => {
    test.skip(!existsSync(".next/BUILD_ID"), "Precisa do build do laboratório (next start).");
    const antes = await abertos(ids.pedidoParado);
    expect(antes).toHaveLength(1);
    expect(antes[0].motivo, "começa com o texto antigo, sem a regra").toBe(TEXTO_ANTIGO);

    const log = createWriteStream(`${SAIDA}/t1752-servidor-cron.log`);
    servidor = spawn(process.execPath, ["node_modules/next/dist/bin/next", "start", "-p", String(PORTA)], {
      env: { ...process.env, CRON_SECRET: SEGREDO, PORT: String(PORTA) },
      stdio: ["ignore", "pipe", "pipe"],
    });
    servidor.stdout?.pipe(log);
    servidor.stderr?.pipe(log);
    await expect.poll(async () => (await fetch(`http://localhost:${PORTA}/api/cron/vistoria`).catch(() => null))?.status ?? 0, { timeout: 90_000 }).toBe(401);

    // 1.º tique: ninguém é elegível. O pedido continua parado, mas o MESMO item passa a dizer a regra.
    await tique();
    expect((await linha(ids.pedidoParado)).aguardando_avaliador).toBe(true);
    const depois = await itensDoAdmin(ids.pedidoParado);
    expect(depois, "não nasce um segundo item").toHaveLength(1);
    expect(depois[0].id).toBe(antes[0].id);
    expect(depois[0].resolvido_em).toBeNull();
    // E1177 (asserção alterada, ORDEM-DUET-778): o motivo dito é o que de fato o impede — a relação declarada.
    const motivoParado = `${TEXTO_ANTIGO} Avaliador nº ${numero.unico}: tem relação declarada com o proprietário ou o imóvel.`;
    expect(depois[0].motivo).toBe(motivoParado);
    // O item do descarte não muda de um tique para o outro.
    expect((await abertos(ids.pedidoDescarte))[0]?.motivo).toBe(`${TEXTO_ANTIGO} Avaliador nº ${numero.unico}: já foi designado neste pedido.`);

    const ctx = await browser.newContext({ storageState: authFile("admin"), viewport: { width: 1280, height: 900 } });
    const c = await ctx.newPage();
    await c.goto("/admin/avaliadores", { waitUntil: "domcontentloaded" });
    const item = c.locator(`[data-testid="sem-avaliador-item"][data-pedido="${ids.pedidoParado}"]`);
    await expect(item).toBeVisible({ timeout: 30_000 });
    await expect(item.getByTestId("sem-avaliador-motivo")).toHaveText(motivoParado);
    await ctx.close();

    const d = await entrar(browser, dono.email, senha);
    await largura(d, 390);
    await d.goto(`/dashboard/imoveis/${ids.imovelParado}/nivel`, { waitUntil: "domcontentloaded" });
    // E1177 (asserção alterada, ORDEM-DUET-778): a lista vazia diz o motivo — aqui, a regra de independência.
    await expect(d.getByTestId("avaliacao-situacao")).toHaveText("Os avaliadores da sua cidade não podem avaliar este imóvel pelas regras de independência. A equipe da Viva foi avisada.", { timeout: 30_000 });
    await expect(d.getByTestId("avaliacao-escolha")).toHaveCount(0);

    // Passa a haver um avaliador elegível na cidade: o segundo é ativado.
    const ativar = await adm().from("avaliadores_credenciamento").update({ status: "ativo", ativado_em: new Date().toISOString() }).eq("id", ids.cred_novo);
    if (ativar.error) throw ativar.error;

    // 2.º tique: a escolha reabre nos dois pedidos e os itens do admin resolvem-se.
    const resumo = await tique();
    expect(resumo.reprocessados ?? 0, "os dois pedidos parados foram reprocessados").toBeGreaterThanOrEqual(2);
    for (const k of ["pedidoParado", "pedidoDescarte"] as const) {
      expect((await linha(ids[k])).aguardando_avaliador, `${k}: reabriu`).toBe(false);
      expect(await abertos(ids[k]), `${k}: o item do admin resolveu-se`).toHaveLength(0);
    }

    // O que o dono vê: o avaliador novo, e só ele (o da avaliação anterior e o descartado continuam fora).
    for (const w of LARGURAS) {
      await largura(d, w);
      for (const k of ["Parado", "Descarte"] as const) {
        await d.goto(`/dashboard/imoveis/${ids[`imovel${k}`]}/nivel`, { waitUntil: "domcontentloaded" });
        const escolha = d.getByTestId("avaliacao-escolha");
        await expect(escolha, `${k} a ${w} px: a escolha está aberta`).toBeVisible({ timeout: 30_000 });
        const cartoes = escolha.getByTestId("avaliacao-sugerido");
        await expect(cartoes).toHaveCount(1);
        await expect(cartoes.first()).toContainText(novo.nome);
        await expect(cartoes.first().getByRole("button", { name: `Escolher ${novo.nome}` })).toBeVisible();
        await expect(escolha).not.toContainText(unico.nome);
        await expect(d.getByTestId("avaliacao-situacao")).not.toHaveText(AGUARDANDO);
        expect(await d.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth + 1)).toBe(true);
        await d.screenshot({ path: `${SAIDA}/t1752-2-${k.toLowerCase()}-escolha-reaberta-${w}.png`, fullPage: true });
      }
    }
    await d.context().close();
  });
});
