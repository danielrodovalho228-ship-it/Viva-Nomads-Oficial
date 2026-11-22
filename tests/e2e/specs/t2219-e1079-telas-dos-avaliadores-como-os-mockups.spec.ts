import { test, expect, type Browser, type Page } from "@playwright/test";
import { authFile } from "../fixtures/auth";
import { NO_LABORATORIO, adm, apagarContas, cnpjAleatorio, criarConta, criarImovelPronto, entrar, novaSenha, novoSufixo } from "../fixtures/laboratorio";
import { ITENS_CHECKLIST } from "../../../src/config/checklist-avaliacao";

/*
  T2219 — E1079, trava (c) (ORDEM-DUET-385/393/397): as telas novas dos avaliadores têm os componentes dos mockups
  aprovados (docs/mockups-avaliadores/, PR #4098). Só no laboratório (a chave da avaliação liga só neste navegador, pelo
  cookie de laboratório). TRAVA EM RASCUNHO: nasce vermelha na main de hoje (as telas ainda são as antigas) e fica verde
  com a reforma.
  Uma tela por teste; cada uma com o estado gravado pelo laboratório (simulação declarada, como na t305) e visitada pela
  tela. Os componentes são cobrados pelo texto/papel do mockup (verificações suaves: uma corrida mostra tudo o que falta);
  a igualdade visual é da QA print × mockup do Gerente. Inventário: peça 52.
  As decisões do Gerente (ORDEM-DUET-397) mandam nas PALAVRAS e no MODELO, e são cobradas aqui:
    1. o nível do laudo é o que o AVALIADOR escolhe no laudo que assina (não há cálculo da plataforma);
    2. a palavra é "avaliador" ("Avaliador credenciado"), nunca "vistoriador";
    3. o preço é o da TABELA DA CIDADE para o porte do imóvel (aqui: estúdio 150, 1–2 quartos 250, 3+ quartos 350;
       os pedidos são de 1–2 quartos → R$ 250), nunca um preço próprio do avaliador.
  Só contas de teste, sem fotos de pessoas reais.
  Cobertura dos 12 mockups (ORDEM-DUET-425): os três pares mobile/desktop (dono-escolha, admin, público) correm a 390 e
  a 1280 px; as barras de baixo dos mockups mobile (morador, avaliador, admin) são cobradas a 390 px.
*/
const senha = novaSenha();
const sufixo = novoSufixo();
const CIDADE = `Uberlândia t2219 ${sufixo}`;
const PRECO = { estudio: 150, q1_2: 250, q3_mais: 350 } as const;
const avaliador = { email: `aval.t2219.${sufixo}@lab.vivanomads.test`, nome: "Rui Avaliador Teste", role: "tenant" as const };
const dono = { email: `dono.t2219.${sufixo}@lab.vivanomads.test`, nome: "Dora Dona Teste", role: "owner" as const };
type Estado = "pedido" | "designado" | "agendado" | "realizada";
const ids: Record<string, string> = {};
const pedidos: Partial<Record<Estado, string>> = {};
const cred = { id: "", numero: "" };
const IMOVEL = { lat: -18.9186, lng: -48.2772 };
const PERTO = { latitude: -18.9178, longitude: -48.2772 };
const SEM_VISTORIADOR = /vistoriador/i;
const brl = (v: number) => new RegExp(`R\\$\\s*${v}(,00)?\\b`);

async function comChave(page: Page) {
  if (page.url() === "about:blank") await page.goto("/", { waitUntil: "domcontentloaded" });
  await page.context().addCookies([{ name: "vn_lab_vistoria", value: "1", url: new URL(page.url()).origin }]);
}
async function abrir(browser: Browser, email: string, largura = 390): Promise<Page> {
  const page = await entrar(browser, email, senha);
  await page.setViewportSize({ width: largura, height: largura === 390 ? 844 : 900 });
  await comChave(page);
  await page.context().grantPermissions(["geolocation"]);
  await page.context().setGeolocation(PERTO);
  return page;
}
/** Os textos do mockup que têm de estar na tela (suaves: a corrida mostra todos os que faltam). */
async function temTudo(page: Page, tela: string, textos: (string | RegExp)[]) {
  const main = page.locator("main");
  await expect(main, `${tela}: a tela abriu`).toBeVisible({ timeout: 30_000 });
  const t = await main.innerText();
  for (const x of textos) expect.soft(typeof x === "string" ? t.includes(x) : x.test(t), `${tela}: tem "${String(x)}" (mockup)`).toBe(true);
  expect.soft(t, `${tela}: a palavra é "avaliador", nunca "vistoriador" (decisão 2)`).not.toMatch(SEM_VISTORIADOR);
}
/** As barras de baixo dos mockups mobile (peça 52): os cinco itens, pelo texto, numa navegação da página (390 px). */
const BARRA = {
  morador: ["Início", "Buscar", "Meus pedidos", "Mensagens", "Conta"],
  avaliador: ["Início", "Pedidos", "Agenda", "Recebidos", "Conta"],
  admin: ["Início", "Fila", "Buscar", "Avisos", "Conta"],
} as const;
async function temBarra(page: Page, tela: string, itens: readonly string[]) {
  if ((page.viewportSize()?.width ?? 0) > 500) return; // a barra de baixo é dos mockups mobile
  const navs = await page.getByRole("navigation").allInnerTexts();
  const tem = navs.some((n) => itens.every((i) => n.includes(i)));
  expect.soft(tem, `${tela}: barra de baixo do mockup com ${itens.join(" · ")} (navegações achadas: ${navs.map((n) => n.replace(/\s+/g, " ").slice(0, 80)).join(" | ") || "nenhuma"})`).toBe(true);
}
const LARGURAS = [390, 1280] as const;

test.describe("T2219 — E1079 (c): as telas dos avaliadores têm os componentes dos mockups aprovados @E1079", () => {
  test.skip(!NO_LABORATORIO, "Só no laboratório.");
  test.describe.configure({ timeout: 180_000 });

  test.beforeAll(async () => {
    ids.av = await criarConta(avaliador, senha);
    ids.dono = await criarConta(dono, senha);
    const { data: parc, error } = await adm()
      .from("parceiros")
      .insert({ user_id: ids.av, tipo_pessoa: "pj", documento: cnpjAleatorio(), nome_publico: avaliador.nome, slug: `aval-t2219-${sufixo}`, categorias: ["fotografia"], cidades: [CIDADE] })
      .select("id")
      .single();
    if (error) throw error;
    const { data: n } = await adm().rpc("proximo_numero_avaliador", { p_sigla: "UDI" });
    const { data: c, error: eC } = await adm()
      .from("avaliadores_credenciamento")
      .insert({ parceiro_id: parc.id, cidade: CIDADE, numero_credenciado: n, status: "ativo", experiencia_link: "https://portfolio.lab.vivanomads.test", conduta_versao: "2026-10-23", ativado_em: new Date().toISOString() })
      .select("id, numero_credenciado")
      .single();
    if (eC) throw eC;
    cred.id = c.id as string;
    cred.numero = c.numero_credenciado as string;
    await adm().from("vistoria_precos").delete().eq("cidade", CIDADE);
    await adm().from("vistoria_precos").insert(Object.entries(PRECO).map(([porte, valor]) => ({ cidade: CIDADE, porte, valor })));
    // Um imóvel por estado (um pedido aberto por imóvel).
    const horas = (h: number) => new Date(Date.now() + h * 3_600_000).toISOString();
    const extra: Record<Estado, Record<string, unknown>> = {
      pedido: { status: "pedido" },
      designado: { status: "designado", avaliador_id: cred.id, designado_em: horas(-1), escolhido_em: horas(-1) },
      agendado: { status: "agendado", avaliador_id: cred.id, designado_em: horas(-30), agendado_para: horas(-2), proposta_aceita_em: horas(-28) },
      realizada: { status: "realizada", avaliador_id: cred.id, designado_em: horas(-50), agendado_para: horas(-3), proposta_aceita_em: horas(-48), visita_concluida_em: horas(-1) },
    };
    for (const e of ["pedido", "designado", "agendado", "realizada"] as const) {
      ids[e] = await criarImovelPronto(ids.dono, `Studio ${e} T2219 ${sufixo}`, { ativo: true });
      await adm().from("properties").update({ city: CIDADE, lat: IMOVEL.lat, lng: IMOVEL.lng, lat_exata: IMOVEL.lat, lng_exata: IMOVEL.lng }).eq("id", ids[e]);
      const { data: p, error: eP } = await adm()
        .from("vistoria_pedidos")
        .insert({ property_id: ids[e], owner_id: ids.dono, cidade: CIDADE, porte: "q1_2", valor_tabela: PRECO.q1_2, ...extra[e] })
        .select("id")
        .single();
      if (eP) throw eP;
      pedidos[e] = p.id as string;
      if (e !== "pedido") await adm().from("vistoria_designacoes").insert({ pedido_id: p.id, avaliador_id: cred.id, designado_em: horas(-1), ...(e === "designado" ? {} : { resposta: "aceita", respondido_em: horas(-1) }) });
    }
    // O checklist do pedido "realizada" preenchido (simulação declarada, como na t305).
    await adm().from("vistoria_checklist").upsert(
      ITENS_CHECKLIST.map((i) => ({ pedido_id: pedidos.realizada, chave: i.chave, valor: "tipo" in i && i.tipo === "limpeza" ? "pronto" : "conforme", observacao: null })),
      { onConflict: "pedido_id,chave" },
    );
    await adm().from("vistoria_pedidos").update({ ruido_respostas: { via_intensa: false, noturno_obra_100m: false, aviao_ferrovia: false, isolamento_acustico: false } }).eq("id", pedidos.realizada!);
  });

  test.afterAll(async () => {
    const ps = Object.values(pedidos).filter(Boolean) as string[];
    if (ps.length) {
      await adm().from("vistoria_laudos").delete().in("pedido_id", ps);
      await adm().from("vistoria_checklist").delete().in("pedido_id", ps);
      await adm().from("vistoria_designacoes").delete().in("pedido_id", ps);
      await adm().from("vistoria_pedidos").delete().in("id", ps);
    }
    if (cred.id) await adm().from("avaliadores_credenciamento").delete().eq("id", cred.id);
    await adm().from("vistoria_precos").delete().eq("cidade", CIDADE);
    await apagarContas([ids.av, ids.dono].filter(Boolean));
  });

  for (const largura of LARGURAS) test(`dono-escolha-avaliador a ${largura} px (mockups mobile e desktop): Escolher avaliador, o cartão com o preço da tabela da cidade`, async ({ browser }) => {
    const d = await abrir(browser, dono.email, largura);
    await d.goto(`/dashboard/imoveis/${ids.pedido}/nivel`, { waitUntil: "domcontentloaded" });
    await temTudo(d, "dono-escolha", ["Escolher avaliador", `Avaliadores disponíveis em`, avaliador.nome, "Novo na Viva", /Avalia[çc][ãa]o:\s*R\$/]);
    const main = d.locator("main");
    expect.soft(await main.innerText(), "decisão 3: o cartão mostra o preço da tabela da cidade para 1–2 quartos (R$ 250)").toMatch(new RegExp(`Avalia[çc][ãa]o:\\s*${brl(PRECO.q1_2).source}`));
    await expect.soft(main.getByRole("button", { name: /^Escolher$/ }).first(), "o botão \"Escolher\" do cartão").toBeVisible();
    await temBarra(d, "dono-escolha", BARRA.morador);
    await d.context().close();
  });

  test("avaliador-perfil-publico: Perfil do Avaliador com o preço da tabela da cidade e sem contacto", async ({ browser }) => {
    const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, storageState: { cookies: [], origins: [] } });
    const p = await ctx.newPage();
    await comChave(p);
    await p.goto(`/avaliadores/${cred.numero}`, { waitUntil: "domcontentloaded" });
    await temTudo(p, "perfil-publico", ["Perfil do Avaliador", avaliador.nome, "Novo na Viva", "Sobre", "Preço da avaliação", "Estúdio", "1–2 quartos", "3+ quartos", "Identidade verificada pela Viva"]);
    const t = await p.locator("main").innerText();
    for (const [porte, valor] of Object.entries(PRECO)) expect.soft(brl(valor).test(t), `decisão 3: a tabela do perfil traz o preço da cidade (${porte}: R$ ${valor})`).toBe(true);
    expect.soft((await p.locator("main").innerHTML()).match(/tel:|mailto:|wa\.me|@lab\.vivanomads\.test/i), "sem telefone nem e-mail").toBeNull();
    await ctx.close();
  });

  test("avaliador-painel: Olá, Avaliador, Ver pedidos, Pedidos · Agenda · Recebidos · Meu nível", async ({ browser }) => {
    const a = await abrir(browser, avaliador.email);
    await a.goto("/dashboard/parceiro/avaliacao", { waitUntil: "domcontentloaded" });
    await temTudo(a, "avaliador-painel", [/Olá, Rui!/, /Você tem \d+ visitas? hoje/, "Avaliador", "Ver pedidos", "Pedidos", "Agenda", "Recebidos", "Meu nível"]);
    await temBarra(a, "avaliador-painel", BARRA.avaliador);
    await a.context().close();
  });

  test("avaliador-pedido: Novo pedido de avaliação, porte, data, Você recebe R$ (tabela), Aceitar pedido · Recusar", async ({ browser }) => {
    const a = await abrir(browser, avaliador.email);
    await a.goto(`/dashboard/parceiro/avaliacao/${pedidos.designado}`, { waitUntil: "domcontentloaded" });
    await temTudo(a, "avaliador-pedido", ["Novo pedido de avaliação", "Novo", /Porte:/, /Data pedida pelo dono/, /Você recebe R\$/, "Aceitar pedido", "Recusar"]);
    expect.soft(await a.locator("main").innerText(), "decisão 3: \"Você recebe\" é o preço da tabela da cidade (R$ 250)").toMatch(new RegExp(`Você recebe\\s*${brl(PRECO.q1_2).source}`));
    await temBarra(a, "avaliador-pedido", BARRA.avaliador);
    await a.context().close();
  });

  test("avaliador-visita: Visita em andamento, Roteiro da visita, Fotos do imóvel, Continuar", async ({ browser }) => {
    const a = await abrir(browser, avaliador.email);
    await a.goto(`/dashboard/parceiro/avaliacao/${pedidos.agendado}`, { waitUntil: "domcontentloaded" });
    await temTudo(a, "avaliador-visita", ["Visita em andamento", "Roteiro da visita", "Fotos da fachada", "Sala", "Cozinha", "Quartos", "Banheiros", "Fotos do imóvel", "Adicionar foto", "Continuar"]);
    await temBarra(a, "avaliador-visita", BARRA.avaliador);
    await a.context().close();
  });

  test("avaliador-laudo: o avaliador escolhe o nível no laudo que assina, e é esse o nível gravado (decisão 1)", async ({ browser }) => {
    const a = await abrir(browser, avaliador.email);
    await a.goto(`/dashboard/parceiro/avaliacao/${pedidos.realizada}`, { waitUntil: "domcontentloaded" });
    await temTudo(a, "avaliador-laudo", ["Laudo da avaliação", "Escolha o nível do imóvel", "Essencial", "Simples e funcional", "Conforto", "Bem equipado e acolhedor", "Premium", "Acabamento superior", /fotos enviadas/, "Checklist completo", "Assinar laudo"]);
    await temBarra(a, "avaliador-laudo", BARRA.avaliador);
    // O checklist todo "conforme" é o mesmo para os três níveis: a escolha do avaliador é que decide. Escolhe "Premium".
    await a.locator("main").getByRole("radio", { name: /Premium/ }).or(a.locator("main").getByRole("button", { name: /Premium/ })).first().click();
    await a.locator("main").getByRole("button", { name: "Assinar laudo" }).click();
    await expect
      .poll(async () => ((await adm().from("vistoria_laudos").select("nivel_sustentado").eq("pedido_id", pedidos.realizada!).order("versao", { ascending: false }).limit(1).maybeSingle()).data?.nivel_sustentado as string | undefined) ?? "sem laudo", {
        timeout: 30_000,
        message: "decisão 1: o nível gravado no laudo é o que o avaliador escolheu",
      })
      .toBe("premium");
    await a.context().close();
    const d = await abrir(browser, dono.email);
    await d.goto(`/dashboard/imoveis/${ids.realizada}/nivel`, { waitUntil: "domcontentloaded" });
    await expect.soft(d.locator("main"), "o dono lê o nível escolhido no laudo").toContainText(/Premium/, { timeout: 20_000 });
    await d.context().close();
  });

  for (const largura of LARGURAS) test(`admin-avaliadores a ${largura} px (mockups mobile e desktop): Chave da Vistoria, Credenciamento (nº • cidade, estado), Tabela de preços da cidade`, async ({ browser }) => {
    const ctx = await browser.newContext({ storageState: authFile("admin"), viewport: { width: largura, height: largura === 390 ? 844 : 900 } });
    const p = await ctx.newPage();
    await p.goto("/admin/avaliadores", { waitUntil: "domcontentloaded" });
    await temTudo(p, "admin-avaliadores", ["Avaliadores", "Admin", "Chave da Vistoria", "Tabela de preço preenchida", /avaliadores ativos na cidade/, "Parecer jurídico", "Credenciamento", new RegExp(`${cred.numero}\\s*•`), "Ativo", /Tabela de preços —/, "Estúdio", "1–2 quartos", "3+ quartos"]);
    await temBarra(p, "admin-avaliadores", BARRA.admin);
    await ctx.close();
  });

  for (const largura of LARGURAS) test(`publico-avaliadores a ${largura} px (aberta pela chave; mockups mobile e desktop): Avaliadores em <cidade>, Buscar por cidade, o cartão sem contacto`, async ({ browser }) => {
    const ctx = await browser.newContext({ viewport: { width: largura, height: largura === 390 ? 844 : 900 }, storageState: { cookies: [], origins: [] } });
    const p = await ctx.newPage();
    await comChave(p);
    await p.goto(`/avaliadores?cidade=${encodeURIComponent(CIDADE)}`, { waitUntil: "domcontentloaded" });
    await temTudo(p, "publico-avaliadores", [/Avaliadores em/, "Buscar por cidade", "Identidade verificada pela Viva", avaliador.nome, /Avaliador sócio da Viva|Credenciad[ao]/, /Novo na Viva|★\s*\d+ avaliaç/]);
    // O cartão do mockup não tem número nem contacto (regra do Daniel).
    expect.soft((await p.locator("main").innerHTML()).match(/tel:|mailto:|wa\.me|@lab\.vivanomads\.test/i), "publico: sem telefone nem e-mail").toBeNull();
    await ctx.close();
  });

  test("morador-servico-avaliador: Pedir um serviço, as cinco linhas e Pedir serviço", async ({ browser }) => {
    const d = await abrir(browser, dono.email);
    await d.goto("/dashboard/servicos", { waitUntil: "domcontentloaded" });
    await temTudo(d, "servicos", ["Pedir um serviço", "Limpeza", "Lavanderia", "Manutenção leve", "Avaliação do imóvel", "Laudo com o nível do imóvel", "Frete e mudança", "Pedir serviço"]);
    await temBarra(d, "servicos", BARRA.morador);
    await d.context().close();
  });
});
