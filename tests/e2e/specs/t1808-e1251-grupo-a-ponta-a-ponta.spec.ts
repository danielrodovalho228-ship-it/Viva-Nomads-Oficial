import { test, expect, type Browser, type Page } from "@playwright/test";
import { NO_LABORATORIO, adm, apagarContas, criarConta, criarImovelPronto, criarLead, entrar, novaSenha, novoSufixo } from "../fixtures/laboratorio";

/*
  Vizinha do E1247 passo 2, PR 1 (ESPEC-E1247-PASSO-2, 3): o botão da faixa passa a ler o evento próprio das rotinas. Corre sem alteração.
  T1808 — E1251, Grupo A de ponta a ponta (ESPEC-E1251 v3; ORDEM-DUET 1311): os dois avisos críticos que deixavam de
  ter sentido sem nenhuma ação no sino.
  A. Uma proposta enviada, com os avisos dela para as DUAS partes e dos DOIS eventos ("proposta recebida" e "proposta a
     vencer"), com a referência da proposta.
      1. enquanto a proposta vale, os avisos estão na faixa do painel e na página completa (filtro "Críticos") — dono e
         morador;
      2. a proposta passa da validade (simulação declarada: o laboratório recua o valida_ate; o tempo não passa num
         teste) e o dono abre a lista de propostas — a ação real que a dá por vencida (expirarVencidas). A proposta fica
         "expirada" e os quatro avisos ficam gravados resolvidos no banco;
      3. dono e morador: a faixa já não aparece e a página completa não mostra nenhum dos quatro (nem em "Críticos",
         nem em "Todos").
  B. Um pedido de visita de outro dono, com o aviso crítico "Pedido de visita" dele, com a referência da visita.
      4. enquanto a visita espera, o aviso está na faixa e na página completa do dono;
      5. o morador cancela o pedido pela tela de visitas (a ação real; o dono não responde);
      6. o dono abre o painel: a faixa já não aparece, o aviso fica GRAVADO resolvido no banco (antes do E1251 só se
         escondia em cada leitura) e a página completa não o mostra.
  C. (ORDEM-DUET 1313) A outra porta de saída: um pedido de visita presencial de um 3.º dono, com o aviso dele, com a
     referência. É a guarda do que já existia (E444): a resposta do dono já resolvia o aviso antes do E1251.
      7. enquanto a visita espera, o aviso está na faixa e na página completa desse dono;
      8. o dono confirma o horário pela tela de visitas (a ação real);
      9. o dono abre o painel: a faixa já não aparece, o aviso fica gravado resolvido e a página completa não o mostra.
  Simulação declarada: contas, proposta, visita e avisos gravados pelo laboratório; o recuo da validade é a única
  mudança direta no banco depois da semeadura. A leitura é a das telas, com a sessão de cada um. Laboratório; não é
  prova ao vivo no site.
*/
const senha = novaSenha();
const sufixo = novoSufixo();
const dono = { email: `dono.t1808.${sufixo}@lab.vivanomads.test`, nome: "Lia Prazo Ventura", role: "owner" as const };
const dono2 = { email: `dono2.t1808.${sufixo}@lab.vivanomads.test`, nome: "Caio Portão Ventura", role: "owner" as const };
const dono3 = { email: `dono3.t1808.${sufixo}@lab.vivanomads.test`, nome: "Rosa Resposta Ventura", role: "owner" as const };
const inq = { email: `inq.t1808.${sufixo}@lab.vivanomads.test`, nome: "Nina Prazo Souto", role: "tenant" as const };
const ids: Record<string, string | undefined> = {};
const horas = (h: number) => new Date(Date.now() - h * 3600_000).toISOString();
const imovelVisita = `Studio visita t1808 ${sufixo}`;
const T = {
  donoRecebida: `Proposta recebida · t1808 dono ${sufixo}`,
  donoVencendo: `A proposta vence em breve · t1808 dono ${sufixo}`,
  inqRecebida: `Proposta recebida · t1808 morador ${sufixo}`,
  inqVencendo: `A proposta vence em breve · t1808 morador ${sufixo}`,
  visita: `Pedido de visita · t1808 ${sufixo}`,
  visitaDono: `Pedido de visita · t1808 resposta ${sufixo}`,
};

async function abrir(browser: Browser, email: string): Promise<Page> {
  return entrar(browser, email, senha);
}

async function paginaCriticos(p: Page) {
  await p.goto("/dashboard/notificacoes?prioridade=critico#avisos", { waitUntil: "domcontentloaded" });
  await expect(p.getByTestId("avisos-caixa")).toBeVisible({ timeout: 30_000 });
  await expect(p.getByTestId("avisos-filtro-critico")).toHaveAttribute("aria-pressed", "true");
}

async function faixaMostra(p: Page, maisRecente: string) {
  await p.goto("/dashboard", { waitUntil: "domcontentloaded" });
  await expect(p.getByTestId("faixa-critico"), `a faixa mostra "${maisRecente}"`).toContainText(maisRecente, { timeout: 30_000 });
}

async function faixaNaoAparece(p: Page) {
  const leu = p.waitForResponse((r) => r.url().includes("/api/painel/avisos") && r.ok(), { timeout: 30_000 });
  await p.goto("/dashboard", { waitUntil: "domcontentloaded" });
  await leu;
  await p.waitForLoadState("networkidle", { timeout: 10_000 }).catch(() => {});
  await expect(p.getByTestId("faixa-critico"), "sem crítico vivo, a faixa não aparece").toHaveCount(0);
  await expect(p.getByTestId("faixa-critico-mais"), "nem a contagem de críticos").toHaveCount(0);
}

async function paginaMostra(p: Page, titulos: string[]) {
  await paginaCriticos(p);
  for (const t of titulos) await expect(p.getByTestId("avisos-item").filter({ hasText: t }), `"${t}" está em "Críticos"`).toHaveCount(1, { timeout: 30_000 });
}

/** O aviso resolvido não aparece — nem em "Críticos", nem em "Todos". */
async function paginaNaoMostra(p: Page, titulos: string[]) {
  await paginaCriticos(p);
  for (const t of titulos) await expect(p.getByTestId("avisos-item").filter({ hasText: t }), `"${t}" não aparece em "Críticos"`).toHaveCount(0);
  await p.getByTestId("avisos-filtro-todos").click();
  await expect(p.getByTestId("avisos-filtro-todos")).toHaveAttribute("aria-pressed", "true");
  for (const t of titulos) await expect(p.getByTestId("avisos-item").filter({ hasText: t }), `"${t}" não aparece em "Todos"`).toHaveCount(0);
}

async function resolvidoEm(id: string): Promise<string | null> {
  const { data, error } = await adm().from("avisos").select("resolvido_em").eq("id", id).single();
  if (error) throw error;
  return (data.resolvido_em as string | null) ?? null;
}

test.describe("T1808 — E1251: a proposta que vence e a visita que deixa de esperar saem da faixa e da página @E1251", () => {
  test.skip(!NO_LABORATORIO, "Só no laboratório.");
  test.describe.configure({ mode: "serial", timeout: 120_000 });

  test.beforeAll(async () => {
    ids.dono = await criarConta(dono, senha);
    ids.dono2 = await criarConta(dono2, senha);
    ids.dono3 = await criarConta(dono3, senha);
    ids.inq = await criarConta(inq, senha);
    ids.imovel = await criarImovelPronto(ids.dono, `Studio proposta t1808 ${sufixo}`, { ativo: true, preco: 3200 });
    ids.imovel2 = await criarImovelPronto(ids.dono2, imovelVisita, { ativo: true, preco: 3200 });
    ids.lead = await criarLead(ids.dono, ids.inq, ids.imovel, true);

    const { data: numero } = await adm().rpc("next_document_number", { p_type: "orcamento", p_year: new Date().getFullYear() });
    const agora = new Date().toISOString();
    const { data: prop, error: ep } = await adm()
      .from("propostas")
      .insert({ numero, lead_id: ids.lead, property_id: ids.imovel, owner_id: ids.dono, tenant_id: ids.inq, status: "enviada", versao_atual: 1, validade_dias: 7, valida_ate: new Date(Date.now() + 7 * 86_400_000).toISOString(), criada_em: agora, atualizada_em: agora })
      .select("id")
      .single();
    if (ep) throw ep;
    ids.proposta = prop.id as string;
    const { error: ev } = await adm().from("proposta_versoes").insert({ proposta_id: ids.proposta, versao: 1, autor: "owner", valor_base: 3200, valor_mensal: 3200, meses: 2, data_entrada: new Date(Date.now() + 10 * 86_400_000).toISOString().slice(0, 10), total_mensal: 3200, total_contrato: 6400, mensagem: "Proposta da t1808." });
    if (ev) throw ev;

    const { data: vis, error: evi } = await adm()
      .from("visitas_video")
      .insert({ property_id: ids.imovel2, owner_id: ids.dono2, tenant_id: ids.inq, horarios: [new Date(Date.now() + 3 * 86_400_000).toISOString()], modalidade: "video" })
      .select("id")
      .single();
    if (evi) throw evi;
    ids.visita = vis.id as string;
    ids.imovel3 = await criarImovelPronto(ids.dono3, `Studio resposta t1808 ${sufixo}`, { ativo: true, preco: 3200 });
    const { data: vis3, error: evi3 } = await adm()
      .from("visitas_video")
      .insert({ property_id: ids.imovel3, owner_id: ids.dono3, tenant_id: ids.inq, horarios: [new Date(Date.now() + 4 * 86_400_000).toISOString()], modalidade: "presencial" })
      .select("id")
      .single();
    if (evi3) throw evi3;
    ids.visitaDono = vis3.id as string;

    const urlProposta = `/dashboard/propostas/${ids.proposta}`;
    const linhas: ({ chave: string } & Record<string, unknown>)[] = [
      // O "a vencer" é o mais recente de cada parte: é ele que a faixa mostra primeiro.
      { chave: "donoRecebida", usuario_id: ids.dono, evento: "proposta_recebida", titulo: T.donoRecebida, ref_id: ids.proposta, url: urlProposta, criado_em: horas(3) },
      { chave: "donoVencendo", usuario_id: ids.dono, evento: "proposta_vencendo", titulo: T.donoVencendo, ref_id: ids.proposta, url: urlProposta, criado_em: horas(1) },
      { chave: "inqRecebida", usuario_id: ids.inq, evento: "proposta_recebida", titulo: T.inqRecebida, ref_id: ids.proposta, url: urlProposta, criado_em: horas(3) },
      { chave: "inqVencendo", usuario_id: ids.inq, evento: "proposta_vencendo", titulo: T.inqVencendo, ref_id: ids.proposta, url: urlProposta, criado_em: horas(1) },
      { chave: "avisoVisita", usuario_id: ids.dono2, evento: "visita_pedida", titulo: T.visita, ref_id: ids.visita, url: "/dashboard/visitas?de=dono", criado_em: horas(1) },
      { chave: "avisoVisitaDono", usuario_id: ids.dono3, evento: "visita_pedida", titulo: T.visitaDono, ref_id: ids.visitaDono, url: "/dashboard/visitas?de=dono", criado_em: horas(1) },
    ];
    for (const { chave, ...l } of linhas) {
      const { data, error } = await adm().from("avisos").insert({ prioridade: "critico", resolvido_em: null, ...l }).select("id").single();
      if (error) throw error;
      ids[chave] = data.id as string;
    }
  });
  test.afterAll(async () => {
    await adm().from("avisos").delete().in("usuario_id", [ids.dono!, ids.inq!, ids.dono2!, ids.dono3!].filter(Boolean));
    const visitas = [ids.visita, ids.visitaDono].filter((x): x is string => !!x);
    if (visitas.length) await adm().from("visitas_video").delete().in("id", visitas);
    if (ids.proposta) {
      await adm().from("proposta_versoes").delete().eq("proposta_id", ids.proposta);
      await adm().from("propostas").delete().eq("id", ids.proposta);
    }
    if (ids.lead) await adm().from("leads").delete().eq("id", ids.lead);
    await apagarContas([ids.inq, ids.dono, ids.dono2, ids.dono3]);
  });

  test("1. enquanto a proposta vale: os avisos dela estão na faixa e na página completa — dono e morador", async ({ browser }) => {
    for (const [conta, recebida, vencendo] of [[dono, T.donoRecebida, T.donoVencendo], [inq, T.inqRecebida, T.inqVencendo]] as const) {
      const p = await abrir(browser, conta.email);
      await faixaMostra(p, vencendo);
      await expect(p.getByTestId("faixa-critico-mais"), "o segundo crítico da proposta conta na faixa").toHaveCount(1);
      await paginaMostra(p, [recebida, vencendo]);
      await p.context().close();
    }
  });

  test("2. a proposta passa da validade e o dono abre a lista: fica expirada e os quatro avisos ficam gravados resolvidos", async ({ browser }) => {
    const { error } = await adm().from("propostas").update({ valida_ate: horas(1) }).eq("id", ids.proposta!);
    if (error) throw error;
    const p = await abrir(browser, dono.email);
    await p.goto("/dashboard/propostas", { waitUntil: "domcontentloaded" });
    await expect
      .poll(async () => (await adm().from("propostas").select("status").eq("id", ids.proposta!).single()).data?.status, { message: "a proposta fica expirada", timeout: 30_000 })
      .toBe("expirada");
    for (const chave of ["donoRecebida", "donoVencendo", "inqRecebida", "inqVencendo"]) {
      await expect.poll(() => resolvidoEm(ids[chave]!), { message: `o aviso ${chave} fica gravado resolvido`, timeout: 30_000 }).not.toBeNull();
    }
    await p.context().close();
  });

  test("3. depois da expiração: a faixa não aparece e a página não mostra nenhum dos quatro — dono e morador", async ({ browser }) => {
    for (const [conta, titulos] of [[dono, [T.donoRecebida, T.donoVencendo]], [inq, [T.inqRecebida, T.inqVencendo]]] as const) {
      const p = await abrir(browser, conta.email);
      await faixaNaoAparece(p);
      await paginaNaoMostra(p, [...titulos]);
      await p.context().close();
    }
  });

  test("4. enquanto a visita espera: o pedido de visita está na faixa e na página completa do dono", async ({ browser }) => {
    const p = await abrir(browser, dono2.email);
    await faixaMostra(p, T.visita);
    await paginaMostra(p, [T.visita]);
    await p.context().close();
    expect(await resolvidoEm(ids.avisoVisita!), "o pedido de visita ainda não está resolvido").toBeNull();
  });

  test("5. o morador cancela o pedido pela tela de visitas (o dono não responde)", async ({ browser }) => {
    const p = await abrir(browser, inq.email);
    await p.goto("/dashboard/visitas", { waitUntil: "domcontentloaded" });
    const cartao = p.getByTestId("cartao-visita").filter({ hasText: imovelVisita });
    await expect(cartao.getByTestId("visita-cancelar-morador")).toBeVisible({ timeout: 30_000 });
    await cartao.getByTestId("visita-cancelar-morador").click();
    await cartao.getByTestId("visita-cancelar-confirmar").click();
    await expect
      .poll(async () => (await adm().from("visitas_video").select("status").eq("id", ids.visita!).single()).data?.status, { message: "a visita fica cancelada", timeout: 30_000 })
      .toBe("cancelado");
    await p.context().close();
  });

  test("6. o dono abre o painel: a faixa não aparece, o aviso fica GRAVADO resolvido e a página não o mostra", async ({ browser }) => {
    const p = await abrir(browser, dono2.email);
    await faixaNaoAparece(p);
    await expect.poll(() => resolvidoEm(ids.avisoVisita!), { message: "o pedido de visita fica gravado resolvido", timeout: 30_000 }).not.toBeNull();
    await paginaNaoMostra(p, [T.visita]);
    await p.context().close();
  });

  test("7. enquanto a visita espera: o pedido de visita está na faixa e na página completa do 3.º dono", async ({ browser }) => {
    const p = await abrir(browser, dono3.email);
    await faixaMostra(p, T.visitaDono);
    await paginaMostra(p, [T.visitaDono]);
    await p.context().close();
    expect(await resolvidoEm(ids.avisoVisitaDono!), "o pedido de visita ainda não está resolvido").toBeNull();
  });

  test("8. o dono confirma o horário pela tela de visitas", async ({ browser }) => {
    const p = await abrir(browser, dono3.email);
    await p.goto("/dashboard/visitas?de=dono", { waitUntil: "domcontentloaded" });
    const cartao = p.locator(`#visita-${ids.visitaDono}`);
    await expect(cartao.getByTestId("visita-confirmar")).toBeVisible({ timeout: 30_000 });
    await cartao.getByTestId("visita-confirmar").click();
    await expect
      .poll(async () => (await adm().from("visitas_video").select("status").eq("id", ids.visitaDono!).single()).data?.status, { message: "a visita fica confirmada", timeout: 30_000 })
      .toBe("confirmado");
    await p.context().close();
  });

  test("9. o dono abre o painel: a faixa não aparece, o aviso fica gravado resolvido e a página não o mostra", async ({ browser }) => {
    await expect.poll(() => resolvidoEm(ids.avisoVisitaDono!), { message: "a resposta do dono grava o aviso resolvido", timeout: 30_000 }).not.toBeNull();
    const p = await abrir(browser, dono3.email);
    await faixaNaoAparece(p);
    await paginaNaoMostra(p, [T.visitaDono]);
    await p.context().close();
  });
});
