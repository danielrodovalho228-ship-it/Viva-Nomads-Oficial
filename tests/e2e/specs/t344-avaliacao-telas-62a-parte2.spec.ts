import { test, expect, type Browser, type Page } from "@playwright/test";
import { authFile } from "../fixtures/auth";
import { NO_LABORATORIO, adm, apagarContas, cpfAleatorio, criarConta, criarImovelPronto, entrar, novaSenha, novoSufixo } from "../fixtures/laboratorio";
import { ITENS_CHECKLIST } from "../../../src/config/checklist-avaliacao";

/**
 * T344 — Prompt 62-A, Parte 2: as telas da avaliação sobre o 62-B2 (laboratório; a chave liga pelo cookie do teste).
 *   1. Execução (390 e 1280): aviso "sem pessoas", os 9 passos, item não conforme pede a foto, sem rede "Falta enviar 1
 *      foto" → a rede volta e a foto sobe; revisão do laudo com o prazo das 48 horas úteis e a delimitação; envio.
 *   2. Resultado do dono (390 e 1280): resumo por grupo, a foto do item não conforme, as ações de cada resultado
 *      (com ressalvas → correção e contestar; reprovado → nova avaliação) e "Avaliado em … nº X" quando aprovado.
 *   3. Ficha e cartão: "Avaliado em … por avaliador credenciado nº X", "Ver laudo" e "Premium · vistoriado" no cartão.
 *   4. 3º strike: o painel abre com os anúncios fora da busca.
 *   5. Admin: contestações, devoluções e laudos atrasados no topo "Para decidir" e na seção #contestacoes.
 * Datas e resultados simulados no banco do laboratório (como no t305).
 */
test.describe("T344 — telas da avaliação (62-A, Parte 2)", () => {
  test.skip(!NO_LABORATORIO, "Só no laboratório.");
  test.describe.configure({ mode: "serial" });
  test.use({ actionTimeout: 15_000, navigationTimeout: 30_000 });

  const senha = novaSenha();
  const sufixo = novoSufixo();
  const dono = { email: `dono.t344.${sufixo}@lab.vivanomads.test`, nome: "Lia Dona", role: "owner" as const };
  const avA = { email: `ava.t344.${sufixo}@lab.vivanomads.test`, nome: "Rui Avaliador", role: "tenant" as const };
  const BAIRRO = `Bairro T344 ${sufixo}`;
  const ids: Record<string, string> = {};
  const cred = { id: "", numero: "" };
  const PERTO = { latitude: -18.9178, longitude: -48.2772 };
  const SILENCIO = { via_intensa: false, noturno_obra_100m: false, aviao_ferrovia: false, isolamento_acustico: false };
  const PNG = Buffer.from("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==", "base64");
  const SAIDA = "tests/laboratorio/saida";
  const larguras = [390, 1280] as const;

  async function comChave(page: Page) {
    await page.context().addCookies([{ name: "vn_lab_vistoria", value: "1", url: new URL(page.url()).origin }]);
  }
  async function semRolagemLateral(page: Page) {
    expect(await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth)).toBeLessThanOrEqual(1);
  }
  async function pedidoAgendado(propertyId: string): Promise<string> {
    const { data, error } = await adm()
      .from("vistoria_pedidos")
      .insert({ property_id: propertyId, owner_id: ids.dono, cidade: "Uberlândia", porte: "q1_2", valor_tabela: 350, status: "agendado", avaliador_id: cred.id, designado_em: new Date().toISOString(), agendado_para: new Date(Date.now() - 2 * 3_600_000).toISOString() })
      .select("id")
      .single();
    if (error) throw error;
    await adm().from("vistoria_designacoes").insert({ pedido_id: data.id, avaliador_id: cred.id, resposta: "aceita", respondido_em: new Date().toISOString() });
    return data.id as string;
  }
  /** Tudo conforme (limpeza "pronto"), menos os itens pulados; ruído e internet já medidos. */
  async function preencher(pedidoId: string, pular: string[]) {
    const linhas = ITENS_CHECKLIST.filter((i) => !pular.includes(i.chave)).map((i) => ({ pedido_id: pedidoId, chave: i.chave, valor: "tipo" in i && i.tipo === "limpeza" ? "pronto" : "conforme", observacao: null }));
    const { error } = await adm().from("vistoria_checklist").upsert(linhas, { onConflict: "pedido_id,chave" });
    if (error) throw error;
    await adm().from("vistoria_pedidos").update({ ruido_respostas: SILENCIO }).eq("id", pedidoId);
    await adm().from("vistoria_medicoes").insert([
      { pedido_id: pedidoId, tipo: "internet", ponto: "quarto_principal", download_mbps: 328, upload_mbps: 42, latencia_ms: 12, distancia_m: 90 },
      { pedido_id: pedidoId, tipo: "internet", ponto: "trabalho", download_mbps: 328, upload_mbps: 42, latencia_ms: 12, distancia_m: 90 },
    ]);
  }
  async function avaliador(browser: Browser, w: number): Promise<Page> {
    const p = await entrar(browser, avA.email, senha);
    await p.setViewportSize({ width: w, height: w === 390 ? 844 : 900 });
    await comChave(p);
    await p.context().grantPermissions(["geolocation"]);
    await p.context().setGeolocation(PERTO);
    return p;
  }
  async function donoEm(browser: Browser, w: number): Promise<Page> {
    const d = await entrar(browser, dono.email, senha);
    await d.setViewportSize({ width: w, height: w === 390 ? 844 : 900 });
    await comChave(d);
    return d;
  }
  const laudoDe = async (pedido: string) =>
    (await adm().from("vistoria_laudos").select("id, numero, resultado, vistoriado_em, pedido_versao_id").eq("pedido_id", pedido).order("versao", { ascending: false }).limit(1).single()).data as { id: string; numero: string; resultado: string; vistoriado_em: string | null };

  test.beforeAll(async () => {
    ids.dono = await criarConta(dono, senha);
    ids.A = await criarConta(avA, senha);
    const { data: parc, error } = await adm()
      .from("parceiros")
      .insert({ user_id: ids.A, tipo_pessoa: "pf", documento: cpfAleatorio(), nome_publico: avA.nome, slug: `aval-t344-${sufixo}`, categorias: ["fotografia"], cidades: ["Uberlândia"] })
      .select("id")
      .single();
    if (error) throw error;
    const { data: n } = await adm().rpc("proximo_numero_avaliador", { p_sigla: "UDI" });
    const { data: c, error: eC } = await adm()
      .from("avaliadores_credenciamento")
      .insert({ parceiro_id: parc.id, cidade: "Uberlândia", numero_credenciado: n, status: "ativo", experiencia_link: "https://portfolio.lab.vivanomads.test", conduta_versao: "2026-10-23", ativado_em: "2026-01-01T00:00:00Z" })
      .select("id, numero_credenciado")
      .single();
    if (eC) throw eC;
    cred.id = c.id as string;
    cred.numero = c.numero_credenciado as string;
    await adm().from("vistoria_precos").delete().eq("cidade", "Uberlândia");
    await adm().from("vistoria_precos").insert([
      { cidade: "Uberlândia", porte: "estudio", valor: 280 },
      { cidade: "Uberlândia", porte: "q1_2", valor: 350 },
      { cidade: "Uberlândia", porte: "q3_mais", valor: 420 },
    ]);
    for (const w of larguras) {
      ids[`im${w}`] = await criarImovelPronto(ids.dono, `Avaliação t344 ${w} ${sufixo}`, { ativo: true, preco: 2600 });
      await adm().from("properties").update({ address: BAIRRO, lat: -18.9186, lng: -48.2772, lat_exata: -18.9186, lng_exata: -48.2772 }).eq("id", ids[`im${w}`]);
    }
  });

  test.afterAll(async () => {
    const todos = larguras.map((w) => ids[`im${w}`]).filter(Boolean);
    await adm().from("vistoria_devolucoes").delete().eq("owner_id", ids.dono);
    await adm().from("vistoria_bloqueios").delete().in("property_id", todos);
    await adm().from("vistoria_laudos").delete().in("property_id", todos);
    await adm().from("vistoria_pedidos").delete().in("property_id", todos);
    await adm().from("vistoria_precos").delete().eq("cidade", "Uberlândia");
    await adm().from("avaliadores_credenciamento").delete().eq("id", cred.id);
    await apagarContas([ids.A, ids.dono]);
  });

  for (const w of larguras) {
    test(`1. execução a ${w} px: passos, foto sem rede ("Falta enviar 1 foto"), revisão com prazo e delimitação`, async ({ browser }) => {
      test.setTimeout(240_000);
      const pedido = await pedidoAgendado(ids[`im${w}`]);
      ids[`p${w}`] = pedido;
      await preencher(pedido, ["iluminacao"]);
      const p = await avaliador(browser, w);
      await p.goto(`/dashboard/parceiro/avaliacao/${pedido}`, { waitUntil: "domcontentloaded" });
      await expect(p.getByTestId("aviso-sem-pessoas")).toHaveText("Sem pessoas e sem pertences nas fotos.");
      await expect(p.getByTestId("checklist-passos").locator("[data-testid^='passo-atalho-']")).toHaveCount(9);
      await expect(p.getByTestId("checklist-passo").first()).toContainText("Passo 1 de 9 ·");
      await expect(p.getByTestId("checklist-faltam")).toHaveAttribute("data-faltam", "1");
      // Item não conforme: a câmera aparece no próprio item.
      await expect(p.getByTestId("foto-item-iluminacao")).toHaveCount(0);
      await p.getByTestId("item-iluminacao-nao_conforme").click();
      await expect.poll(async () => (await adm().from("vistoria_checklist").select("valor").eq("pedido_id", pedido).eq("chave", "iluminacao").maybeSingle()).data?.valor, { timeout: 15_000 }).toBe("nao_conforme");
      await expect(p.getByTestId("foto-item-iluminacao")).toBeVisible();
      // Sem rede: a foto fica no aparelho com o aviso; quando a rede volta, sobe sozinha.
      await p.context().setOffline(true);
      await p.getByTestId("foto-item-iluminacao").locator('input[type="file"]').setInputFiles({ name: "item.png", mimeType: "image/png", buffer: PNG });
      await expect(p.getByTestId("checklist-fotos-faltam")).toContainText("Falta enviar 1 foto", { timeout: 15_000 });
      await semRolagemLateral(p);
      await p.screenshot({ path: `${SAIDA}/t344-execucao-sem-rede-${w}.png`, fullPage: true });
      await p.context().setOffline(false);
      await p.evaluate(() => window.dispatchEvent(new Event("online")));
      await expect(p.getByTestId("checklist-fotos-faltam")).toHaveCount(0, { timeout: 30_000 });
      await expect.poll(async () => ((await adm().from("vistoria_checklist_fotos").select("id").eq("pedido_id", pedido).eq("item_chave", "iluminacao")).data ?? []).length, { timeout: 20_000 }).toBe(1);
      // Concluir → revisar o laudo antes de emitir.
      await p.getByTestId("concluir-visita").getByRole("button", { name: "Concluir a visita" }).click();
      await expect.poll(async () => (await adm().from("vistoria_pedidos").select("status").eq("id", pedido).single()).data?.status, { timeout: 20_000 }).toBe("realizada");
      await p.reload({ waitUntil: "domcontentloaded" });
      const rev = p.getByTestId("laudo-revisao");
      await expect(rev).toHaveAttribute("data-resultado", "com_ressalvas");
      await expect(p.getByTestId("laudo-prazo")).toContainText("horário de Brasília (48 horas úteis da visita)");
      await expect(rev.getByTestId("laudo-revisao-grupo")).toHaveCount(9);
      await expect(p.getByTestId("laudo-revisao-nc")).toContainText("1 foto(s)");
      await expect(p.getByTestId("laudo-delimitacao")).toContainText("Retrato do estado do imóvel na data da avaliação");
      await semRolagemLateral(p);
      await p.screenshot({ path: `${SAIDA}/t344-revisao-laudo-${w}.png`, fullPage: true });
      await p.getByTestId("enviar-laudo").getByRole("button", { name: "Enviar o laudo" }).click();
      await expect.poll(async () => (await adm().from("vistoria_pedidos").select("status").eq("id", pedido).single()).data?.status, { timeout: 30_000 }).toBe("laudo_emitido");
      await p.context().close();
    });

    test(`2. resultado do dono a ${w} px: resumo, foto do não conforme e ações de cada resultado`, async ({ browser }) => {
      test.setTimeout(180_000);
      const pedido = ids[`p${w}`];
      const l = await laudoDe(pedido);
      expect(l.resultado).toBe("com_ressalvas");
      const d = await donoEm(browser, w);
      // Sempre carga nova (sem âncora): ir para a mesma URL com "#" só rolaria a página, sem ler o laudo de novo.
      const abrir = () => d.goto(`/dashboard/imoveis/${ids[`im${w}`]}/nivel?t=${Date.now()}`, { waitUntil: "domcontentloaded" });
      await abrir();
      await expect(d.getByTestId("laudo-dono-resultado")).toHaveAttribute("data-resultado", "com_ressalvas");
      await expect(d.getByTestId("laudo-resumo-grupo")).toHaveCount(9);
      await expect(d.getByTestId("laudo-resumo")).toContainText("não conforme");
      await expect(d.getByTestId("laudo-acoes")).toHaveAttribute("data-acoes", "enviar_correcao contestar");
      await expect(d.getByTestId("laudo-acoes").getByRole("link", { name: "Enviar correção" })).toBeVisible();
      await expect(d.getByTestId("laudo-ressalva-foto")).toBeVisible();
      await expect(d.getByTestId("laudo-ressalva-foto")).toHaveJSProperty("complete", true);
      await expect(d.getByTestId("avaliacao-dono")).not.toContainText(/50\s*%/);
      await semRolagemLateral(d);
      await d.screenshot({ path: `${SAIDA}/t344-dono-com-ressalvas-${w}.png`, fullPage: true });

      // Reprovado (simulado): a ação é a nova avaliação, e o link leva ao cartão do pedido.
      await adm().from("vistoria_laudos").update({ resultado: "reprovado", prazo_ressalva_ate: null }).eq("id", l.id);
      await abrir();
      await expect(d.getByTestId("laudo-acoes")).toHaveAttribute("data-acoes", "nova_avaliacao contestar");
      await d.getByTestId("laudo-acoes").getByRole("link", { name: "Pedir nova avaliação" }).click();
      await expect(d.getByTestId("rota-avaliacao")).toBeInViewport();
      await expect(d.getByTestId("pedir-avaliacao").getByRole("button", { name: "Pedir nova avaliação" })).toBeVisible();
      await expect(d.getByTestId("avaliacao-dono")).not.toContainText(/50\s*%|desconto|metade/);
      await d.screenshot({ path: `${SAIDA}/t344-dono-reprovado-${w}.png`, fullPage: true });

      // Aprovado (simulado): "Avaliado em … por avaliador credenciado nº X", sem ações.
      await adm().from("vistoria_laudos").update({ resultado: "aprovado", vistoriado_em: new Date().toISOString(), ressalvas: [], graves: [] }).eq("id", l.id);
      await abrir();
      await expect(d.getByTestId("laudo-avaliado-em")).toContainText(`por avaliador credenciado nº ${cred.numero}`);
      await expect(d.getByTestId("laudo-acoes")).toHaveCount(0);
      await d.context().close();
    });
  }

  test("3. ficha e cartão: 'Avaliado em … nº X', resumo, 'Ver laudo' e 'Premium · vistoriado' (390 e 1280)", async ({ browser }) => {
    test.setTimeout(180_000);
    const im = ids.im390;
    await adm().from("imovel_nivel").upsert({ property_id: im, nivel: "premium", nivel_vistoriado_em: new Date().toISOString() });
    for (const w of larguras) {
      const v = await (await browser.newContext({ viewport: { width: w, height: w === 390 ? 844 : 900 } })).newPage();
      await v.goto(`/imoveis/${im}`, { waitUntil: "domcontentloaded" });
      const ficha = v.getByTestId("avaliacao-ficha");
      await expect(ficha).toBeVisible({ timeout: 20_000 });
      await expect(v.getByTestId("avaliacao-ficha-linha")).toHaveText(new RegExp(`^Avaliado em \\d{2}/\\d{2}/\\d{4} por avaliador credenciado nº ${cred.numero}$`));
      await expect(ficha.getByRole("link", { name: "Ver laudo" })).toHaveAttribute("href", /^\/conferir\?codigo=/);
      await expect(v.getByTestId("avaliacao-ficha-delimitacao")).toBeVisible();
      await ficha.scrollIntoViewIfNeeded();
      await semRolagemLateral(v);
      await v.screenshot({ path: `${SAIDA}/t344-ficha-${w}.png` });
      // Cartão na busca: o nível vira "Premium · vistoriado" (a /buscar guarda cache de 60 s).
      await expect
        .poll(
          async () => {
            await v.goto(`/buscar?local=${encodeURIComponent(BAIRRO)}`, { waitUntil: "domcontentloaded" });
            return v.getByTestId("grade-resultados").getByText("Premium · vistoriado").count();
          },
          { timeout: 120_000, intervals: [5_000, 10_000, 20_000] },
        )
        .toBeGreaterThan(0);
      await semRolagemLateral(v);
      await v.screenshot({ path: `${SAIDA}/t344-cartao-${w}.png` });
      await v.context().close();
    }
  });

  test("4. 3º strike: o painel abre com os anúncios fora da busca (390 e 1280)", async ({ browser }) => {
    test.setTimeout(120_000);
    await adm().from("vistoria_bloqueios").insert({ property_id: ids.im1280, owner_id: ids.dono, motivo: "strike_3" });
    for (const w of larguras) {
      const d = await donoEm(browser, w);
      await d.goto("/dashboard", { waitUntil: "domcontentloaded" });
      const aviso = d.getByTestId("aviso-strike-painel");
      await expect(aviso).toBeVisible({ timeout: 20_000 });
      await expect(aviso.getByRole("heading")).toHaveText("Seus anúncios estão fora da busca");
      await expect(aviso.getByTestId("aviso-strike-imovel")).toHaveCount(1);
      await expect(aviso.getByTestId("aviso-strike-imovel")).toHaveAttribute("href", `/dashboard/imoveis/${ids.im1280}/nivel#rota-avaliacao`);
      await semRolagemLateral(d);
      await d.screenshot({ path: `${SAIDA}/t344-strike3-painel-${w}.png` });
      await d.context().close();
    }
    await adm().from("vistoria_bloqueios").delete().eq("property_id", ids.im1280).eq("motivo", "strike_3");
  });

  test("5. admin: contestações, devoluções e laudos atrasados no topo e em #contestacoes (390 e 1280)", async ({ browser }) => {
    test.setTimeout(120_000);
    const { data: cont, error } = await adm()
      .from("vistoria_pedidos")
      .insert({ property_id: ids.im1280, owner_id: ids.dono, cidade: "Uberlândia", porte: "q1_2", valor_tabela: 350, tipo: "contestacao", status: "pedido", origem_pedido_id: ids.p1280 })
      .select("id")
      .single();
    if (error) throw error;
    await adm().from("vistoria_devolucoes").insert({ pedido_contestacao_id: cont.id, pedido_original_id: ids.p1280, avaliador_id: cred.id, owner_id: ids.dono, valor: 350, prazo_ate: new Date(Date.now() + 10 * 86_400_000).toISOString() });
    for (const w of larguras) {
      const ctx = await browser.newContext({ storageState: authFile("admin"), viewport: { width: w, height: w === 390 ? 844 : 900 } });
      const a = await ctx.newPage();
      await a.goto("/admin/avaliadores", { waitUntil: "domcontentloaded" });
      await comChave(a);
      const topo = a.getByTestId("avaliacoes-decidir");
      await expect(topo.getByTestId("decidir-numero-contestacoes")).not.toHaveAttribute("data-valor", "0");
      await expect(topo.getByTestId("decidir-numero-devolucoes")).not.toHaveAttribute("data-valor", "0");
      await expect(topo.getByTestId("decidir-numero-laudos-atrasados")).toBeVisible();
      await expect(topo.getByTestId("decidir-numero-auditoria")).toHaveAttribute("href", "#auditoria");
      await topo.getByTestId("decidir-numero-contestacoes").click();
      await expect(a.getByTestId("avaliacoes-contestacoes")).toBeInViewport();
      await expect(a.getByTestId("contestacao-item").first()).toBeVisible();
      await expect(a.getByTestId("devolucao-item").first()).toContainText(cred.numero);
      // O rótulo "Imóvel (id)" do formulário de verificação continua (o t305 depende dele).
      await expect(a.getByTestId("verificacao-form").getByLabel("Imóvel (id)")).toBeVisible();
      await semRolagemLateral(a);
      await a.screenshot({ path: `${SAIDA}/t344-admin-contestacoes-${w}.png` });
      await ctx.close();
    }
  });
});
