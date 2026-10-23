import { test, expect, type Browser, type Page } from "@playwright/test";
import { authFile } from "../fixtures/auth";
import { NO_LABORATORIO, adm, apagarContas, cpfAleatorio, criarConta, criarImovelPronto, entrar, novaSenha, novoSufixo } from "../fixtures/laboratorio";
import { ITENS_CHECKLIST } from "../../../src/config/checklist-avaliacao";

/**
 * T304 — Prompt 62-B2: execução da avaliação (laboratório; a chave VISTORIA_ATIVA liga só no navegador do teste,
 * pelo cookie de laboratório). A designação e a agenda são do 62-B1 (t303): aqui os pedidos nascem "agendados" no
 * banco e o avaliador conclui pela tela; o laudo VIS sai sempre pela ação (registrarDocumento). Datas simuladas no banco.
 *   1. aprovado → "Nível Premium · vistoriado" na ficha e o laudo no /conferir (sem valor); fila local do checklist;
 *   2. com ressalvas → foto da correção no 10º dia → o avaliador reverifica → v2 aprovado, "· vistoriado";
 *   3. reprovado → vale o nível do laudo, sem "· vistoriado"; nova avaliação em 90 dias pela metade;
 *   4. fechadura não conforme → sai da busca na hora → correção comprovada → volta;
 *   5. contestação → 2º avaliador diferente → o dono vence → devolução registrada e confirmada;
 *   6. 3 verificações reprovadas (admin abre) → todos os anúncios fora da busca → nova avaliação aprovada → voltam.
 */
test.describe("T304 — laudo da avaliação (62-B2)", () => {
  test.skip(!NO_LABORATORIO, "Só no laboratório.");
  test.describe.configure({ mode: "serial" });
  test.use({ actionTimeout: 15_000, navigationTimeout: 30_000 });

  const senha = novaSenha();
  const sufixo = novoSufixo();
  const conta = (p: string, nome: string, role: "owner" | "tenant" = "tenant") => ({ email: `${p}.t304.${sufixo}@lab.vivanomads.test`, nome, role });
  const dono = conta("dono", "Dalva Dona", "owner");
  const dono2 = conta("dono2", "Davi Dono", "owner");
  const avA = conta("ava", "Ana Avaliadora");
  const avB = conta("avb", "Beto Avaliador");
  const ids: Record<string, string> = {};
  const cred: Record<"A" | "B", { id: string; numero: string }> = { A: { id: "", numero: "" }, B: { id: "", numero: "" } };
  const IMOVEL = { lat: -18.9186, lng: -48.2772 };
  const PERTO = { latitude: -18.9178, longitude: -48.2772 }; // ~90 m
  const SILENCIO = { via_intensa: false, noturno_obra_100m: false, aviao_ferrovia: false, isolamento_acustico: false };
  const DIA = 86_400_000;

  async function comChave(page: Page) {
    await page.context().addCookies([{ name: "vn_lab_vistoria", value: "1", url: new URL(page.url()).origin }]);
  }
  async function admin(browser: Browser): Promise<Page> {
    const ctx = await browser.newContext({ storageState: authFile("admin"), viewport: { width: 1280, height: 900 } });
    const p = await ctx.newPage();
    await p.goto("/admin/avaliadores", { waitUntil: "domcontentloaded" });
    await comChave(p);
    return p;
  }
  async function avaliador(browser: Browser, l: "A" | "B"): Promise<Page> {
    const p = await entrar(browser, l === "A" ? avA.email : avB.email, senha);
    await comChave(p);
    await p.context().grantPermissions(["geolocation"]);
    await p.context().setGeolocation(PERTO);
    return p;
  }
  /** Pedido já designado, aceito e agendado (o caminho até aqui é o do t303). */
  async function pedidoAgendado(propertyId: string, ownerId: string, l: "A" | "B", extra: Record<string, unknown> = {}): Promise<string> {
    const { data, error } = await adm()
      .from("vistoria_pedidos")
      .insert({ property_id: propertyId, owner_id: ownerId, cidade: "Uberlândia", porte: "q1_2", valor_tabela: 350, status: "agendado", avaliador_id: cred[l].id, designado_em: new Date().toISOString(), agendado_para: new Date(Date.now() - 2 * 3_600_000).toISOString(), ...extra })
      .select("id")
      .single();
    if (error) throw error;
    await adm().from("vistoria_designacoes").insert({ pedido_id: data.id, avaliador_id: cred[l].id, resposta: "aceita", respondido_em: new Date().toISOString() });
    return data.id as string;
  }
  /** O checklist todo conforme (limpeza "pronto") com as exceções dadas, as 4 perguntas de ruído e, se pedido, a internet. */
  async function preencher(pedidoId: string, excecoes: Record<string, string> = {}, opts: { internet?: boolean; pular?: string[] } = {}) {
    const linhas = ITENS_CHECKLIST.filter((i) => !(opts.pular ?? []).includes(i.chave)).map((i) => ({
      pedido_id: pedidoId,
      chave: i.chave,
      valor: excecoes[i.chave] ?? ("tipo" in i && i.tipo === "limpeza" ? "pronto" : "conforme"),
      observacao: excecoes[i.chave] ? "Conferido na visita (laboratório)." : null,
    }));
    const { error } = await adm().from("vistoria_checklist").upsert(linhas, { onConflict: "pedido_id,chave" });
    if (error) throw error;
    await adm().from("vistoria_pedidos").update({ ruido_respostas: SILENCIO }).eq("id", pedidoId);
    if (opts.internet) {
      await adm().from("vistoria_medicoes").insert([
        { pedido_id: pedidoId, tipo: "internet", ponto: "quarto_principal", download_mbps: 328, upload_mbps: 42, latencia_ms: 12, distancia_m: 90 },
        { pedido_id: pedidoId, tipo: "internet", ponto: "trabalho", download_mbps: 328, upload_mbps: 42, latencia_ms: 12, distancia_m: 90 },
      ]);
    }
  }
  /** O avaliador conclui a visita e envia: a plataforma emite o laudo VIS. */
  async function concluirEEnviar(p: Page, pedidoId: string) {
    await p.goto(`/dashboard/parceiro/avaliacao/${pedidoId}`, { waitUntil: "domcontentloaded" });
    await p.getByTestId("concluir-visita").getByRole("button", { name: "Concluir a visita" }).click();
    await expect.poll(async () => (await adm().from("vistoria_pedidos").select("status").eq("id", pedidoId).single()).data?.status, { timeout: 20_000 }).toBe("realizada");
    await p.reload({ waitUntil: "domcontentloaded" });
    await p.getByTestId("enviar-laudo").getByRole("button", { name: "Enviar o laudo" }).click();
    await expect.poll(async () => (await adm().from("vistoria_pedidos").select("status").eq("id", pedidoId).single()).data?.status, { timeout: 30_000 }).toBe("laudo_emitido");
  }
  async function laudoDe(pedidoOriginal: string) {
    const { data } = await adm().from("vistoria_laudos").select("*").eq("pedido_id", pedidoOriginal).order("versao", { ascending: false }).limit(1).single();
    return data as { id: string; numero: string; versao: number; resultado: string; nivel_sustentado: string; vistoriado_em: string | null; documento_id: string; pedido_versao_id: string; ressalvas: { chave: string }[] };
  }
  const nivelGravado = async (propertyId: string) => (await adm().from("imovel_nivel").select("nivel, nivel_vistoriado_em").eq("property_id", propertyId).maybeSingle()).data as { nivel: string; nivel_vistoriado_em: string | null } | null;
  const statusImovel = async (propertyId: string) => (await adm().from("properties").select("status").eq("id", propertyId).single()).data?.status as string;

  test.beforeAll(async () => {
    ids.dono = await criarConta(dono, senha);
    ids.dono2 = await criarConta(dono2, senha);
    ids.A = await criarConta(avA, senha);
    ids.B = await criarConta(avB, senha);
    for (const [l, ativado] of [["A", "2026-01-01T00:00:00Z"], ["B", "2026-01-15T00:00:00Z"]] as const) {
      const { data: parc, error } = await adm()
        .from("parceiros")
        .insert({ user_id: ids[l], tipo_pessoa: "pf", documento: cpfAleatorio(), nome_publico: l === "A" ? avA.nome : avB.nome, slug: `aval-${l.toLowerCase()}-t304-${sufixo}`, categorias: ["fotografia"], cidades: ["Uberlândia"] })
        .select("id")
        .single();
      if (error) throw error;
      const { data: n } = await adm().rpc("proximo_numero_avaliador", { p_sigla: "UDI" });
      const { data: c, error: eC } = await adm()
        .from("avaliadores_credenciamento")
        .insert({ parceiro_id: parc.id, cidade: "Uberlândia", numero_credenciado: n, status: "ativo", experiencia_link: "https://portfolio.lab.vivanomads.test", conduta_versao: "2026-10-23", ativado_em: ativado })
        .select("id, numero_credenciado")
        .single();
      if (eC) throw eC;
      cred[l] = { id: c.id as string, numero: c.numero_credenciado as string };
    }
    await adm().from("vistoria_precos").delete().eq("cidade", "Uberlândia");
    await adm().from("vistoria_precos").insert([
      { cidade: "Uberlândia", porte: "estudio", valor: 280 },
      { cidade: "Uberlândia", porte: "q1_2", valor: 350 },
      { cidade: "Uberlândia", porte: "q3_mais", valor: 420 },
    ]);
    for (const k of ["im1", "im2", "im3", "im4", "im5"]) {
      ids[k] = await criarImovelPronto(ids.dono, `Avaliação t304 ${k} ${sufixo}`, { ativo: true });
    }
    for (const k of ["im6a", "im6b"]) ids[k] = await criarImovelPronto(ids.dono2, `Verificação t304 ${k} ${sufixo}`, { ativo: true });
    const todos = ["im1", "im2", "im3", "im4", "im5", "im6a", "im6b"].map((k) => ids[k]);
    await adm().from("properties").update({ lat: IMOVEL.lat, lng: IMOVEL.lng, lat_exata: IMOVEL.lat, lng_exata: IMOVEL.lng }).in("id", todos);
  });

  test.afterAll(async () => {
    const todos = ["im1", "im2", "im3", "im4", "im5", "im6a", "im6b"].map((k) => ids[k]).filter(Boolean);
    await adm().from("proprietario_strikes").delete().in("property_id", todos);
    await adm().from("vistoria_bloqueios").delete().in("property_id", todos);
    await adm().from("vistoria_laudos").delete().in("property_id", todos);
    await adm().from("vistoria_pedidos").delete().in("property_id", todos);
    await adm().from("vistoria_precos").delete().eq("cidade", "Uberlândia");
    await apagarContas([ids.A, ids.B, ids.dono, ids.dono2]);
  });

  test("1. aprovado: checklist no celular (fila local), internet na hora, laudo VIS, \"Nível Premium · vistoriado\" e /conferir", async ({ browser }) => {
    test.setTimeout(240_000);
    const pedido = await pedidoAgendado(ids.im1, ids.dono, "A");
    ids.p1 = pedido;
    // Quase tudo já respondido; o avaliador responde 2 itens e mede a internet pela tela.
    await preencher(pedido, {}, { pular: ["fechadura_entrada", "cheiro_mofo"] });
    await adm().from("vistoria_medicoes").insert({ pedido_id: pedido, tipo: "internet", ponto: "trabalho", download_mbps: 328, upload_mbps: 42, latencia_ms: 12, distancia_m: 90 });
    const p = await avaliador(browser, "A");
    await p.goto(`/dashboard/parceiro/avaliacao/${pedido}`, { waitUntil: "domcontentloaded" });
    await expect(p.getByTestId("checklist-faltam")).toHaveAttribute("data-faltam", "2");
    await p.getByTestId("item-fechadura_entrada-conforme").click();
    await expect.poll(async () => (await adm().from("vistoria_checklist").select("valor").eq("pedido_id", pedido).eq("chave", "fechadura_entrada").maybeSingle()).data?.valor, { timeout: 15_000 }).toBe("conforme");
    // Rede caiu: a resposta fica na fila do aparelho com o aviso; quando volta, vai sozinha.
    await p.context().setOffline(true);
    await p.getByTestId("item-cheiro_mofo-conforme").click();
    await expect(p.getByTestId("checklist-fila")).toHaveAttribute("data-pendentes", "1", { timeout: 15_000 });
    await p.context().setOffline(false);
    await p.evaluate(() => window.dispatchEvent(new Event("online")));
    await expect(p.getByTestId("checklist-fila")).toHaveCount(0, { timeout: 20_000 });
    expect((await adm().from("vistoria_checklist").select("valor").eq("pedido_id", pedido).eq("chave", "cheiro_mofo").maybeSingle()).data?.valor).toBe("conforme");
    await expect(p.getByTestId("checklist-faltam")).toHaveAttribute("data-faltam", "0");
    // Internet medida agora no quarto principal (motor simulado, ~90 m do imóvel).
    const net = p.getByTestId("avaliacao-internet");
    await net.getByTestId("avaliacao-internet-wifi").check();
    await net.getByTestId("avaliacao-internet-medir").click();
    await expect(net.getByTestId("acao-ok")).toBeVisible({ timeout: 30_000 });
    const { data: med } = await adm().from("vistoria_medicoes").select("ponto, distancia_m").eq("pedido_id", pedido).eq("ponto", "quarto_principal");
    expect(med?.length).toBe(1);
    expect(Number(med![0].distancia_m)).toBeLessThan(300);
    // Ruído pelas 4 perguntas, dB(A) de apoio (interno) e a foto de um cômodo (EXIF sai no envio).
    const ruido = p.getByTestId("avaliacao-ruido-form");
    for (const q of ["via_intensa", "noturno_obra_100m", "aviao_ferrovia", "isolamento_acustico"]) await ruido.locator(`input[name="${q}"][value="nao"]`).check();
    await ruido.getByRole("button", { name: "Salvar ruído" }).click();
    await expect(ruido.getByTestId("acao-ok")).toBeVisible({ timeout: 15_000 });
    const dba = p.getByTestId("avaliacao-dba-form");
    await dba.getByLabel(/dB\(A\) medido/).fill("48,5");
    await dba.getByRole("button", { name: "Guardar dB(A)" }).click();
    await expect.poll(async () => (await adm().from("vistoria_medicoes").select("dba").eq("pedido_id", pedido).eq("tipo", "ruido_dba").maybeSingle()).data?.dba ?? null, { timeout: 15_000 }).not.toBeNull();
    const foto = p.getByTestId("avaliacao-foto-form");
    await foto.getByLabel("Cômodo").fill("Quarto principal");
    await foto.locator('input[type="file"]').setInputFiles({ name: "quarto.png", mimeType: "image/png", buffer: Buffer.from("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==", "base64") });
    await foto.getByRole("button", { name: "Enviar foto" }).click();
    await expect.poll(async () => ((await adm().from("vistoria_checklist_fotos").select("id").eq("pedido_id", pedido).eq("comodo", "Quarto principal")).data ?? []).length, { timeout: 15_000 }).toBe(1);
    expect(await p.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth)).toBeLessThanOrEqual(1);
    await p.screenshot({ path: "tests/laboratorio/saida/t304-checklist-390.png", fullPage: true });
    await concluirEEnviar(p, pedido);
    await p.context().close();

    const l = await laudoDe(pedido);
    expect(l.resultado).toBe("aprovado");
    expect(l.nivel_sustentado).toBe("premium");
    expect(l.vistoriado_em).not.toBeNull();
    const { data: doc } = await adm().from("documentos_registro").select("prefixo, numero, versao, hash_sha256, codigo_verificacao").eq("id", l.documento_id).single();
    expect(doc!.prefixo).toBe("VIS");
    expect(doc!.numero).toMatch(/^VIS-\d{4}-\d{6}$/);
    expect(doc!.hash_sha256).toMatch(/^[0-9a-f]{64}$/);
    await expect.poll(async () => (await nivelGravado(ids.im1))?.nivel_vistoriado_em ?? null, { timeout: 15_000 }).not.toBeNull();
    expect((await nivelGravado(ids.im1))?.nivel).toBe("premium");

    // Ficha pública e /conferir (sem valor nem iniciais).
    const v = await (await browser.newContext({ viewport: { width: 390, height: 844 } })).newPage();
    await v.goto(`/imoveis/${ids.im1}`, { waitUntil: "domcontentloaded" });
    await expect(v.getByText("Nível Premium · vistoriado").first()).toBeVisible({ timeout: 20_000 });
    // O dB(A) é só interno: nada dele na página pública.
    await expect(v.locator("main")).not.toContainText("dB(A)");
    await v.goto(`/conferir?codigo=${doc!.codigo_verificacao}`, { waitUntil: "domcontentloaded" });
    await expect(v.getByText(doc!.numero as string).first()).toBeVisible({ timeout: 20_000 });
    await expect(v.locator("main")).not.toContainText("R$");
    await v.context().close();

    // O dono vê o laudo e baixa o PDF registrado.
    const d = await entrar(browser, dono.email, senha);
    await comChave(d);
    await d.goto(`/dashboard/imoveis/${ids.im1}/nivel#avaliacao`, { waitUntil: "domcontentloaded" });
    await expect(d.getByTestId("laudo-dono-resultado")).toHaveAttribute("data-vistoriado", "sim");
    const pdf = await d.request.get(`/api/vistoria/laudo/${l.id}`);
    expect(pdf.status()).toBe(200);
    expect(pdf.headers()["content-type"]).toContain("application/pdf");
    await d.screenshot({ path: "tests/laboratorio/saida/t304-dono-laudo-390.png", fullPage: true });
    await d.context().close();
  });

  test("2. com ressalvas: foto da correção no 10º dia, reverificação → v2 aprovado e \"· vistoriado\"", async ({ browser }) => {
    test.setTimeout(240_000);
    const pedido = await pedidoAgendado(ids.im2, ids.dono, "A");
    await preencher(pedido, { iluminacao: "nao_conforme", tomadas_risco: "nao_conforme" }, { internet: true });
    const p = await avaliador(browser, "A");
    await concluirEEnviar(p, pedido);
    const l1 = await laudoDe(pedido);
    expect(l1.resultado).toBe("com_ressalvas");
    expect(l1.ressalvas.map((r) => r.chave).sort()).toEqual(["iluminacao", "tomadas_risco"]);
    expect(l1.vistoriado_em).toBeNull();
    // 10 dias depois da emissão (data simulada): ainda no prazo de 15.
    await adm().from("vistoria_laudos").update({ emitido_em: new Date(Date.now() - 10 * DIA).toISOString(), prazo_ressalva_ate: new Date(Date.now() + 5 * DIA).toISOString() }).eq("id", l1.id);
    const d = await entrar(browser, dono.email, senha);
    await comChave(d);
    await d.goto(`/dashboard/imoveis/${ids.im2}/nivel#avaliacao`, { waitUntil: "domcontentloaded" });
    await expect(d.getByTestId("laudo-ressalva")).toHaveCount(2);
    for (const chave of ["iluminacao", "tomadas_risco"]) {
      const f = d.getByTestId(`correcao-foto-${chave}`);
      await f.locator('input[type="file"]').setInputFiles({ name: "correcao.png", mimeType: "image/png", buffer: Buffer.from("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==", "base64") });
      await f.getByRole("button", { name: "Enviar a foto da correção" }).click();
      await expect.poll(async () => ((await adm().from("vistoria_checklist_fotos").select("id").eq("pedido_id", pedido).eq("item_chave", chave)).data ?? []).length, { timeout: 20_000 }).toBe(1);
    }
    await d.context().close();
    // O avaliador reverifica pela foto: conforme → versão 2 do MESMO número, aprovada.
    await p.goto(`/dashboard/parceiro/avaliacao/${pedido}`, { waitUntil: "domcontentloaded" });
    const form = p.getByTestId("confirmar-correcao");
    await form.getByTestId("correcao-iluminacao").selectOption("conforme");
    await form.getByTestId("correcao-tomadas_risco").selectOption("conforme");
    await form.getByRole("button", { name: "Confirmar a reverificação" }).click();
    await expect.poll(async () => (await laudoDe(pedido)).versao, { timeout: 30_000 }).toBe(2);
    await p.context().close();
    const l2 = await laudoDe(pedido);
    expect(l2.resultado).toBe("aprovado");
    expect(l2.numero).toBe(l1.numero);
    expect(l2.vistoriado_em).not.toBeNull();
    const { data: versoes } = await adm().from("documentos_registro").select("versao, status").eq("numero", l1.numero).order("versao");
    expect((versoes ?? []).map((x) => `${x.versao}:${x.status}`)).toEqual(["1:substituido", "2:valido"]);
    await expect.poll(async () => (await nivelGravado(ids.im2))?.nivel_vistoriado_em ?? null, { timeout: 15_000 }).not.toBeNull();
  });

  test("3. reprovado: vale o nível do laudo, sem \"· vistoriado\"; nova avaliação em 90 dias pela metade", async ({ browser }) => {
    test.setTimeout(200_000);
    const pedido = await pedidoAgendado(ids.im3, ids.dono, "B");
    // 4 falhas corrigíveis (acima do limite de 3) sem tocar no padrão mínimo; sem internet medida: Essencial.
    await preencher(pedido, { fotos_nada_omitido: "nao_conforme", cameras_declaracao: "nao_conforme", considerar_confere: "nao_conforme", tomadas_risco: "nao_conforme" });
    const p = await avaliador(browser, "B");
    await concluirEEnviar(p, pedido);
    await p.context().close();
    const l = await laudoDe(pedido);
    expect(l.resultado).toBe("reprovado");
    expect(l.nivel_sustentado).toBe("essencial");
    await expect.poll(async () => (await nivelGravado(ids.im3))?.nivel ?? null, { timeout: 15_000 }).toBe("essencial");
    expect((await nivelGravado(ids.im3))?.nivel_vistoriado_em).toBeNull();
    // A 1ª avaliação pedida pelo dono nunca gera strike.
    expect(((await adm().from("proprietario_strikes").select("id").eq("property_id", ids.im3)).data ?? []).length).toBe(0);
    const d = await entrar(browser, dono.email, senha);
    await comChave(d);
    await d.goto(`/dashboard/imoveis/${ids.im3}/nivel#avaliacao`, { waitUntil: "domcontentloaded" });
    await expect(d.getByTestId("laudo-dono-resultado")).toHaveAttribute("data-resultado", "reprovado");
    await d.getByTestId("pedir-avaliacao").getByRole("button", { name: "Pedir nova avaliação" }).click();
    await expect
      .poll(async () => (await adm().from("vistoria_pedidos").select("tipo, valor_tabela").eq("property_id", ids.im3).eq("tipo", "nova_90d").maybeSingle()).data?.valor_tabela ?? null, { timeout: 20_000 })
      .not.toBeNull();
    const { data: nova } = await adm().from("vistoria_pedidos").select("valor_tabela").eq("property_id", ids.im3).eq("tipo", "nova_90d").single();
    expect(Number(nova!.valor_tabela)).toBe(175);
    await d.context().close();
  });

  test("4. fechadura não conforme: o anúncio sai da busca na hora e volta com a correção comprovada", async ({ browser }) => {
    test.setTimeout(200_000);
    const pedido = await pedidoAgendado(ids.im4, ids.dono, "A");
    await preencher(pedido, { fechadura_entrada: "nao_conforme" }, { internet: true });
    const p = await avaliador(browser, "A");
    await concluirEEnviar(p, pedido);
    const l = await laudoDe(pedido);
    expect(l.resultado).toBe("com_ressalvas");
    expect(await statusImovel(ids.im4)).toBe("paused");
    const { data: b } = await adm().from("vistoria_bloqueios").select("motivo, pausou").eq("property_id", ids.im4).is("resolvido_em", null);
    expect(b).toEqual([{ motivo: "seguranca_grave", pausou: true }]);
    // Fora da contagem de strikes.
    expect(((await adm().from("proprietario_strikes").select("id").eq("property_id", ids.im4)).data ?? []).length).toBe(0);
    // Correção comprovada (reverificação pela foto): volta para a busca.
    await adm().from("vistoria_checklist_fotos").insert({ pedido_id: pedido, item_chave: "fechadura_entrada", path: `${pedido}/correcao-lab.png` });
    await p.goto(`/dashboard/parceiro/avaliacao/${pedido}`, { waitUntil: "domcontentloaded" });
    await p.getByTestId("confirmar-correcao").getByTestId("correcao-fechadura_entrada").selectOption("conforme");
    await p.getByTestId("confirmar-correcao").getByRole("button", { name: "Confirmar a reverificação" }).click();
    await expect.poll(() => statusImovel(ids.im4), { timeout: 30_000 }).toBe("active");
    expect(((await adm().from("vistoria_bloqueios").select("id").eq("property_id", ids.im4).is("resolvido_em", null)).data ?? []).length).toBe(0);
    await p.context().close();
  });

  test("5. contestação: 2º avaliador diferente, o dono vence e a devolução fica registrada", async ({ browser }) => {
    test.setTimeout(240_000);
    const pedido = await pedidoAgendado(ids.im5, ids.dono, "A");
    await preencher(pedido, { chuveiro_teste: "nao_conforme", tomadas_risco: "nao_conforme" }, { internet: true });
    const a = await avaliador(browser, "A");
    await concluirEEnviar(a, pedido);
    await a.context().close();
    const l1 = await laudoDe(pedido);
    expect(l1.resultado).toBe("com_ressalvas");
    const d = await entrar(browser, dono.email, senha);
    await comChave(d);
    await d.goto(`/dashboard/imoveis/${ids.im5}/nivel#avaliacao`, { waitUntil: "domcontentloaded" });
    const contestar = d.getByTestId("contestar-laudo");
    await contestar.locator("textarea").fill("O chuveiro e as tomadas estavam funcionando; peço outra avaliação.");
    await contestar.getByRole("button", { name: "Contestar" }).click();
    await expect.poll(async () => (await adm().from("vistoria_pedidos").select("avaliador_id").eq("property_id", ids.im5).eq("tipo", "contestacao").maybeSingle()).data?.avaliador_id ?? null, { timeout: 20_000 }).toBe(cred.B.id);
    const { data: pc } = await adm().from("vistoria_pedidos").select("id").eq("property_id", ids.im5).eq("tipo", "contestacao").single();
    // B aceitou e agendou (62-B1): faz a 2ª e aprova.
    await adm().from("vistoria_designacoes").update({ resposta: "aceita", respondido_em: new Date().toISOString() }).eq("pedido_id", pc!.id);
    await adm().from("vistoria_pedidos").update({ status: "agendado", agendado_para: new Date(Date.now() - 3_600_000).toISOString() }).eq("id", pc!.id);
    await preencher(pc!.id as string, {}, { internet: true });
    const b = await avaliador(browser, "B");
    await concluirEEnviar(b, pc!.id as string);
    await b.context().close();
    const l2 = await laudoDe(pedido);
    expect(l2.versao).toBe(2);
    expect(l2.resultado).toBe("aprovado");
    expect(l2.numero).toBe(l1.numero);
    const { data: dev } = await adm().from("vistoria_devolucoes").select("id, avaliador_id, valor").eq("pedido_contestacao_id", pc!.id).single();
    expect(dev!.avaliador_id).toBe(cred.A.id);
    expect(Number(dev!.valor)).toBe(350);
    await d.reload({ waitUntil: "domcontentloaded" });
    await d.getByTestId("devolucao-dono").getByRole("button", { name: "Confirmar que recebi" }).click();
    await expect.poll(async () => (await adm().from("vistoria_devolucoes").select("recebido_confirmado_em").eq("id", dev!.id).single()).data?.recebido_confirmado_em ?? null, { timeout: 20_000 }).not.toBeNull();
    await d.context().close();
  });

  test("6. 3 verificações reprovadas: todos os anúncios fora da busca; nova avaliação aprovada: voltam", async ({ browser }) => {
    test.setTimeout(400_000);
    // O admin abre a 1ª verificação pela tela (motivo obrigatório); as outras duas nascem no banco.
    const ad = await admin(browser);
    const f = ad.getByTestId("verificacao-form");
    await f.getByLabel("Imóvel (id)").fill(ids.im6a);
    await f.getByLabel("Motivo").selectOption("denuncia_procedente");
    await f.getByLabel("Descrição do motivo").fill("Denúncia procedente: imóvel diferente das fotos (laboratório).");
    await f.getByRole("button", { name: "Abrir verificação" }).click();
    await expect.poll(async () => (await adm().from("vistoria_pedidos").select("id").eq("property_id", ids.im6a).eq("tipo", "verificacao").maybeSingle()).data?.id ?? null, { timeout: 20_000 }).not.toBeNull();
    await ad.context().close();
    const reprovar = { fotos_nada_omitido: "nao_conforme", cameras_declaracao: "nao_conforme", considerar_confere: "nao_conforme", tomadas_risco: "nao_conforme" };
    const pages: Partial<Record<"A" | "B", Page>> = {};
    const rodar = async (pedidoId: string, l: "A" | "B") => {
      await preencher(pedidoId, reprovar);
      pages[l] ??= await avaliador(browser, l);
      await concluirEEnviar(pages[l]!, pedidoId);
    };
    const { data: v1 } = await adm().from("vistoria_pedidos").select("id, avaliador_id").eq("property_id", ids.im6a).eq("tipo", "verificacao").single();
    const l1: "A" | "B" = v1!.avaliador_id === cred.A.id ? "A" : "B";
    await adm().from("vistoria_designacoes").update({ resposta: "aceita", respondido_em: new Date().toISOString() }).eq("pedido_id", v1!.id);
    await adm().from("vistoria_pedidos").update({ status: "agendado", agendado_para: new Date(Date.now() - 3_600_000).toISOString() }).eq("id", v1!.id);
    await rodar(v1!.id as string, l1);
    await expect.poll(async () => ((await adm().from("proprietario_strikes").select("ordem").eq("owner_id", ids.dono2)).data ?? []).length, { timeout: 15_000 }).toBe(1);
    // 2º strike: republicar só com laudo; ainda publicado.
    const v2 = await pedidoAgendado(ids.im6a, ids.dono2, "A", { tipo: "verificacao", verificacao_motivo: "pendencia_conforto", verificacao_detalhe: "Pendência procedente (laboratório)." });
    await rodar(v2, "A");
    await expect.poll(async () => ((await adm().from("proprietario_strikes").select("ordem").eq("owner_id", ids.dono2)).data ?? []).length, { timeout: 15_000 }).toBe(2);
    expect(await statusImovel(ids.im6b)).toBe("active");
    const v3 = await pedidoAgendado(ids.im6a, ids.dono2, "B", { tipo: "verificacao", verificacao_motivo: "outro", verificacao_detalhe: "Nova denúncia procedente (laboratório)." });
    await rodar(v3, "B");
    const ordens = ((await adm().from("proprietario_strikes").select("ordem").eq("owner_id", ids.dono2).order("ordem")).data ?? []).map((x) => x.ordem);
    expect(ordens).toEqual([1, 2, 3]);
    // 3º: TODOS os anúncios do proprietário fora da busca (inclusive o que não foi verificado).
    await expect.poll(() => statusImovel(ids.im6b), { timeout: 15_000 }).toBe("paused");
    expect(await statusImovel(ids.im6a)).toBe("paused");
    // Nova avaliação aprovada: voltam.
    const nova = await pedidoAgendado(ids.im6a, ids.dono2, "A");
    await preencher(nova, {}, { internet: true });
    await concluirEEnviar(pages.A ?? (pages.A = await avaliador(browser, "A")), nova);
    await expect.poll(() => statusImovel(ids.im6b), { timeout: 30_000 }).toBe("active");
    expect(await statusImovel(ids.im6a)).toBe("active");
    for (const pg of Object.values(pages)) await pg?.context().close();
  });
});
