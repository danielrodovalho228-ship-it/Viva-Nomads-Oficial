import { test, expect, type Page } from "@playwright/test";
import { spawn, type ChildProcess } from "node:child_process";
import { createWriteStream, existsSync } from "node:fs";
import { NO_LABORATORIO, adm, apagarContas, cnpjAleatorio, criarConta, criarImovelPronto, entrar, novaSenha, novoSufixo } from "../fixtures/laboratorio";
import { devolverAVezDaRotinaDaVistoria, pegarAVezDaRotinaDaVistoria } from "../fixtures/vez-da-rotina-da-vistoria";

/*
  T1774 — E1177 @E1177 (ORDENS-DUET 773, 778 e 780; decisão do coordenador; linha Parceiros). A regra da independência
  tira da escolha quem fez a ÚLTIMA avaliação do imóvel. Numa cidade com um avaliador só, a segunda avaliação nunca
  acontecia, e o dono lia "Aguardando avaliador: a Viva avisa quando houver…" — uma promessa que a regra impedia.
  A exceção da alternância: sem nenhum outro elegível, o da avaliação anterior volta à lista, com a marca.
  Massa própria, só contas de teste: uma cidade com UM avaliador ativo (o da avaliação anterior) e um segundo ainda por
  ativar; e uma cidade sem avaliador nenhum. Os pedidos começam como os de produção: parados em "aguardando avaliador",
  sem motivo gravado. A rotina corre num 2º servidor do mesmo build (porta própria).
   1. Depois do tique: o pedido do imóvel já avaliado abre a lista com o cartão "Mesmo avaliador da avaliação
      anterior…", e o dono recebe o e-mail "Já há avaliador…" (a promessa da tela, cumprida). Print a 390 e a 1280 px.
   2. O dono escolhe-o: o pedido fica designado, a designação guarda a marca, e o avaliador vê o pedido para responder.
   3. O estado vazio honesto: na cidade sem avaliador, "Ainda não há avaliador disponível na sua cidade. A Viva avisa
      você assim que houver um."; na contestação sem segundo avaliador, o texto da equipe e o item na fila da equipe.
   4. Esperar: com um segundo avaliador ativo na cidade, o tique seguinte troca o cartão do anterior pelo do novo (a
      regra se mantém) e o dono recebe o e-mail "Há outro avaliador…"; a contestação passa a ter quem escolher.
  Laboratório; não é prova ao vivo no site.
*/
const LARGURAS = [390, 1280] as const;
const SAIDA = "tests/laboratorio/saida";
const CIDADE = "Monte Carmelo";
const CIDADE_SEM = "Romaria";
const PORTA = 3152;
const SEGREDO = `lab-t1774-${Math.random().toString(36).slice(2)}`;
const MESMO = "Mesmo avaliador da avaliação anterior. É o único disponível na sua cidade agora. Você pode escolher ele ou esperar outro avaliador.";
const SEM_NA_CIDADE = "Ainda não há avaliador disponível na sua cidade. A Viva avisa você assim que houver um.";
const CONTESTACAO = "Sua contestação precisa de um avaliador diferente do primeiro. Ainda não há outro na sua cidade, então a equipe da Viva assumiu o seu pedido e responde em até 2 dias úteis.";
const SEM_MOTIVO = "Os avaliadores da sua cidade não podem seguir com este pedido agora. A equipe da Viva foi avisada.";
const senha = novaSenha();
const sufixo = novoSufixo();
const dono = { email: `dono.t1774.${sufixo}@lab.vivanomads.test`, nome: "Dora Volta", role: "owner" as const };
const anterior = { email: `aval.ant.t1774.${sufixo}@lab.vivanomads.test`, nome: "Ari Anterior", role: "tenant" as const };
const outro = { email: `aval.out.t1774.${sufixo}@lab.vivanomads.test`, nome: "Olga Outra", role: "tenant" as const };
const ids: Record<string, string> = {};
/** escolher: o dono escolhe o da anterior · esperar: o dono espera outro · vazio: cidade sem avaliador · contestacao: sem segundo avaliador. */
const CASOS = ["escolher", "esperar", "vazio", "contestacao"] as const;
const TITULO = (c: string) => `Casa ${c} t1774 ${sufixo}`;
let servidor: ChildProcess | null = null;

async function largura(page: Page, w: number) {
  await page.setViewportSize({ width: w, height: w === 390 ? 844 : 900 });
}
const semRolagemLateral = (p: Page) => p.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth + 1);
type Linha = { status: string; avaliador_id: string | null; aguardando_avaliador: boolean; motivo_da_espera: string | null };
const linha = async (pedido: string) => (await adm().from("vistoria_pedidos").select("status, avaliador_id, aguardando_avaliador, motivo_da_espera").eq("id", pedido).single()).data as Linha;
const itensDaFila = async (pedido: string, tipo: string) =>
  ((await adm().from("vistoria_fila_admin").select("id").eq("tipo", tipo).eq("pedido_id", pedido).is("resolvido_em", null)).data ?? []).length;
type Email = { assunto: string; corpo: string };
const emailsDoDono = async (titulo: string) =>
  (((await adm().from("emails_teste").select("assunto, corpo").eq("usuario_id", ids.dono).eq("evento", "vistoria_avaliador_disponivel").order("criado_em", { ascending: true })).data ?? []) as Email[]).filter((e) => e.corpo.includes(titulo));

async function credenciar(conta: { nome: string }, userId: string, apelido: string, status: "ativo" | "solicitado"): Promise<string> {
  const { data: parc, error } = await adm()
    .from("parceiros")
    .insert({ user_id: userId, tipo_pessoa: "pj", documento: cnpjAleatorio(), nome_publico: conta.nome, slug: `aval-t1774-${apelido}-${sufixo}`, categorias: ["fotografia"], cidades: [CIDADE] })
    .select("id")
    .single();
  if (error) throw error;
  ids[`parc_${apelido}`] = parc.id as string;
  const { data: n } = await adm().rpc("proximo_numero_avaliador", { p_sigla: "UDI" });
  const { data: c, error: e2 } = await adm()
    .from("avaliadores_credenciamento")
    .insert({ parceiro_id: parc.id, cidade: CIDADE, numero_credenciado: n as string, status, experiencia_link: "https://portfolio.lab.vivanomads.test/t1774", conduta_versao: "2026-10-23", ativado_em: status === "ativo" ? "2025-01-01T00:00:00Z" : null })
    .select("id")
    .single();
  if (e2) throw e2;
  return c.id as string;
}

/** A avaliação anterior do imóvel: um pedido já com laudo, feito pelo avaliador "anterior". */
async function avaliacaoAnterior(imovel: string): Promise<string> {
  const { data, error } = await adm()
    .from("vistoria_pedidos")
    .insert({ property_id: imovel, owner_id: ids.dono, cidade: CIDADE, porte: "q1_2", valor_tabela: 350, status: "laudo_emitido", teste: true, avaliador_id: ids.credAnterior, designado_em: "2026-11-01T12:00:00Z", agendado_para: "2026-11-03T13:00:00Z", visita_concluida_em: "2026-11-03T15:00:00Z", criado_em: "2026-11-01T11:00:00Z" })
    .select("id")
    .single();
  if (error) throw error;
  return data.id as string;
}

/** O pedido novo, parado como os de produção: "aguardando avaliador", sem o motivo gravado. */
async function pedidoParado(imovel: string, cidade: string, extra: Record<string, unknown> = {}): Promise<string> {
  const { data, error } = await adm()
    .from("vistoria_pedidos")
    .insert({ property_id: imovel, owner_id: ids.dono, cidade, porte: "q1_2", valor_tabela: 350, tipo: "nova_avaliacao", status: "pedido", teste: true, ocupado: false, aguardando_avaliador: true, ...extra })
    .select("id")
    .single();
  if (error) throw error;
  return data.id as string;
}

async function tique(): Promise<{ reprocessados?: number }> {
  const r = await fetch(`http://localhost:${PORTA}/api/cron/vistoria`, { headers: { authorization: `Bearer ${SEGREDO}` } });
  const resumo = (await r.json().catch(() => ({}))) as { ok?: boolean; reprocessados?: number };
  expect(r.status, JSON.stringify(resumo)).toBe(200);
  return resumo;
}

test.describe("T1774 — E1177: a alternância de avaliadores sem beco, e o estado vazio que não promete o que a regra impede @E1177", () => {
  test.skip(!NO_LABORATORIO, "Só no laboratório.");
  test.describe.configure({ mode: "serial", timeout: 300_000 });

  test.beforeAll(async () => {
    // A rotina corre sobre o banco inteiro: esta spec só monta a massa quando nenhuma outra spec de rotina está a meio.
    await pegarAVezDaRotinaDaVistoria("t1774");
    for (const [k, c] of [["dono", dono], ["anterior", anterior], ["outro", outro]] as const) {
      ids[k] = await criarConta(c, senha);
      const t = await adm().from("profiles").update({ is_teste: true }).eq("id", ids[k]);
      if (t.error) throw t.error;
    }
    ids.credAnterior = await credenciar(anterior, ids.anterior, "ant", "ativo");
    // A segunda avaliadora já pediu o credenciamento, mas ainda não está ativa: a cidade tem UM avaliador.
    ids.credOutro = await credenciar(outro, ids.outro, "out", "solicitado");
    for (const u of [ids.dono, ids.anterior, ids.outro]) {
      const p = await adm().from("vistoria_piloto").insert({ user_id: u, nota: "T1774 (laboratório)" });
      if (p.error) throw p.error;
    }
    for (const c of CASOS) ids[`imovel_${c}`] = await criarImovelPronto(ids.dono, TITULO(c), { ativo: true });
    const naCidade = await adm().from("properties").update({ city: CIDADE }).in("id", (["escolher", "esperar", "contestacao"] as const).map((c) => ids[`imovel_${c}`]));
    if (naCidade.error) throw naCidade.error;
    const semCidade = await adm().from("properties").update({ city: CIDADE_SEM }).eq("id", ids.imovel_vazio);
    if (semCidade.error) throw semCidade.error;
    const { error: eT } = await adm()
      .from("vistoria_precos")
      .insert([CIDADE, CIDADE_SEM].flatMap((cidade) => ["estudio", "q1_2", "q3_mais"].map((porte) => ({ cidade, porte, valor: 350 }))));
    if (eT) throw eT;
    // Os três imóveis da cidade já foram avaliados pelo único avaliador ativo.
    for (const c of ["escolher", "esperar", "contestacao"] as const) ids[`anterior_${c}`] = await avaliacaoAnterior(ids[`imovel_${c}`]);
    ids.pedido_escolher = await pedidoParado(ids.imovel_escolher, CIDADE);
    ids.pedido_esperar = await pedidoParado(ids.imovel_esperar, CIDADE);
    ids.pedido_vazio = await pedidoParado(ids.imovel_vazio, CIDADE_SEM);
    ids.pedido_contestacao = await pedidoParado(ids.imovel_contestacao, CIDADE, { tipo: "contestacao", origem_pedido_id: ids.anterior_contestacao });
  });

  test.afterAll(async () => {
    servidor?.kill("SIGTERM");
    const imoveis = CASOS.map((c) => ids[`imovel_${c}`]).filter(Boolean);
    const pedidos = [...CASOS.map((c) => ids[`pedido_${c}`]), ...["escolher", "esperar", "contestacao"].map((c) => ids[`anterior_${c}`])].filter(Boolean);
    const contas = [ids.dono, ids.anterior, ids.outro].filter(Boolean);
    if (contas.length) {
      await adm().from("emails_teste").delete().in("usuario_id", contas);
      await adm().from("avisos").delete().in("usuario_id", contas);
    }
    if (pedidos.length) {
      await adm().from("vistoria_fila_admin").delete().in("pedido_id", pedidos);
      await adm().from("vistoria_designacoes").delete().in("pedido_id", pedidos);
      // A contestação aponta para o pedido de origem: sai primeiro.
      await adm().from("vistoria_pedidos").delete().eq("id", ids.pedido_contestacao ?? "00000000-0000-0000-0000-000000000000");
    }
    if (imoveis.length) await adm().from("vistoria_pedidos").delete().in("property_id", imoveis);
    await adm().from("vistoria_precos").delete().in("cidade", [CIDADE, CIDADE_SEM]);
    if (contas.length) await adm().from("vistoria_piloto").delete().in("user_id", contas);
    for (const cred of [ids.credAnterior, ids.credOutro]) {
      if (!cred) continue;
      await adm().from("vistoria_designacoes").delete().eq("avaliador_id", cred);
      await adm().from("avaliadores_credenciamento").delete().eq("id", cred);
    }
    for (const parc of [ids.parc_ant, ids.parc_out]) if (parc) await adm().from("parceiros").delete().eq("id", parc);
    if (imoveis.length) await adm().from("properties").delete().in("id", imoveis);
    await apagarContas(contas);
    devolverAVezDaRotinaDaVistoria();
  });

  test("1. depois do tique: o imóvel já avaliado abre a lista com o cartão 'Mesmo avaliador da avaliação anterior', e o dono recebe o aviso prometido", async ({ browser }) => {
    test.skip(!existsSync(".next/BUILD_ID"), "Precisa do build do laboratório (next start).");
    // Antes do tique, como em produção: parado, sem motivo gravado — a tela já não promete o aviso.
    const d = await entrar(browser, dono.email, senha);
    await largura(d, 390);
    await d.goto(`/dashboard/imoveis/${ids.imovel_escolher}/nivel`, { waitUntil: "domcontentloaded" });
    await expect(d.getByTestId("avaliacao-situacao")).toHaveText(SEM_MOTIVO, { timeout: 30_000 });
    await expect(d.getByTestId("avaliacao-sugerido")).toHaveCount(0);

    const log = createWriteStream(`${SAIDA}/t1774-servidor-cron.log`);
    servidor = spawn(process.execPath, ["node_modules/next/dist/bin/next", "start", "-p", String(PORTA)], {
      env: { ...process.env, CRON_SECRET: SEGREDO, PORT: String(PORTA) },
      stdio: ["ignore", "pipe", "pipe"],
    });
    servidor.stdout?.pipe(log);
    servidor.stderr?.pipe(log);
    await expect.poll(async () => (await fetch(`http://localhost:${PORTA}/api/cron/vistoria`).catch(() => null))?.status ?? 0, { timeout: 90_000 }).toBe(401);
    const resumo = await tique();
    expect(resumo.reprocessados ?? 0, "os pedidos do imóvel já avaliado passaram a ter quem escolher").toBeGreaterThanOrEqual(2);

    // O pedido deixa de estar parado e guarda que a lista só tem o avaliador da avaliação anterior.
    for (const c of ["escolher", "esperar"] as const) {
      const p = await linha(ids[`pedido_${c}`]);
      expect(p.aguardando_avaliador, c).toBe(false);
      expect(p.motivo_da_espera, c).toBe("so_o_anterior");
      expect(await itensDaFila(ids[`pedido_${c}`], "sem_avaliador"), `${c}: o item "sem avaliador" fecha`).toBe(0);
    }
    // A promessa da tela, cumprida: o dono é avisado de que a lista abriu.
    const emails = await emailsDoDono(TITULO("escolher"));
    expect(emails.length, "um e-mail 'já há avaliador' para este imóvel").toBe(1);
    expect(emails[0].assunto).toContain("Já há avaliador");
    expect(emails[0].corpo).toContain("já há avaliador para você escolher");

    await d.reload({ waitUntil: "domcontentloaded" });
    const cartao = d.getByTestId("avaliacao-sugerido");
    await expect(cartao).toHaveCount(1, { timeout: 30_000 });
    await expect(cartao).toContainText(anterior.nome);
    await expect(cartao.getByTestId("avaliacao-sugerido-mesmo")).toHaveText(MESMO);
    await expect(d.getByTestId("avaliacao-situacao")).toHaveText("Pedido registrado: escolha o avaliador na lista.");
    await expect(d.getByText(/avisa quando houver/)).toHaveCount(0);
    for (const w of LARGURAS) {
      await largura(d, w);
      await cartao.scrollIntoViewIfNeeded();
      await expect(cartao.getByTestId("avaliacao-sugerido-mesmo")).toBeVisible();
      expect(await semRolagemLateral(d), `sem rolagem lateral a ${w} px`).toBe(true);
      await d.screenshot({ path: `${SAIDA}/t1774-1-mesmo-avaliador-${w}.png` });
    }
    await d.context().close();
  });

  test("2. o dono escolhe o mesmo avaliador: o pedido segue, a designação guarda a marca e o avaliador vê o pedido", async ({ browser }) => {
    test.skip(!existsSync(".next/BUILD_ID"), "Depende do caso 1 (a rotina).");
    const d = await entrar(browser, dono.email, senha);
    await largura(d, 390);
    await d.goto(`/dashboard/imoveis/${ids.imovel_escolher}/nivel`, { waitUntil: "domcontentloaded" });
    const cartao = d.getByTestId("avaliacao-sugerido");
    await expect(cartao.getByTestId("avaliacao-sugerido-mesmo")).toHaveText(MESMO, { timeout: 30_000 });
    await cartao.getByTestId("escolher-avaliador").getByRole("button").click();
    await expect.poll(async () => (await linha(ids.pedido_escolher)).status, { timeout: 30_000 }).toBe("designado");
    const p = await linha(ids.pedido_escolher);
    expect(p.avaliador_id).toBe(ids.credAnterior);
    expect(p.motivo_da_espera, "escolhido, o pedido já não espera").toBeNull();
    const { data: des } = await adm().from("vistoria_designacoes").select("avaliador_id, resposta, mesmo_da_anterior").eq("pedido_id", ids.pedido_escolher);
    expect(des).toEqual([{ avaliador_id: ids.credAnterior, resposta: null, mesmo_da_anterior: true }]);
    await d.context().close();
    // O pedido segue: o avaliador vê-o para responder com o valor e o prazo dele.
    const a = await entrar(browser, anterior.email, senha);
    await a.goto("/dashboard/parceiro/avaliacao", { waitUntil: "domcontentloaded" });
    await expect(a.locator(`[data-testid="avaliacao-designada"][data-pedido="${ids.pedido_escolher}"]`).getByTestId("proposta-avaliador")).toBeVisible({ timeout: 30_000 });
    await a.context().close();
  });

  test("3. o estado vazio honesto: a cidade sem avaliador promete o aviso; a contestação sem segundo avaliador vai para a equipe", async ({ browser }) => {
    test.skip(!existsSync(".next/BUILD_ID"), "Depende do caso 1 (a rotina).");
    const vazio = await linha(ids.pedido_vazio);
    expect(vazio.aguardando_avaliador).toBe(true);
    expect(vazio.motivo_da_espera).toBe("sem_avaliador_na_cidade");
    const cont = await linha(ids.pedido_contestacao);
    expect(cont.aguardando_avaliador).toBe(true);
    expect(cont.motivo_da_espera, "quem fez a 1ª avaliação nunca volta pela exceção").toBe("contestacao_sem_segundo");
    expect(await itensDaFila(ids.pedido_contestacao, "contestacao_sem_avaliador"), "o item da contestação na fila da equipe").toBe(1);
    expect(await itensDaFila(ids.pedido_vazio, "contestacao_sem_avaliador")).toBe(0);
    const d = await entrar(browser, dono.email, senha);
    await largura(d, 390);
    await d.goto(`/dashboard/imoveis/${ids.imovel_vazio}/nivel`, { waitUntil: "domcontentloaded" });
    await expect(d.getByTestId("avaliacao-situacao")).toHaveText(SEM_NA_CIDADE, { timeout: 30_000 });
    await d.screenshot({ path: `${SAIDA}/t1774-3-sem-avaliador-na-cidade-390.png` });
    await d.goto(`/dashboard/imoveis/${ids.imovel_contestacao}/nivel`, { waitUntil: "domcontentloaded" });
    await expect(d.getByTestId("avaliacao-situacao")).toHaveText(CONTESTACAO, { timeout: 30_000 });
    await expect(d.getByText(/avisa você assim que houver|avisa quando houver/)).toHaveCount(0);
    await expect(d.getByTestId("avaliacao-sugerido")).toHaveCount(0);
    await d.screenshot({ path: `${SAIDA}/t1774-3-contestacao-sem-segundo-390.png` });
    await d.context().close();
  });

  test("4. esperar: com outro avaliador ativo, o tique seguinte troca o cartão do anterior pelo do novo e avisa o dono", async ({ browser }) => {
    test.skip(!existsSync(".next/BUILD_ID"), "Depende do caso 1 (a rotina).");
    // O dono não escolheu ninguém no imóvel "esperar". A segunda avaliadora é ativada.
    const ativa = await adm().from("avaliadores_credenciamento").update({ status: "ativo", ativado_em: new Date().toISOString() }).eq("id", ids.credOutro);
    if (ativa.error) throw ativa.error;
    await tique();
    const p = await linha(ids.pedido_esperar);
    expect(p.aguardando_avaliador).toBe(false);
    expect(p.motivo_da_espera, "havendo outro, a lista volta a ser comum").toBeNull();
    const emails = await emailsDoDono(TITULO("esperar"));
    // O assunto longo não cabe com o título deste imóvel: sai a forma curta da régua dos assuntos.
    expect(emails.map((e) => e.assunto.replace(/:.*/, "")), "primeiro a lista abriu; depois chegou outro").toEqual(["Já há avaliador", "Há outro avaliador"]);
    expect(emails[1].corpo).toContain("há outro avaliador disponível na sua cidade");
    // A contestação passa a ter quem escolher: sai da fila da equipe.
    const cont = await linha(ids.pedido_contestacao);
    expect(cont.aguardando_avaliador).toBe(false);
    expect(cont.motivo_da_espera).toBeNull();
    expect(await itensDaFila(ids.pedido_contestacao, "contestacao_sem_avaliador")).toBe(0);
    // Na tela: só a avaliadora nova, sem a marca — a regra da avaliação anterior se mantém quando há outro.
    const d = await entrar(browser, dono.email, senha);
    await largura(d, 390);
    await d.goto(`/dashboard/imoveis/${ids.imovel_esperar}/nivel`, { waitUntil: "domcontentloaded" });
    const cartoes = d.getByTestId("avaliacao-sugerido");
    await expect(cartoes).toHaveCount(1, { timeout: 30_000 });
    await expect(cartoes).toContainText(outro.nome);
    await expect(d.getByTestId("avaliacao-sugerido-mesmo")).toHaveCount(0);
    await d.context().close();
  });
});
