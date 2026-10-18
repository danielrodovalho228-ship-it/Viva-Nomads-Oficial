import { test, expect } from "@playwright/test";
import { createClient } from "@supabase/supabase-js";
import { authFile } from "../fixtures/auth";
import { CHAVE_ANON, NO_LABORATORIO, URL_SUPABASE, adm, apagarContas, criarConta, entrar, novaSenha, novoSufixo, pngDeTeste } from "../fixtures/laboratorio";

/**
 * T191 — ordem 65e999b2 (Próximo do FF 4/6, "Publicamos para você"): rota da fila fechada para quem não é admin
 * e sem rolagem lateral no celular. O fluxo logado (pedir → fila do /admin → andamento no painel) roda com as
 * contas de QA do laboratório (t169). A decisão do DONO (aprovar / pedir ajustes) é provada logada no fim deste arquivo.
 */
test("visitante não entra na fila de ajuda do /admin", async ({ page }) => {
  await page.goto("/admin/ajuda-publicacao", { waitUntil: "domcontentloaded" });
  await expect(page).not.toHaveURL(/\/admin\/ajuda-publicacao$/);
});

test("390 px: /auth sem rolagem lateral (a rota privada redireciona)", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/admin/ajuda-publicacao", { waitUntil: "domcontentloaded" });
  const sem = await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth + 1);
  expect(sem).toBe(true);
});

test.describe("T191 — o dono decide o rascunho (ordem 65e999b2, logado)", () => {
  test.skip(!NO_LABORATORIO, "Só no laboratório (contas de teste).");
  test.describe.configure({ mode: "serial" });
  test.setTimeout(120_000);
  const senha = novaSenha();
  const sufixo = novoSufixo();
  const ids: (string | undefined)[] = [];
  const dono = { email: `ajuda.dono.${sufixo}@lab.vivanomads.test`, id: "" };
  const outro = { email: `ajuda.outro.${sufixo}@lab.vivanomads.test`, id: "" };

  async function pedido(owner: string, status: string): Promise<string> {
    const { data, error } = await adm()
      .from("pedidos_ajuda_publicacao")
      .insert({ owner_id: owner, texto_anuncio: "Studio mobiliado perto do metrô, 30 m², com varanda.", status })
      .select("id")
      .single();
    if (error) throw error;
    return data.id as string;
  }
  async function statusDe(id: string): Promise<string> {
    const { data } = await adm().from("pedidos_ajuda_publicacao").select("status").eq("id", id).single();
    return data!.status as string;
  }

  test.beforeAll(async () => {
    dono.id = await criarConta({ email: dono.email, nome: "Dona Ajuda Sobrenome", role: "owner" }, senha);
    outro.id = await criarConta({ email: outro.email, nome: "Outro Dono Sobrenome", role: "owner" }, senha);
    ids.push(dono.id, outro.id);
  });
  test.afterAll(async () => {
    await apagarContas(ids);
  });

  // Um pedido que sobra de um teste que falhou duplicaria os botões no seguinte: cada teste começa sem pedidos do dono.
  test.beforeEach(async () => {
    await adm().from("pedidos_ajuda_publicacao").delete().eq("owner_id", dono.id);
  });
  test.afterEach(async () => {
    await adm().from("pedidos_ajuda_publicacao").delete().eq("owner_id", dono.id);
  });

  /** Abre o painel já hidratado (o botão só responde depois do JavaScript) e clica no botão da decisão. */
  async function decidir(browser: import("@playwright/test").Browser, botao: string, largura = 1280): Promise<void> {
    const page = await entrar(browser, dono.email, senha);
    try {
      await page.setViewportSize({ width: largura, height: 900 });
      await page.goto("/dashboard/imoveis", { waitUntil: "networkidle" });
      await expect(page.getByTestId(botao)).toBeVisible({ timeout: 20_000 });
      await page.getByTestId(botao).click();
      // Primeiro o desfecho (botões somem ou aparece o alerta): se a decisão falhar, o erro da tela vai na mensagem do teste.
      const alerta = page.getByTestId("decisao-rascunho").getByRole("alert");
      await expect
        .poll(async () => ((await page.getByTestId("decisao-rascunho").count()) === 0 ? "feito" : (await alerta.count()) ? "erro" : "aguardando"), { timeout: 20_000 })
        .not.toBe("aguardando");
      if (await alerta.count()) throw new Error(`A decisão falhou na tela: ${await alerta.first().innerText()}`);
      await expect(page.getByTestId("decisao-rascunho")).toHaveCount(0, { timeout: 20_000 });
    } finally {
      await page.context().close();
    }
  }

  for (const largura of [390, 1280]) {
    test(`${largura} px — pedido enviado para aprovação: Aprovar grava aprovado_dono e os botões somem`, async ({ browser }) => {
      const id = await pedido(dono.id, "enviado_dono");
      await decidir(browser, "decisao-aprovar", largura);
      await expect.poll(() => statusDe(id), { timeout: 15_000 }).toBe("aprovado_dono");
    });
  }

  test("Pedir ajustes grava ajustes_pedidos", async ({ browser }) => {
    const id = await pedido(dono.id, "enviado_dono");
    await decidir(browser, "decisao-ajustes");
    await expect.poll(() => statusDe(id), { timeout: 15_000 }).toBe("ajustes_pedidos");
  });

  test("negativo — pedido ainda 'recebido' não mostra os botões", async ({ browser }) => {
    await pedido(dono.id, "recebido");
    const page = await entrar(browser, dono.email, senha);
    try {
      await page.goto("/dashboard/imoveis", { waitUntil: "domcontentloaded" });
      await expect(page.getByTestId("ajuda-andamento")).toBeVisible({ timeout: 20_000 });
      await expect(page.getByTestId("decisao-rascunho")).toHaveCount(0);
    } finally {
      await page.context().close();
    }
  });

  test("negativo (RLS) — outro dono não decide pedido alheio, e o dono não decide pedido 'recebido'", async () => {
    const entrarComo = async (email: string) => {
      const cli = createClient(URL_SUPABASE!, CHAVE_ANON!, { auth: { persistSession: false } });
      const { error } = await cli.auth.signInWithPassword({ email, password: senha });
      expect(error).toBeNull();
      return cli;
    };
    const alheio = await pedido(dono.id, "enviado_dono");
    const intruso = await entrarComo(outro.email);
    const r1 = await intruso.from("pedidos_ajuda_publicacao").update({ status: "aprovado_dono" }).eq("id", alheio).select("id");
    expect(r1.data ?? []).toHaveLength(0);
    expect(await statusDe(alheio)).toBe("enviado_dono");

    const recebido = await pedido(dono.id, "recebido");
    const titular = await entrarComo(dono.email);
    const r2 = await titular.from("pedidos_ajuda_publicacao").update({ status: "aprovado_dono" }).eq("id", recebido).select("id");
    expect(r2.data ?? []).toHaveLength(0);
    expect(await statusDe(recebido)).toBe("recebido");
    await adm().from("pedidos_ajuda_publicacao").delete().in("id", [alheio, recebido]);
  });

  // ---- Fotos no pedido (ordem 65e999b2, fotos; achado do Moacir no #813) ----
  const BUCKET = "property-photos";
  const caminhosParaLimpar: string[] = [];
  test.afterAll(async () => {
    if (caminhosParaLimpar.length) await adm().storage.from(BUCKET).remove(caminhosParaLimpar);
  });

  /** Abre o passo 1 do novo anúncio já hidratado e o formulário "Publicamos para você". */
  async function abrirPedido(page: import("@playwright/test").Page) {
    await page.goto("/dashboard/imoveis/novo", { waitUntil: "domcontentloaded" });
    await page.waitForLoadState("networkidle", { timeout: 10_000 }).catch(() => {});
    await page.getByTestId("ajuda-publicar-abrir").click();
    await expect(page.getByTestId("ajuda-publicar")).toBeVisible({ timeout: 20_000 });
  }

  for (const largura of [390, 1280]) {
    test(`${largura} px — dono anexa 1 foto e envia só com foto: o pedido grava 1 caminho dele`, async ({ browser }) => {
      const page = await entrar(browser, dono.email, senha);
      try {
        await page.setViewportSize({ width: largura, height: 900 });
        await abrirPedido(page);
        await page.getByTestId("ajuda-publicar-foto-input").setInputFiles({ name: "sala.png", mimeType: "image/png", buffer: pngDeTeste(largura) });
        await expect(page.getByTestId("ajuda-publicar-fotos").locator("li")).toHaveCount(1, { timeout: 20_000 });
        // Sem link e sem texto: só a foto basta.
        await page.getByTestId("ajuda-publicar-enviar").click();
        await expect(page.getByTestId("ajuda-publicar-enviado")).toBeVisible({ timeout: 20_000 });
        const { data } = await adm().from("pedidos_ajuda_publicacao").select("fotos, link_anuncio, texto_anuncio").eq("owner_id", dono.id);
        expect(data).toHaveLength(1);
        expect(data![0].fotos).toHaveLength(1);
        // Desde o #849 a foto é convertida para .webp no envio.
        expect(String((data![0].fotos as string[])[0])).toMatch(new RegExp(`^${dono.id}/[0-9a-f-]{36}\\.(png|webp)$`));
        expect(data![0].link_anuncio).toBeNull();
        expect(data![0].texto_anuncio).toBeNull();
        caminhosParaLimpar.push(...(data![0].fotos as string[]));
        expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth + 1)).toBe(true);
      } finally {
        await page.context().close();
      }
    });
  }

  test("negativo — caminho de foto de OUTRO dono é recusado pela ação e nada é gravado", async ({ browser }) => {
    const page = await entrar(browser, dono.email, senha);
    try {
      const alheia = `${outro.id}/${crypto.randomUUID()}.png`;
      // A rota de upload devolve o caminho da pasta do outro dono: a ação do servidor precisa recusar.
      await page.route("**/api/upload/foto", (r) => r.fulfill({ json: { path: alheia, url: "/icon.png" } }));
      await abrirPedido(page);
      await page.getByTestId("ajuda-publicar-foto-input").setInputFiles({ name: "x.png", mimeType: "image/png", buffer: pngDeTeste(3) });
      await expect(page.getByTestId("ajuda-publicar-fotos").locator("li")).toHaveCount(1, { timeout: 20_000 });
      await page.getByTestId("ajuda-publicar-enviar").click();
      await expect(page.getByTestId("ajuda-publicar-erro")).toContainText("Uma das fotos não é válida", { timeout: 20_000 });
      await expect(page.getByTestId("ajuda-publicar-enviado")).toHaveCount(0);
      const { data } = await adm().from("pedidos_ajuda_publicacao").select("id").eq("owner_id", dono.id);
      expect(data ?? []).toHaveLength(0);
    } finally {
      await page.context().close();
    }
  });

  test("admin vê a miniatura da foto do pedido na fila", async ({ browser }) => {
    const caminho = `${dono.id}/${crypto.randomUUID()}.png`;
    const { error } = await adm().storage.from(BUCKET).upload(caminho, pngDeTeste(7), { contentType: "image/png" });
    expect(error).toBeNull();
    caminhosParaLimpar.push(caminho);
    const { data, error: e2 } = await adm()
      .from("pedidos_ajuda_publicacao")
      .insert({ owner_id: dono.id, texto_anuncio: "Studio mobiliado perto do metrô, 30 m², com varanda.", fotos: [caminho] })
      .select("id")
      .single();
    if (e2) throw e2;
    const ctx = await browser.newContext({ storageState: authFile("admin"), viewport: { width: 390, height: 844 } });
    const page = await ctx.newPage();
    try {
      for (const largura of [390, 1280]) {
        await page.setViewportSize({ width: largura, height: 900 });
        await page.goto("/admin/ajuda-publicacao", { waitUntil: "domcontentloaded" });
        const item = page.getByTestId("ajuda-item").filter({ has: page.getByTestId("ajuda-item-fotos") }).first();
        const miniatura = item.getByTestId("ajuda-item-fotos").locator("img").first();
        await expect(miniatura).toBeVisible({ timeout: 30_000 });
        await expect.poll(() => miniatura.evaluate((i: HTMLImageElement) => i.naturalWidth), { timeout: 15_000 }).toBeGreaterThan(0);
        expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth + 1)).toBe(true);
      }
      expect(data!.id).toBeTruthy();
    } finally {
      await ctx.close();
    }
  });
});
