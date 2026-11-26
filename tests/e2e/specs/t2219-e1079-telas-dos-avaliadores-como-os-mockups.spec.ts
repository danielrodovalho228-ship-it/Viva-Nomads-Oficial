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
  t1722 × t2219 (ORDEM-DUET-429, decisão do Gerente): ficam as duas. A t1722 é a trava de comportamento das telas; esta
  é a de conformidade. Onde uma asserção daqui duplicava exactamente uma da t1722, ficou lá e aqui só se referencia:
    - serviços: o cartão "Avaliação do imóvel" com "Laudo com o nível do imóvel" → t1722, teste 2;
    - dono-escolha: "Avaliadores disponíveis em <cidade>" e "Avaliação: R$ <tabela da cidade>" (decisão 3) → t1722, teste 3;
    - público: o título "Avaliadores em <cidade>" → t1722, teste 1.
  Cobertura dos mockups (ORDEM-DUET-425): os três pares mobile/desktop (dono-escolha, admin, público) correm a 390 e
  a 1280 px. A grade de serviços (morador-servico-avaliador) saiu: dela, só o cartão da avaliação é do E1080, e esse está
  na t1722 (teste 2) — o resto é tela do morador, fora do E1079 (ORDEM-DUET-453). As barras de baixo ficam fora (navegação global fora do âmbito do E1079 — decisão do Gerente, 22/11).
*/
const senha = novaSenha();
const sufixo = novoSufixo();
// Cidade real e só desta spec (a listagem pública vive em /avaliadores/<cidade> e só aceita município do IBGE;
// nenhum outro spec do laboratório usa Ituiutaba — a t1722 usa Patrocínio).
const CIDADE = "Ituiutaba";
const SLUG_CIDADE = "ituiutaba";
/** Nas telas públicas aparece o nome curto (o primeiro nome) do avaliador, como na t1722 e na t2220 (E1084). */
const NOME_PUBLICO = /\bRui\b/;
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
const temTexto = (t: string, x: string | RegExp) => (typeof x === "string" ? t.includes(x) : x.test(t));
/**
 * Os textos do mockup que têm de estar na tela (suaves: a corrida mostra todos os que faltam).
 * ORDEM-DUET-662: a leitura era feita mal o <main> aparecia — às vezes ainda o esqueleto de carregamento do painel
 * (loading.tsx: role="status", aria-label "Carregando…"), e a jornada falhava sem defeito no produto. Agora espera que
 * o esqueleto saia e que o conteúdo real chegue (todos os textos, até 20 s); se algum não chegar, as verificações
 * suaves abaixo dizem qual — a trava continua a morder quando um texto do mockup falta de verdade.
 */
async function temTudo(page: Page, tela: string, textos: (string | RegExp)[]) {
  const main = page.locator("main");
  await expect(main, `${tela}: a tela abriu`).toBeVisible({ timeout: 30_000 });
  await expect(page.locator('[role="status"][aria-label^="Carregando"]'), `${tela}: o esqueleto de carregamento saiu`).toHaveCount(0, { timeout: 30_000 });
  await expect
    .poll(async () => {
      const agora = await main.innerText();
      return textos.every((x) => temTexto(agora, x));
    }, { timeout: 20_000 })
    .toBe(true)
    .catch(() => {});
  const t = await main.innerText();
  for (const x of textos) expect.soft(temTexto(t, x), `${tela}: tem "${String(x)}" (mockup)`).toBe(true);
  expect.soft(t, `${tela}: a palavra é "avaliador", nunca "vistoriador" (decisão 2)`).not.toMatch(SEM_VISTORIADOR);
}
/* As barras de baixo dos mockups (morador, avaliador, admin) NÃO são cobradas aqui: navegação global fora do âmbito do
   E1079 — decisão do Gerente, 22/11 (ORDEM-DUET-427). Os mockups mandam no conteúdo e no desenho das telas; a barra de
   baixo de cada papel fica a da app real, e as telas do avaliador encaixam nela. */
const LARGURAS = [390, 1280] as const;

test.describe("T2219 — E1079 (c): as telas dos avaliadores têm os componentes dos mockups aprovados @E1079", () => {
  test.skip(!NO_LABORATORIO, "Só no laboratório.");
  test.describe.configure({ timeout: 180_000 });

  test.beforeAll(async () => {
    ids.av = await criarConta(avaliador, senha);
    ids.dono = await criarConta(dono, senha);
    // As telas novas vivem no piloto (E1077): como na t1722, o dono e o avaliador entram na lista do piloto e são
    // dados de teste (decisão (a) da ORDEM-375). O cookie de laboratório continua a abrir a chave neste navegador.
    await adm().from("profiles").update({ is_teste: true }).in("id", [ids.av, ids.dono]);
    const { error: ePil } = await adm().from("vistoria_piloto").insert([ids.dono, ids.av].map((user_id) => ({ user_id, nota: "T2219 (laboratório)" })));
    if (ePil) throw ePil;
    // A identidade da conta do avaliador CONFIRMADA (laudo simulado de conta de teste, como na t380): o perfil e a
    // listagem só dizem "Identidade verificada pela Viva" com ela (E1099/E1096, ORDEM-DUET-460 §3).
    await adm().from("tenant_verifications").insert({ tenant_id: ids.av, caf_result: { identity: true, document: true, liveness: true, light: "green", simulado: true }, traffic_light: "green", valid_until: new Date(Date.now() + 365 * 86_400_000).toISOString() });
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
      // ORDEM-DUET-453: o pedido da escolha nasce PELA TELA ("Pedir avaliação do imóvel"), como na t1722 — só assim o
      // servidor monta a lista de sugeridos. Este imóvel fica sem pedido gravado.
      if (e === "pedido") continue;
      const { data: p, error: eP } = await adm()
        .from("vistoria_pedidos")
        .insert({ property_id: ids[e], owner_id: ids.dono, cidade: CIDADE, porte: "q1_2", valor_tabela: PRECO.q1_2, ...extra[e] })
        .select("id")
        .single();
      if (eP) throw eP;
      pedidos[e] = p.id as string;
      await adm().from("vistoria_designacoes").insert({ pedido_id: p.id, avaliador_id: cred.id, designado_em: horas(-1), ...(e === "designado" ? {} : { resposta: "aceita", respondido_em: horas(-1) }) });
    }
    // O checklist do pedido "realizada" preenchido (simulação declarada, como na t305).
    await adm().from("vistoria_checklist").upsert(
      ITENS_CHECKLIST.map((i) => ({ pedido_id: pedidos.realizada, chave: i.chave, valor: "tipo" in i && i.tipo === "limpeza" ? "pronto" : "conforme", observacao: null })),
      { onConflict: "pedido_id,chave" },
    );
    // As fotos da visita (simulação declarada): o resumo do laudo conta-as ("N fotos enviadas").
    const { error: eF } = await adm().from("vistoria_checklist_fotos").insert(
      ["fachada", "sala", "cozinha"].map((comodo, i) => ({ pedido_id: pedidos.realizada, comodo, path: `${pedidos.realizada}/t2219-${i}.webp` })),
    );
    if (eF) throw eF;
    await adm().from("vistoria_pedidos").update({ ruido_respostas: { via_intensa: false, noturno_obra_100m: false, aviao_ferrovia: false, isolamento_acustico: false } }).eq("id", pedidos.realizada!);
  });

  test.afterAll(async () => {
    if (ids.pedido) {
      const { data: viaTela } = await adm().from("vistoria_pedidos").select("id").eq("property_id", ids.pedido);
      for (const v of viaTela ?? []) pedidos.pedido = v.id as string;
    }
    const ps = Object.values(pedidos).filter(Boolean) as string[];
    if (ps.length) {
      await adm().from("vistoria_laudos").delete().in("pedido_id", ps);
      await adm().from("vistoria_checklist_fotos").delete().in("pedido_id", ps);
      await adm().from("vistoria_checklist").delete().in("pedido_id", ps);
      await adm().from("vistoria_designacoes").delete().in("pedido_id", ps);
      await adm().from("vistoria_pedidos").delete().in("id", ps);
    }
    if (cred.id) await adm().from("avaliadores_credenciamento").delete().eq("id", cred.id);
    await adm().from("vistoria_precos").delete().eq("cidade", CIDADE);
    await adm().from("vistoria_piloto").delete().in("user_id", [ids.av, ids.dono].filter(Boolean));
    if (ids.av) await adm().from("tenant_verifications").delete().eq("tenant_id", ids.av);
    await apagarContas([ids.av, ids.dono].filter(Boolean));
  });

  for (const largura of LARGURAS) test(`dono-escolha-avaliador a ${largura} px (mockups mobile e desktop): Escolher avaliador, o cartão com o preço da tabela da cidade`, async ({ browser }) => {
    const d = await abrir(browser, dono.email, largura);
    await d.goto(`/dashboard/imoveis/${ids.pedido}/nivel`, { waitUntil: "domcontentloaded" });
    // O dono pede pela tela (uma vez, na primeira largura); a escolha aparece ao reabrir com o pedido "pedido" (t1722).
    const temPedido = async () => ((await adm().from("vistoria_pedidos").select("status").eq("property_id", ids.pedido).maybeSingle()).data?.status as string | undefined) ?? "";
    if (!(await temPedido())) {
      await d.getByTestId("pedir-avaliacao").getByRole("button", { name: "Pedir avaliação do imóvel" }).click({ timeout: 25_000 });
      await expect.poll(temPedido, { timeout: 20_000, message: "o pedido grava no servidor" }).toBe("pedido");
      await d.goto(`/dashboard/imoveis/${ids.pedido}/nivel`, { waitUntil: "domcontentloaded" });
    }
    await expect(d.getByTestId("avaliacao-escolha"), "a escolha aparece com o pedido feito pela tela").toBeVisible({ timeout: 30_000 });
    await temTudo(d, "dono-escolha", ["Escolher avaliador", avaliador.nome, "Novo na Viva"]);
    // "Avaliadores disponíveis em <cidade>" e "Avaliação: R$ <tabela>" (decisão 3): cobrados na t1722, teste 3.
    const main = d.locator("main");
    // O texto do botão é "Escolher" (mockup); o nome acessível leva o avaliador ("Escolher <nome>"), para o leitor de tela.
    await expect.soft(main.getByRole("button", { name: /^Escolher( |$)/ }).filter({ hasText: /^\s*Escolher\s*$/ }).first(), "o botão \"Escolher\" do cartão").toBeVisible();
    await d.context().close();
  });

  test("avaliador-perfil-publico: Perfil do Avaliador com o preço da tabela da cidade e sem contacto", async ({ browser }) => {
    const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, storageState: { cookies: [], origins: [] } });
    const p = await ctx.newPage();
    await comChave(p);
    await p.goto(`/avaliadores/${cred.numero}`, { waitUntil: "domcontentloaded" });
    await temTudo(p, "perfil-publico", ["Perfil do Avaliador", NOME_PUBLICO, "Novo na Viva", "Preço da avaliação", "Estúdio", "1–2 quartos", "3+ quartos", "Identidade verificada pela Viva"]);
    // "Sobre" (E1099, ORDEM-DUET-458 §2): campo opcional do avaliador; vazio = secção escondida (nunca caixa vazia).
    expect.soft(await p.getByTestId("avaliador-sobre").count(), "perfil-publico: sem texto do avaliador, a secção \"Sobre\" não aparece").toBe(0);
    const SOBRE = `Avaliador de teste do laboratório (T2219 ${sufixo}).`;
    const { error: eSobre } = await adm().from("avaliadores_credenciamento").update({ sobre: SOBRE }).eq("id", cred.id);
    await p.reload({ waitUntil: "domcontentloaded" });
    await expect.soft(p.locator("main"), `perfil-publico: com o texto do avaliador, a secção "Sobre" mostra-o (gravação: ${eSobre?.message ?? "ok"})`).toContainText(new RegExp(`Sobre[\\s\\S]*${SOBRE.replace(/[.()]/g, "\\$&")}`));
    const t = await p.locator("main").innerText();
    for (const [porte, valor] of Object.entries(PRECO)) expect.soft(brl(valor).test(t), `decisão 3: a tabela do perfil traz o preço da cidade (${porte}: R$ ${valor})`).toBe(true);
    expect.soft((await p.locator("main").innerHTML()).match(/tel:|mailto:|wa\.me|@lab\.vivanomads\.test/i), "sem telefone nem e-mail").toBeNull();
    await ctx.close();
  });

  // "Meu nível" → "Credenciamento": divergência ACEITE pelo Gerente (ORDEM-DUET-453) — não existe nível do avaliador no
  // sistema; o 4.º cartão é o do estado do credenciamento. Esta spec não o cobra.
  test("avaliador-painel: Olá, Avaliador, Ver pedidos, Pedidos · Agenda · Recebidos · Credenciamento", async ({ browser }) => {
    const a = await abrir(browser, avaliador.email);
    await a.goto("/dashboard/parceiro/avaliacao", { waitUntil: "domcontentloaded" });
    // O painel chega em partes: espera a saudação antes de ler o texto (a 1.ª tentativa lia cedo demais — corrida 45033611381).
    await expect(a.getByText(/Olá, Rui!/)).toBeVisible({ timeout: 30_000 });
    await temTudo(a, "avaliador-painel", [/Olá, Rui!/, /Você tem \d+ visitas? hoje/, "Avaliador", "Ver pedidos", "Pedidos", "Agenda", "Recebidos", "Credenciamento"]);
    await a.context().close();
  });

  test("avaliador-pedido: Novo pedido de avaliação, porte, data, Você recebe R$ (tabela), Aceitar pedido · Recusar", async ({ browser }) => {
    const a = await abrir(browser, avaliador.email);
    await a.goto(`/dashboard/parceiro/avaliacao/${pedidos.designado}`, { waitUntil: "domcontentloaded" });
    // Fatia 3 (#4121, aceite com a proposta do E648 de pé): no pedido NOVO não há "Data pedida pelo dono" (quem agenda é o
    // avaliador, depois do aceite) e o valor aparece como referência da tabela; "Você recebe" só depois de o dono aceitar.
    await temTudo(a, "avaliador-pedido", ["Novo pedido de avaliação", "Novo", /Porte:/, "Aceitar pedido", "Recusar"]);
    expect.soft(await a.locator("main").innerText(), "decisão 3: a referência é o preço da tabela da cidade (R$ 250)").toMatch(new RegExp(`Valor de referência:\\s*${brl(PRECO.q1_2).source}`));
    await a.context().close();
  });

  test("avaliador-visita: Visita em andamento, Roteiro da visita, Fotos do imóvel, Continuar", async ({ browser }) => {
    const a = await abrir(browser, avaliador.email);
    await a.goto(`/dashboard/parceiro/avaliacao/${pedidos.agendado}`, { waitUntil: "domcontentloaded" });
    await temTudo(a, "avaliador-visita", ["Visita em andamento", "Roteiro da visita", "Fotos da fachada", "Sala", "Cozinha", "Quartos", "Banheiros", "Fotos do imóvel", "Adicionar foto", "Continuar"]);
    await a.context().close();
  });

  test("avaliador-laudo: o avaliador escolhe o nível no laudo que assina, e é esse o nível gravado (decisão 1)", async ({ browser }) => {
    const a = await abrir(browser, avaliador.email);
    await a.goto(`/dashboard/parceiro/avaliacao/${pedidos.realizada}`, { waitUntil: "domcontentloaded" });
    await temTudo(a, "avaliador-laudo", ["Laudo da avaliação", "Escolha o nível do imóvel", "Essencial", "Simples e funcional", "Conforto", "Bem equipado e acolhedor", "Premium", "Acabamento superior", /fotos enviadas/, "Checklist completo", "Assinar laudo"]);
    // O checklist todo "conforme" é o mesmo para os três níveis: a escolha do avaliador é que decide. Escolhe "Premium".
    // O rádio é sr-only dentro do cartão (label): clica-se o cartão, como a pessoa faz.
    await a.getByTestId("laudo-nivel-premium").click();
    // Como na t2221: o avaliador marca a declaração de que assina antes de assinar.
    await a.getByTestId("assino-laudo").getByRole("checkbox").check();
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
    // A pílula "Admin" é do celular; a 1280 px o mockup põe-na no cabeçalho global — fora do E1079 (ORDEM-DUET-427/453).
    await temTudo(p, "admin-avaliadores", ["Avaliadores", ...(largura === 390 ? ["Admin"] : []), "Chave da Vistoria", "Tabela de preço preenchida", /avaliadores ativos na cidade/, "Parecer jurídico", "Credenciamento", new RegExp(`${cred.numero}\\s*•`), "Ativo", /Tabela de preços —/, "Estúdio", "1–2 quartos", "3+ quartos"]);
    await ctx.close();
  });

  for (const largura of LARGURAS) test(`publico-avaliadores a ${largura} px (aberta pela chave; mockups mobile e desktop): Buscar por cidade, o cartão sem contacto`, async ({ browser }) => {
    const ctx = await browser.newContext({ viewport: { width: largura, height: largura === 390 ? 844 : 900 }, storageState: { cookies: [], origins: [] } });
    const p = await ctx.newPage();
    await comChave(p);
    await p.goto(`/avaliadores/${SLUG_CIDADE}`, { waitUntil: "domcontentloaded" });
    // A busca é um campo: "Buscar por cidade" é o placeholder e o nome acessível, não texto da página.
    await expect.soft(p.getByRole("search").getByPlaceholder("Buscar por cidade"), "publico: o campo \"Buscar por cidade\"").toBeVisible();
    // O selo (E1097, decisão do Daniel de 22/11): "Avaliador credenciado" para os credenciados; "Avaliador sócio da Viva"
    // só para o Rogério. O avaliador DESTA spec é conta de teste (só contas de teste nos ensaios), e conta de teste leva
    // "Avaliador em teste" (E717, mantido no E1097 — seloDoCredenciado); o texto do credenciado real trava-o o unitário
    // e1097-selo-publico.test.ts. A estrela das avaliações é ícone (aria-hidden): conta o texto "N avaliação(ões)".
    await temTudo(p, "publico-avaliadores", ["Identidade verificada pela Viva", NOME_PUBLICO, /Avaliador em teste/, /Novo na Viva|\d+ avaliaç/]);
    // O cartão do mockup não tem número nem contacto (regra do Daniel).
    expect.soft((await p.locator("main").innerHTML()).match(/tel:|mailto:|wa\.me|@lab\.vivanomads\.test/i), "publico: sem telefone nem e-mail").toBeNull();
    await ctx.close();
  });
});
