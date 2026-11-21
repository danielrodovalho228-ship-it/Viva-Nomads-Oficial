import { test, expect, type Browser, type Page } from "@playwright/test";
import { NO_LABORATORIO, adm, apagarContas, criarConta, criarImovelPronto, entrar, lerSaida, novaSenha, novoSufixo, cnpjAleatorio } from "../fixtures/laboratorio";
import { ITENS_CHECKLIST } from "../../../src/config/checklist-avaliacao";

/*
  T2214 — E1077 (ORDEM-DUET-370): o fluxo do avaliador EM TESTE corre dentro de um âmbito fechado, com a chave
  VISTORIA_ATIVA desligada como em produção. Só no laboratório. TRAVA EM RASCUNHO: escrita sem laboratório; as corridas
  ficam para a ordem do Gerente.

  Por isso esta spec NÃO liga o cookie de laboratório `vn_lab_vistoria` (o atalho que t305/t341 usam): o âmbito tem de
  funcionar sem a chave, que é o que a prova ao vivo vai cobrar. Hoje, sem a chave, o dono de teste só vê o bloco em
  modo "só para conferência" e as ações não correm: a spec nasce vermelha no passo 3 por isso.

  As pessoas (contas de laboratório que fazem o papel das reais):
    - R e E: o Rogério e a esposa — as DUAS únicas contas de avaliador do âmbito (credenciamento "em_teste");
    - X: outro avaliador em teste, na mesma cidade, FORA do âmbito;
    - P: o dono dentro do âmbito; F: um dono fora do âmbito (conta fora do piloto).
  O passo a passo que a prova ao vivo vai cobrar:
    1. cadastro de avaliador em âmbito de teste: R e E leem "Em teste" no seu credenciamento;
    2. a conta fora do piloto não vê nada: nem o dono F (bloco da avaliação), nem o avaliador X (pedidos);
    3. o dono P pede a avaliação e escolhe dentro do âmbito: a lista traz R e E, e não X;
    4. aceite: R aceita com valor e prazo e o dono aceita a proposta;
    5. visita: R agenda; a visita acontece;
    6. laudo com nível: R conclui e envia; o dono lê o laudo com o nível sustentado.
  E as quatro condições do Daniel (via coordenador), cobradas em cada passo onde se vêem:
    a. só as contas do Rogério e da esposa — X nunca aparece ao dono nem recebe nada;
    b. nenhum convite sai da plataforma sem o Daniel — nada vai para X nem para F, e nenhuma mensagem é um convite;
    c. nenhum telefone nem e-mail do Rogério em página pública;
    d. nada diz "credenciados com o CNPJ da Viva" enquanto o CNPJ não existir.

  PONTO DE LIGAÇÃO — `colocarNoAmbito`: a marca do âmbito é a do E1077 (#4091): a conta entra em `vistoria_piloto`
  (migração 0350), e a porta `vistoriaAtiva()` abre só para a conta da sessão que lá está. As contas do piloto são também
  "dado de teste" (`profiles.is_teste`, ORDEM-DUET-371 ponto 3): o pedido do dono nasce `teste=true`, e num pedido de
  teste o avaliador "em_teste" é elegível (regras.ts, `impedimento`). Sem o #4091 a tabela não existe e o beforeAll
  falha ao gravar: na main a trava é vermelha por estrutura, não por comportamento (declarado no PR). X fica de fora de
  propósito: é "em_teste" na mesma cidade, e só o âmbito o tira da lista do dono.

  Simulações declaradas (gravadas pelo laboratório, como na t305): os credenciamentos "em_teste" (o credenciamento
  completo espera o CNPJ da Viva), a tabela de preços da cidade, as coordenadas do imóvel, a hora da visita já passada
  e o checklist preenchido. Tudo o resto é pela tela.
*/
const senha = novaSenha();
const sufixo = novoSufixo();
const CIDADE = `Uberlândia t2214 ${sufixo}`;
const conta = (p: string, nome: string, role: "owner" | "tenant" = "tenant") => ({ email: `${p}.t2214.${sufixo}@lab.vivanomads.test`, nome, role });
const avR = conta("avr", "Rogério Âmbito");
const avE = conta("ave", "Esposa Âmbito");
const avX = conta("avx", "Xavier Fora");
const donoP = conta("donop", "Paula Piloto", "owner");
const donoF = conta("donof", "Fábio Fora", "owner");
const ids: Record<string, string> = {};
const cred: Record<"R" | "E" | "X", { id: string; numero: string }> = { R: { id: "", numero: "" }, E: { id: "", numero: "" }, X: { id: "", numero: "" } };
const IMOVEL = { lat: -18.9186, lng: -48.2772 };
const PERTO = { latitude: -18.9178, longitude: -48.2772 }; // ~90 m
const SILENCIO = { via_intensa: false, noturno_obra_100m: false, aviao_ferrovia: false, isolamento_acustico: false };
/** Sem telefone nem e-mail em página pública (condição c). */
const CONTATO = /tel:|mailto:|wa\.me|api\.whatsapp|@lab\.vivanomads\.test/i;
/** Condição d: nada se apresenta como credenciado com o CNPJ da Viva. */
const CNPJ_DA_VIVA = /CNPJ da Viva/i;

/** PONTO DE LIGAÇÃO do E1077 (#4091): as contas entram no piloto (vistoria_piloto) e ficam como dado de teste. */
async function colocarNoAmbito(userIds: string[]) {
  // ENSAIO (nunca mergear): na main sem o #4091 a tabela não existe; segue sem ela para o vermelho ser de comportamento.
  const { error } = await adm().from("vistoria_piloto").upsert(userIds.map((user_id) => ({ user_id, nota: "laboratório t2214" })), { onConflict: "user_id" });
  if (error) console.log(`ensaio t2214: vistoria_piloto indisponível (${error.code ?? ""} ${error.message})`);
  const { error: e2 } = await adm().from("profiles").update({ is_teste: true }).in("id", userIds);
  if (e2) throw e2;
}

async function abrir(browser: Browser, email: string, geo = false): Promise<Page> {
  const p = await entrar(browser, email, senha);
  await p.setViewportSize({ width: 1280, height: 900 });
  if (geo) {
    await p.context().grantPermissions(["geolocation"]);
    await p.context().setGeolocation(PERTO);
  }
  return p;
}
const statusDo = async (pedidoId: string) => (await adm().from("vistoria_pedidos").select("status").eq("id", pedidoId).single()).data?.status as string | undefined;
const pedidoDe = async (propertyId: string) =>
  (await adm().from("vistoria_pedidos").select("id, teste, status").eq("property_id", propertyId).order("criado_em", { ascending: false }).limit(1).maybeSingle()).data as { id: string; teste: boolean; status: string } | null;

/** O checklist todo conforme (limpeza "pronto") e as 4 perguntas de ruído — o mesmo preenchimento da t305. */
async function preencher(pedidoId: string) {
  const linhas = ITENS_CHECKLIST.map((i) => ({ pedido_id: pedidoId, chave: i.chave, valor: "tipo" in i && i.tipo === "limpeza" ? "pronto" : "conforme", observacao: null }));
  const { error } = await adm().from("vistoria_checklist").upsert(linhas, { onConflict: "pedido_id,chave" });
  if (error) throw error;
  await adm().from("vistoria_pedidos").update({ ruido_respostas: SILENCIO }).eq("id", pedidoId);
}

test.describe("T2214 — E1077: o fluxo do avaliador em teste corre só dentro do âmbito, sem a chave da vistoria @E1077", () => {
  test.skip(!NO_LABORATORIO, "Só no laboratório.");
  test.describe.configure({ timeout: 420_000 });
  test.use({ actionTimeout: 15_000, navigationTimeout: 30_000 });

  test.beforeAll(async () => {
    for (const [k, c] of [["R", avR], ["E", avE], ["X", avX], ["donoP", donoP], ["donoF", donoF]] as const) ids[k] = await criarConta(c, senha);
    await colocarNoAmbito([ids.R, ids.E, ids.donoP]);
    for (const l of ["R", "E", "X"] as const) {
      const nome = { R: avR.nome, E: avE.nome, X: avX.nome }[l];
      const { data: parc, error } = await adm()
        .from("parceiros")
        .insert({ user_id: ids[l], tipo_pessoa: "pj", documento: cnpjAleatorio(), nome_publico: nome, slug: `aval-${l.toLowerCase()}-t2214-${sufixo}`, categorias: ["fotografia"], cidades: [CIDADE] })
        .select("id")
        .single();
      if (error) throw error;
      const { data: n } = await adm().rpc("proximo_numero_avaliador", { p_sigla: "UDI" });
      const { data: c, error: eC } = await adm()
        .from("avaliadores_credenciamento")
        .insert({ parceiro_id: parc.id, cidade: CIDADE, numero_credenciado: n, status: "em_teste", experiencia_link: "https://portfolio.lab.vivanomads.test", conduta_versao: "2026-10-23" })
        .select("id, numero_credenciado")
        .single();
      if (eC) throw eC;
      cred[l] = { id: c.id as string, numero: c.numero_credenciado as string };
    }
    await adm().from("vistoria_precos").delete().eq("cidade", CIDADE);
    await adm().from("vistoria_precos").insert([
      { cidade: CIDADE, porte: "estudio", valor: 280 },
      { cidade: CIDADE, porte: "q1_2", valor: 350 },
      { cidade: CIDADE, porte: "q3_mais", valor: 420 },
    ]);
    ids.imP = await criarImovelPronto(ids.donoP, `Avaliação no âmbito t2214 ${sufixo}`, { ativo: true });
    ids.imF = await criarImovelPronto(ids.donoF, `Fora do âmbito t2214 ${sufixo}`, { ativo: true });
    await adm().from("properties").update({ lat: IMOVEL.lat, lng: IMOVEL.lng, lat_exata: IMOVEL.lat, lng_exata: IMOVEL.lng, city: CIDADE }).in("id", [ids.imP, ids.imF]);
  });

  test.afterAll(async () => {
    const imoveis = [ids.imP, ids.imF].filter(Boolean);
    const { data: peds } = await adm().from("vistoria_pedidos").select("id").in("property_id", imoveis);
    const pedidos = (peds ?? []).map((p) => p.id as string);
    if (pedidos.length) {
      await adm().from("vistoria_laudos").delete().in("pedido_id", pedidos);
      await adm().from("vistoria_checklist").delete().in("pedido_id", pedidos);
      await adm().from("vistoria_designacoes").delete().in("pedido_id", pedidos);
      await adm().from("vistoria_pedidos").delete().in("id", pedidos);
    }
    const creds = Object.values(cred).map((c) => c.id).filter(Boolean);
    if (creds.length) await adm().from("avaliadores_credenciamento").delete().in("id", creds);
    await adm().from("vistoria_precos").delete().eq("cidade", CIDADE);
    await adm().from("vistoria_piloto").delete().in("user_id", ["R", "E", "donoP"].map((k) => ids[k]).filter(Boolean)).then(() => {}, () => {});
    await apagarContas(["R", "E", "X", "donoP", "donoF"].map((k) => ids[k]).filter(Boolean));
  });

  test("cadastro em teste, fora do piloto sem nada, escolha no âmbito, aceite, visita e laudo com nível", async ({ browser }) => {
    let pedidoId = "";

    await test.step("1. cadastro de avaliador em âmbito de teste: o Rogério e a esposa leem \"Em teste\"", async () => {
      for (const c of [avR, avE]) {
        const p = await abrir(browser, c.email);
        await p.goto("/dashboard/parceiro/avaliacao", { waitUntil: "domcontentloaded" });
        await expect(p.getByTestId("credenciamento-situacao"), `${c.nome}: o credenciamento está em teste`).toHaveAttribute("data-status", "em_teste", { timeout: 30_000 });
        expect.soft(await p.getByTestId("credenciamento-estado").innerText(), `${c.nome}: a tela diz "Em teste"`).toMatch(/Em teste/i);
        expect.soft(await p.locator("main").innerText(), `${c.nome}: (d) nada fala em CNPJ da Viva`).not.toMatch(CNPJ_DA_VIVA);
        await p.context().close();
      }
    });

    await test.step("2. a conta fora do piloto não vê nada: o dono F sem bloco de avaliação, o avaliador X sem pedidos", async () => {
      const f = await abrir(browser, donoF.email);
      await f.goto(`/dashboard/imoveis/${ids.imF}/nivel`, { waitUntil: "domcontentloaded" });
      await expect(f.getByTestId("nivel-resumo"), "a página do nível do dono F abriu").toBeVisible({ timeout: 30_000 });
      expect.soft(await f.getByTestId("avaliacao-dono").count(), "E1077: o dono fora do âmbito não vê o bloco da avaliação").toBe(0);
      expect.soft(await f.getByTestId("avaliacao-modo-teste").count(), "E1077: nem o aviso de conta de teste").toBe(0);
      await f.context().close();
    });

    await test.step("3. o dono no âmbito pede a avaliação e escolhe dentro do âmbito: R e E na lista, X não", async () => {
      const d = await abrir(browser, donoP.email);
      await d.goto(`/dashboard/imoveis/${ids.imP}/nivel`, { waitUntil: "domcontentloaded" });
      const bloco = d.getByTestId("avaliacao-dono");
      await expect(bloco, "o dono no âmbito vê o bloco da avaliação").toBeVisible({ timeout: 30_000 });
      // Sem a chave, hoje o dono de teste só vê o bloco "só para conferência" e as ações não correm: é a razão do vermelho.
      expect(await bloco.getByTestId("avaliacao-modo-teste").count(), "E1077: no âmbito, o bloco não fica só para conferência").toBe(0);
      await bloco.getByTestId("pedir-avaliacao").getByRole("button", { name: /Pedir avaliação do imóvel/ }).click();
      await expect.poll(async () => (await pedidoDe(ids.imP))?.status, { timeout: 20_000, message: "E1077: o pedido abre sem a chave" }).toBe("pedido");
      const pedido = (await pedidoDe(ids.imP))!;
      pedidoId = pedido.id;
      expect.soft(pedido.teste, "o pedido do âmbito é de teste (não entra nas contas públicas)").toBe(true);

      await d.goto(`/dashboard/imoveis/${ids.imP}/nivel`, { waitUntil: "domcontentloaded" });
      const sugeridos = bloco.getByTestId("avaliacao-sugerido");
      await expect(sugeridos.first()).toBeVisible({ timeout: 30_000 });
      const lista = await sugeridos.allInnerTexts();
      for (const l of ["R", "E"] as const) expect.soft(lista.some((t) => t.includes(`nº ${cred[l].numero}`)), `E1077: o avaliador ${l} do âmbito está na lista`).toBe(true);
      expect(lista.some((t) => t.includes(`nº ${cred.X.numero}`)), "E1077 (a): o avaliador fora do âmbito NÃO aparece ao dono").toBe(false);
      expect(lista.length, "E1077 (a): só as duas contas do âmbito").toBe(2);
      expect.soft((await bloco.innerText()).match(CNPJ_DA_VIVA), "(d) o bloco do dono não fala em CNPJ da Viva").toBeNull();

      await sugeridos.filter({ hasText: `nº ${cred.R.numero}` }).getByRole("button", { name: "Escolher este avaliador" }).click();
      await d.goto(`/dashboard/imoveis/${ids.imP}/nivel`, { waitUntil: "domcontentloaded" });
      await expect(bloco.getByTestId("avaliador-designado")).toHaveText(`Avaliador escolhido por você: nº ${cred.R.numero}`, { timeout: 30_000 });
      await d.context().close();
    });

    await test.step("4. aceite: o Rogério aceita com valor e prazo; o dono aceita a proposta", async () => {
      const r = await abrir(browser, avR.email);
      await r.goto("/dashboard/parceiro/avaliacao", { waitUntil: "domcontentloaded" });
      const item = r.locator(`[data-testid="avaliacao-designada"][data-pedido="${pedidoId}"]`);
      await expect(item, "o pedido chega ao Rogério").toBeVisible({ timeout: 30_000 });
      await item.getByTestId("proposta-valor").fill("350");
      await item.getByTestId("proposta-prazo").fill("2");
      await item.getByTestId("designacao-aceitar").click();
      await expect
        .poll(async () => ((await adm().from("vistoria_pedidos").select("proposta_em").eq("id", pedidoId).single()).data?.proposta_em as string | null) ?? null, { timeout: 20_000 })
        .not.toBeNull();
      await r.context().close();

      const x = await abrir(browser, avX.email);
      await x.goto("/dashboard/parceiro/avaliacao", { waitUntil: "domcontentloaded" });
      await expect(x.getByTestId("credenciamento-situacao")).toBeVisible({ timeout: 30_000 });
      expect.soft(await x.locator(`[data-testid="avaliacao-designada"][data-pedido="${pedidoId}"]`).count(), "E1077 (a): o pedido não chega ao avaliador fora do âmbito").toBe(0);
      await x.context().close();

      const d = await abrir(browser, donoP.email);
      await d.goto(`/dashboard/imoveis/${ids.imP}/nivel#avaliacao`, { waitUntil: "domcontentloaded" });
      await d.getByTestId("aceitar-proposta").getByRole("button", { name: "Aceitar valor e prazo" }).click();
      await expect
        .poll(async () => ((await adm().from("vistoria_pedidos").select("proposta_aceita_em").eq("id", pedidoId).single()).data?.proposta_aceita_em as string | null) ?? null, { timeout: 20_000 })
        .not.toBeNull();
      await d.context().close();
    });

    await test.step("5. visita: o Rogério agenda e a visita acontece", async () => {
      const r = await abrir(browser, avR.email);
      await r.goto("/dashboard/parceiro/avaliacao", { waitUntil: "domcontentloaded" });
      const agendar = r.getByTestId("avaliacoes-visitas").locator(`[data-pedido="${pedidoId}"]`).getByTestId("agendar-visita");
      await expect(agendar).toBeVisible({ timeout: 30_000 });
      const amanha = new Date(Date.now() - 3 * 3_600_000 + 86_400_000).toISOString().slice(0, 10);
      await agendar.getByRole("textbox", { name: "Data", exact: true }).fill(`${amanha}T10:00`);
      await agendar.getByRole("button", { name: "Agendar" }).click();
      await expect.poll(() => statusDo(pedidoId), { timeout: 20_000, message: "a visita fica agendada" }).toBe("agendado");
      await r.context().close();
      // Simulação declarada (como na t305): a hora da visita já passou e o checklist foi preenchido no imóvel.
      await adm().from("vistoria_pedidos").update({ agendado_para: new Date(Date.now() - 2 * 3_600_000).toISOString() }).eq("id", pedidoId);
      await preencher(pedidoId);
    });

    await test.step("6. laudo com nível: o Rogério conclui e envia; o dono lê o laudo com o nível sustentado", async () => {
      const r = await abrir(browser, avR.email, true);
      await r.goto(`/dashboard/parceiro/avaliacao/${pedidoId}`, { waitUntil: "domcontentloaded" });
      await r.getByTestId("concluir-visita").getByRole("button", { name: "Concluir a visita" }).click();
      await expect.poll(() => statusDo(pedidoId), { timeout: 20_000 }).toBe("realizada");
      await r.reload({ waitUntil: "domcontentloaded" });
      await r.getByTestId("assino-laudo").getByRole("checkbox").check();
      await r.getByTestId("enviar-laudo").getByRole("button", { name: "Enviar o laudo" }).click();
      await expect.poll(() => statusDo(pedidoId), { timeout: 30_000, message: "E1077: o laudo sai sem a chave" }).toBe("laudo_emitido");
      await r.context().close();

      const d = await abrir(browser, donoP.email);
      await d.goto(`/dashboard/imoveis/${ids.imP}/nivel`, { waitUntil: "domcontentloaded" });
      const res = d.getByTestId("laudo-dono-resultado");
      await expect(res, "o dono lê o laudo").toBeVisible({ timeout: 30_000 });
      await expect(res).toContainText(/nível sustentado:\s*\S+/);
      expect.soft((await d.locator("main").innerText()).match(CNPJ_DA_VIVA), "(d) o laudo na tela do dono não fala em CNPJ da Viva").toBeNull();
      await d.context().close();
    });

    await test.step("condições b, c e d: nada sai para fora do âmbito, nenhum contacto público, nenhum CNPJ da Viva", async () => {
      // (b) nada vai para X nem para F, e nenhuma mensagem é um convite.
      const saida = (await lerSaida()).map((m) => JSON.stringify(m));
      const fora = [avX.email, donoF.email];
      expect.soft(saida.filter((m) => fora.some((e) => m.includes(e))), "E1077 (b): nenhuma mensagem para contas fora do âmbito").toEqual([]);
      const doTeste = saida.filter((m) => [avR, avE, avX, donoP, donoF].some((c) => m.includes(c.email)));
      expect.soft(doTeste.filter((m) => /convite|convidad/i.test(m)), "E1077 (b): nenhum convite sai da plataforma").toEqual([]);

      // (c) e (d) nas páginas públicas: o perfil do Rogério e da esposa, e a página de recrutamento.
      const ctx = await browser.newContext({ viewport: { width: 1280, height: 900 } });
      const pub = await ctx.newPage();
      for (const l of ["R", "E"] as const) {
        const r = await pub.goto(`/avaliadores/${cred[l].numero}`, { waitUntil: "domcontentloaded" });
        if (r?.status() === 404) continue; // o perfil público é do E1075; sem ele publicado, nada a ler.
        const html = await pub.content();
        expect.soft(html.match(CONTATO), `E1077 (c): o perfil público ${l} não tem telefone nem e-mail`).toBeNull();
        expect.soft(html.includes((l === "R" ? avR : avE).email), `E1077 (c): o e-mail da conta ${l} não está no HTML`).toBe(false);
        expect.soft((await pub.locator("main").innerText()).match(CNPJ_DA_VIVA), `E1077 (d): o perfil ${l} não fala em CNPJ da Viva`).toBeNull();
      }
      await pub.goto("/parceiros/avaliadores", { waitUntil: "domcontentloaded" });
      expect.soft((await pub.locator("main").innerText()).match(CNPJ_DA_VIVA), "E1077 (d): a página dos avaliadores não fala em CNPJ da Viva").toBeNull();
      await ctx.close();
    });
  });
});
