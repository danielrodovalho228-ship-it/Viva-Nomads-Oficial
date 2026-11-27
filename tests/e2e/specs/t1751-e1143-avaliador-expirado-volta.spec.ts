import { test, expect, type Page } from "@playwright/test";
import { spawn, type ChildProcess } from "node:child_process";
import { createWriteStream, existsSync } from "node:fs";
import { NO_LABORATORIO, adm, apagarContas, cnpjAleatorio, criarConta, criarImovelPronto, entrar, novaSenha, novoSufixo } from "../fixtures/laboratorio";
import { devolverAVezDaRotinaDaVistoria, pegarAVezDaRotinaDaVistoria } from "../fixtures/vez-da-rotina-da-vistoria";

/*
  T1751 — E1143 @E1143 (ORDEM-DUET-626; decisão do Daniel de 24/11: "ele volta à lista"). A escolha do dono excluía para
  sempre todo avaliador que já tivesse tido uma designação naquele pedido. Numa cidade com um avaliador só, bastava a
  proposta expirar para o dono ficar preso em "Aguardando avaliador", sem ninguém para escolher.
  A regra nova olha para o MOTIVO: quem recusou e quem não respondeu continuam fora daquele pedido; quem só teve a
  proposta vencida sem o aceite do dono volta à lista.
  Só contas de teste; cidade própria do spec, com UM avaliador. A rotina corre num 2º servidor do mesmo build (porta
  3151, com um CRON_SECRET só dele; padrão do t2131 e da t1750) e, por correr sobre o banco inteiro, vem num caso só.
   1. Depois do tique da rotina:
      A. a proposta de 75 horas expira e o dono volta JÁ a ver "Escolher avaliador", com o mesmo avaliador na lista;
      B. o pedido que já estava preso (proposta vencida antes desta correção, "Aguardando avaliador", item do admin
         aberto) reabre: o item do admin resolve-se e o dono vê o avaliador;
      C. o pedido cujo avaliador RECUSOU continua "Aguardando avaliador";
      D. o pedido cujo avaliador NÃO RESPONDEU no prazo dele continua "Aguardando avaliador".
      Print a 390 e a 1280 px.
   2. O dono escolhe de novo o avaliador que voltou: o pedido fica designado, a designação reabre na mesma linha (sem
      resposta e sem a marca da expiração) e o avaliador vê o pedido outra vez para responder.
  Laboratório; não é prova ao vivo no site.
*/
const LARGURAS = [390, 1280] as const;
const SAIDA = "tests/laboratorio/saida";
const CIDADE = "Ibiá";
const PORTA = 3151;
const SEGREDO = `lab-t1751-${Math.random().toString(36).slice(2)}`;
const HORA = 3_600_000;
// E1177 (asserção alterada, ORDEM-DUET-778): a lista vazia diz o motivo — aqui, o único avaliador da cidade já foi escolhido
// neste pedido e saiu dele. A promessa "a Viva avisa quando houver" só vale quando a cidade não tem avaliador nenhum.
const AGUARDANDO = "Os avaliadores da sua cidade já foram escolhidos neste pedido e não continuam nele. A equipe da Viva foi avisada.";
const senha = novaSenha();
const sufixo = novoSufixo();
const dono = { email: `dono.t1751.${sufixo}@lab.vivanomads.test`, nome: "Dina Volta", role: "owner" as const };
const avaliador = { email: `aval.t1751.${sufixo}@lab.vivanomads.test`, nome: "Ubaldo Único", role: "tenant" as const };
const ids: Record<string, string> = {};
const CASOS = ["A", "B", "C", "D"] as const;
let servidor: ChildProcess | null = null;

async function largura(page: Page, w: number) {
  await page.setViewportSize({ width: w, height: w === 390 ? 844 : 900 });
}
const haHoras = (h: number) => new Date(Date.now() - h * HORA).toISOString();
const linha = async (pedido: string) => (await adm().from("vistoria_pedidos").select("status, avaliador_id, aguardando_avaliador, proposta_em").eq("id", pedido).single()).data!;
const designacoes = async (pedido: string) =>
  ((await adm().from("vistoria_designacoes").select("avaliador_id, resposta, respondido_em, proposta_expirada_em").eq("pedido_id", pedido)).data ?? []) as {
    avaliador_id: string;
    resposta: string | null;
    respondido_em: string | null;
    proposta_expirada_em: string | null;
  }[];
const itensDoAdminAbertos = async (pedido: string) =>
  ((await adm().from("vistoria_fila_admin").select("id").eq("tipo", "sem_avaliador").eq("pedido_id", pedido).is("resolvido_em", null)).data ?? []).length;

/** A. O pedido com o avaliador escolhido e a proposta dele enviada há 75 horas, ainda à espera do dono (a rotina expira-a). */
async function pedidoComPropostaVencida(imovel: string): Promise<string> {
  const proposta = haHoras(75);
  const escolha = haHoras(77);
  const { data, error } = await adm()
    .from("vistoria_pedidos")
    .insert({ property_id: imovel, owner_id: ids.dono, cidade: CIDADE, porte: "q1_2", valor_tabela: 350, status: "designado", teste: true, avaliador_id: ids.cred, designado_em: escolha, escolhido_em: escolha, valor_proposto: 380, prazo_proposto_dias: 5, proposta_em: proposta })
    .select("id")
    .single();
  if (error) throw error;
  const d = await adm().from("vistoria_designacoes").insert({ pedido_id: data.id, avaliador_id: ids.cred, designado_em: escolha, resposta: "aceita", respondido_em: proposta });
  if (d.error) throw d.error;
  return data.id as string;
}

/** B, C e D. O pedido que já voltou ao dono e ficou "Aguardando avaliador", com a designação anterior terminada como se diz. */
async function pedidoParado(imovel: string, fim: { resposta: "expirada" | "recusada"; propostaExpiradaEm: string | null }, comItemDoAdmin: boolean): Promise<string> {
  const { data, error } = await adm()
    .from("vistoria_pedidos")
    .insert({ property_id: imovel, owner_id: ids.dono, cidade: CIDADE, porte: "q1_2", valor_tabela: 350, status: "pedido", teste: true, aguardando_avaliador: true })
    .select("id")
    .single();
  if (error) throw error;
  const d = await adm()
    .from("vistoria_designacoes")
    .insert({ pedido_id: data.id, avaliador_id: ids.cred, designado_em: haHoras(100), resposta: fim.resposta, respondido_em: haHoras(90), proposta_expirada_em: fim.propostaExpiradaEm });
  if (d.error) throw d.error;
  if (comItemDoAdmin) {
    const f = await adm().from("vistoria_fila_admin").insert({ tipo: "sem_avaliador", pedido_id: data.id, avaliador_id: null, motivo: `Nenhum avaliador disponível para o dono escolher em ${CIDADE}.` });
    if (f.error) throw f.error;
  }
  return data.id as string;
}

test.describe("T1751 — E1143: o avaliador cuja proposta expirou volta à escolha do dono @E1143", () => {
  test.skip(!NO_LABORATORIO, "Só no laboratório.");
  test.describe.configure({ mode: "serial", timeout: 300_000 });

  test.beforeAll(async () => {
    // A rotina corre sobre o banco inteiro: esta spec só monta a massa quando nenhuma outra spec de rotina está a meio.
    await pegarAVezDaRotinaDaVistoria("t1751");
    for (const [k, c] of [["dono", dono], ["avaliador", avaliador]] as const) {
      ids[k] = await criarConta(c, senha);
      const t = await adm().from("profiles").update({ is_teste: true }).eq("id", ids[k]);
      if (t.error) throw t.error;
    }
    const { data: parc, error: eP } = await adm()
      .from("parceiros")
      .insert({ user_id: ids.avaliador, tipo_pessoa: "pj", documento: cnpjAleatorio(), nome_publico: avaliador.nome, slug: `aval-t1751-${sufixo}`, categorias: ["fotografia"], cidades: [CIDADE] })
      .select("id")
      .single();
    if (eP) throw eP;
    ids.parc = parc.id as string;
    const { data: n } = await adm().rpc("proximo_numero_avaliador", { p_sigla: "UDI" });
    const { data: cred, error: eC } = await adm()
      .from("avaliadores_credenciamento")
      .insert({ parceiro_id: ids.parc, cidade: CIDADE, numero_credenciado: n as string, status: "ativo", experiencia_link: "https://portfolio.lab.vivanomads.test/t1751", conduta_versao: "2026-10-23", ativado_em: "2025-01-01T00:00:00Z" })
      .select("id")
      .single();
    if (eC) throw eC;
    ids.cred = cred.id as string;
    for (const u of [ids.dono, ids.avaliador]) {
      const p = await adm().from("vistoria_piloto").insert({ user_id: u, nota: "T1751 (laboratório)" });
      if (p.error) throw p.error;
    }
    for (const c of CASOS) ids[`imovel${c}`] = await criarImovelPronto(ids.dono, `Casa ${c} t1751 ${sufixo}`, { ativo: true });
    const cid = await adm().from("properties").update({ city: CIDADE }).in("id", CASOS.map((c) => ids[`imovel${c}`]));
    if (cid.error) throw cid.error;
    const { error: eT } = await adm()
      .from("vistoria_precos")
      .insert(["estudio", "q1_2", "q3_mais"].map((porte) => ({ cidade: CIDADE, porte, valor: porte === "q1_2" ? 350 : 300 })));
    if (eT) throw eT;
    ids.pedidoA = await pedidoComPropostaVencida(ids.imovelA);
    ids.pedidoB = await pedidoParado(ids.imovelB, { resposta: "expirada", propostaExpiradaEm: haHoras(3) }, true);
    ids.pedidoC = await pedidoParado(ids.imovelC, { resposta: "recusada", propostaExpiradaEm: null }, false);
    ids.pedidoD = await pedidoParado(ids.imovelD, { resposta: "expirada", propostaExpiradaEm: null }, false);
  });

  test.afterAll(async () => {
    servidor?.kill("SIGTERM");
    const imoveis = CASOS.map((c) => ids[`imovel${c}`]).filter(Boolean);
    const pedidos = CASOS.map((c) => ids[`pedido${c}`]).filter(Boolean);
    const contas = [ids.dono, ids.avaliador].filter(Boolean);
    if (contas.length) await adm().from("emails_teste").delete().in("usuario_id", contas);
    if (pedidos.length) {
      await adm().from("avisos").delete().in("ref_id", pedidos);
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
    devolverAVezDaRotinaDaVistoria();
  });

  test("1. depois do tique: a proposta expirada devolve o avaliador à lista (A e B); a recusa e o silêncio dele, não (C e D)", async ({ browser }) => {
    test.skip(!existsSync(".next/BUILD_ID"), "Precisa do build do laboratório (next start).");
    // Antes do tique: os três parados não têm ninguém para o dono escolher.
    for (const c of ["B", "C", "D"] as const) expect((await linha(ids[`pedido${c}`])).aguardando_avaliador, `pedido ${c} começa parado`).toBe(true);
    expect(await itensDoAdminAbertos(ids.pedidoB)).toBe(1);

    const log = createWriteStream(`${SAIDA}/t1751-servidor-cron.log`);
    servidor = spawn(process.execPath, ["node_modules/next/dist/bin/next", "start", "-p", String(PORTA)], {
      env: { ...process.env, CRON_SECRET: SEGREDO, PORT: String(PORTA) },
      stdio: ["ignore", "pipe", "pipe"],
    });
    servidor.stdout?.pipe(log);
    servidor.stderr?.pipe(log);
    await expect.poll(async () => (await fetch(`http://localhost:${PORTA}/api/cron/vistoria`).catch(() => null))?.status ?? 0, { timeout: 90_000 }).toBe(401);
    const r = await fetch(`http://localhost:${PORTA}/api/cron/vistoria`, { headers: { authorization: `Bearer ${SEGREDO}` } });
    const resumo = (await r.json().catch(() => ({}))) as { ok?: boolean; expiradas?: number; reprocessados?: number };
    expect(r.status, JSON.stringify(resumo)).toBe(200);
    expect(resumo.expiradas ?? 0, "a proposta do pedido A expirou").toBeGreaterThanOrEqual(1);
    expect(resumo.reprocessados ?? 0, "o pedido B, que estava preso, foi reprocessado").toBeGreaterThanOrEqual(1);

    // A. Expirou agora: a designação fica "expirada" com a marca, e o pedido volta ao dono COM alguém para escolher.
    const a = await linha(ids.pedidoA);
    expect(a.status).toBe("pedido");
    expect(a.avaliador_id).toBeNull();
    const desA = await designacoes(ids.pedidoA);
    expect(desA).toHaveLength(1);
    expect(desA[0].resposta).toBe("expirada");
    expect(desA[0].proposta_expirada_em).not.toBeNull();
    expect(a.aguardando_avaliador, "A: o avaliador voltou à lista; o pedido não fica aguardando").toBe(false);
    expect(await itensDoAdminAbertos(ids.pedidoA), "A: nada vai para a fila do admin").toBe(0);

    // B. Já estava preso: o tique reabre a escolha e resolve o item do admin.
    expect((await linha(ids.pedidoB)).aguardando_avaliador, "B: o pedido preso reabriu").toBe(false);
    expect(await itensDoAdminAbertos(ids.pedidoB), "B: o item do admin resolveu-se").toBe(0);

    // C e D. Quem recusou e quem não respondeu continuam fora: o pedido segue aguardando.
    expect((await linha(ids.pedidoC)).aguardando_avaliador, "C: quem recusou não volta").toBe(true);
    expect((await linha(ids.pedidoD)).aguardando_avaliador, "D: quem não respondeu não volta").toBe(true);

    // O que o dono vê.
    const d = await entrar(browser, dono.email, senha);
    for (const w of LARGURAS) {
      await largura(d, w);
      for (const c of ["A", "B"] as const) {
        await d.goto(`/dashboard/imoveis/${ids[`imovel${c}`]}/nivel`, { waitUntil: "domcontentloaded" });
        const escolha = d.getByTestId("avaliacao-escolha");
        await expect(escolha, `${c} a ${w} px: a escolha está aberta`).toBeVisible({ timeout: 30_000 });
        const cartoes = escolha.getByTestId("avaliacao-sugerido");
        await expect(cartoes).toHaveCount(1);
        await expect(cartoes.first()).toContainText(avaliador.nome);
        await expect(cartoes.first().getByRole("button", { name: `Escolher ${avaliador.nome}` })).toBeVisible();
        await expect(d.getByTestId("avaliacao-situacao")).not.toHaveText(AGUARDANDO);
        expect(await d.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth + 1)).toBe(true);
        await d.screenshot({ path: `${SAIDA}/t1751-1-${c}-volta-${w}.png`, fullPage: true });
      }
      for (const c of ["C", "D"] as const) {
        await d.goto(`/dashboard/imoveis/${ids[`imovel${c}`]}/nivel`, { waitUntil: "domcontentloaded" });
        await expect(d.getByTestId("avaliacao-situacao"), `${c} a ${w} px: continua aguardando`).toHaveText(AGUARDANDO, { timeout: 30_000 });
        await expect(d.getByTestId("avaliacao-escolha")).toHaveCount(0);
      }
    }
    await d.context().close();
  });

  test("2. o dono escolhe de novo o avaliador que voltou: a mesma designação reabre e o avaliador volta a ver o pedido", async ({ browser }) => {
    test.skip(!existsSync(".next/BUILD_ID"), "Depende do caso 1 (a rotina).");
    const d = await entrar(browser, dono.email, senha);
    await largura(d, 390);
    await d.goto(`/dashboard/imoveis/${ids.imovelB}/nivel`, { waitUntil: "domcontentloaded" });
    const escolha = d.getByTestId("avaliacao-escolha");
    await expect(escolha).toBeVisible({ timeout: 30_000 });
    await escolha.getByTestId("avaliacao-sugerido").first().getByRole("button", { name: `Escolher ${avaliador.nome}` }).click();
    await expect.poll(async () => (await linha(ids.pedidoB)).status, { timeout: 20_000 }).toBe("designado");
    expect((await linha(ids.pedidoB)).avaliador_id).toBe(ids.cred);
    await expect(d.getByTestId("avaliacao-aguarda-proposta")).toBeVisible({ timeout: 20_000 });

    // A designação é a mesma linha, reaberta: sem resposta e sem a marca da expiração.
    const des = await designacoes(ids.pedidoB);
    expect(des, "uma linha só por pedido e avaliador").toHaveLength(1);
    expect(des[0].resposta).toBeNull();
    expect(des[0].respondido_em).toBeNull();
    expect(des[0].proposta_expirada_em).toBeNull();
    await d.context().close();

    // O avaliador vê o pedido de novo, para responder.
    const a = await entrar(browser, avaliador.email, senha);
    await largura(a, 390);
    await a.goto("/dashboard/parceiro/avaliacao", { waitUntil: "domcontentloaded" });
    await expect(a.locator(`[data-testid="avaliacao-designada"][data-pedido="${ids.pedidoB}"]`)).toBeVisible({ timeout: 30_000 });
    await a.goto(`/dashboard/parceiro/avaliacao/${ids.pedidoB}`, { waitUntil: "domcontentloaded" });
    await expect(a.getByTestId("pedido-avaliador")).toHaveAttribute("data-etapa", "novo", { timeout: 30_000 });
    await a.context().close();
  });
});
