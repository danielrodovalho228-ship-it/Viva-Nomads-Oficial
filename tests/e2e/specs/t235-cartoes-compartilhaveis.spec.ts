import { writeFileSync } from "node:fs";
import { test, expect, type Page, type Browser, type APIRequestContext } from "@playwright/test";
import { NO_LABORATORIO, adm, apagarContas, criarConta, criarImovelPronto, entrar, fotosReais, novaSenha, novoSufixo } from "../fixtures/laboratorio";

/*
  T235 — Cartões compartilháveis, Fase 1 (390 e 1280 px):
   1. dono: o anúncio publicado tem o cartão (gerado ao publicar/no 1º acesso) em Meus imóveis → "Cartão para
      compartilhar"; as duas imagens (1080×1350 e 1080×1080) saem do servidor em menos de 2 s; "Compartilhar no
      WhatsApp" em um toque abre o wa.me com a legenda e o link curto; conta cards_generated e cards_shared;
   2. morador: depois da saída, o cartão-postal aparece na locação; o primeiro nome só com o consentimento;
   3. QR/link: o link curto leva à página do imóvel do próprio domínio com ref + UTM + sig; a visita sem login conta
      qr_scans e ref_listing_views; assinatura adulterada ou imóvel trocado não conta nada; trocar o código faz o QR
      antigo parar de contar;
   4. ref_bookings: contrato de um lead atribuído assinado pelas duas partes conta uma vez;
   5. imóvel sem foto: o cartão sai com o fundo da marca (sem erro).
*/
const SAIDA = "tests/laboratorio/saida";
const senha = novaSenha();
const sufixo = novoSufixo();
const dono = { email: `dono.t235.${sufixo}@lab.vivanomads.test`, nome: "Rafael Cartão Prado", role: "owner" as const };
const inq = { email: `inq.t235.${sufixo}@lab.vivanomads.test`, nome: "Helena Postal Duarte", role: "tenant" as const };
const visit = { email: `vis.t235.${sufixo}@lab.vivanomads.test`, nome: "Igor Visita Lopes", role: "tenant" as const };
const ids: Record<string, string | undefined> = {};
const dia = (n: number) => new Date(Date.now() - 3 * 3_600_000 + n * 86_400_000).toISOString().slice(0, 10);

async function contarEventos(tipo: string, imovelId: string, cartaoTipo?: string): Promise<number> {
  let q = adm().from("eventos").select("id", { count: "exact", head: true }).eq("tipo", tipo).eq("imovel_id", imovelId);
  if (cartaoTipo) q = q.eq("cartao_tipo", cartaoTipo);
  return (await q).count ?? 0;
}

/** PNG: largura e altura no cabeçalho IHDR. */
function dimensoesPng(buf: Buffer): { w: number; h: number } {
  expect(buf.subarray(1, 4).toString("ascii")).toBe("PNG");
  return { w: buf.readUInt32BE(16), h: buf.readUInt32BE(20) };
}

async function imagemRapida(request: APIRequestContext, caminho: string, esperado: { w: number; h: number }) {
  const t0 = Date.now();
  const r = await request.get(caminho);
  const ms = Date.now() - t0;
  expect(r.status()).toBe(200);
  expect(r.headers()["content-type"]).toContain("image/png");
  expect(dimensoesPng(await r.body())).toEqual(esperado);
  expect(ms, `${caminho} em ${ms} ms`).toBeLessThan(2000);
  return ms;
}

async function semRolagemLateral(page: Page) {
  expect(await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth)).toBeLessThanOrEqual(1);
}

/** Captura o window.open (o wa.me) sem sair do teste. */
async function capturarAbertura(page: Page) {
  await page.evaluate(() => {
    (window as unknown as { __abertos: string[] }).__abertos = [];
    window.open = ((u: string) => {
      (window as unknown as { __abertos: string[] }).__abertos.push(String(u));
      return null;
    }) as typeof window.open;
    Object.defineProperty(navigator, "canShare", { value: () => false, configurable: true });
  });
}

async function abrirComo(browser: Browser, email: string, largura: number) {
  const page = await entrar(browser, email, senha);
  await page.setViewportSize({ width: largura, height: largura === 390 ? 844 : 900 });
  return page;
}

test.describe("T235 — cartões compartilháveis (Fase 1)", () => {
  test.skip(!NO_LABORATORIO, "Só no laboratório (Supabase local + integrações simuladas).");
  test.describe.configure({ mode: "serial" });

  test.beforeAll(async () => {
    ids.dono = await criarConta(dono, senha);
    ids.inq = await criarConta(inq, senha);
    ids.vis = await criarConta(visit, senha);
    ids.imovel = await criarImovelPronto(ids.dono, `Studio T235 ${sufixo}`, { ativo: true, preco: 3200 });
    await fotosReais(ids.imovel, ids.dono); // fotos de verdade no storage: o cartão usa a capa (a 1ª)
    ids.semFoto = await criarImovelPronto(ids.dono, `Loft sem foto T235 ${sufixo}`, { ativo: true, preco: 2800 });
    await adm().from("property_photos").delete().eq("property_id", ids.semFoto);
    // Estadia encerrada (saída ontem) com as duas assinaturas: o cartão-postal aparece para o morador.
    const agora = new Date().toISOString();
    const { data: c, error } = await adm()
      .from("contratos")
      .insert({
        property_id: ids.imovel, tenant_id: ids.inq, owner_plan: "free", faixa: "temporada", prazo_total_dias: 60, aluguel_mensal: 3200,
        tamanho_bloco_meses: 2, comissao_percent: 0.12, comissao_valor: 768, qtd_ocupantes: 1, status: "concluido", garantia: "caucao",
        assinado_proprietario_em: agora, assinado_inquilino_em: agora,
      })
      .select("id")
      .single();
    if (error) throw error;
    ids.contrato = c.id as string;
    const { error: eB } = await adm()
      .from("contrato_blocos")
      .insert({ contrato_id: ids.contrato, numero_bloco: 1, inicio: dia(-61), fim: dia(-1), meses: 2, valor: 6400, caucao: 3200, status: "encerrado" });
    if (eB) throw eB;
  });

  test.afterAll(async () => {
    await apagarContas([ids.dono, ids.inq, ids.vis]);
  });

  test("1. dono: cartão do anúncio em Meus imóveis, imagens em < 2 s nos dois formatos e WhatsApp em um toque", async ({ browser, request }) => {
    // A 1ª imagem do cartão é gerada a frio no servidor do lab (instável no lab 05cb8901: naturalWidth 0 em 20 s).
    test.setTimeout(240_000);
    for (const largura of [390, 1280]) {
      const page = await abrirComo(browser, dono.email, largura);
      await page.goto("/dashboard/imoveis", { waitUntil: "domcontentloaded" });
      const link = page.locator(`a[data-testid="cartao-anuncio-link"][href="/dashboard/imoveis/${ids.imovel}/cartao"]`);
      await expect(link).toBeVisible({ timeout: 20_000 });
      await link.click();
      await expect(page).toHaveURL(new RegExp(`/dashboard/imoveis/${ids.imovel}/cartao$`));
      const painel = page.getByTestId("cartao-compartilhar");
      await expect(painel).toHaveAttribute("data-tipo", "ownercard");
      ids.curtoDono = (await painel.getAttribute("data-curto")) ?? undefined;
      await expect(page.getByTestId("cartao-previa")).toBeVisible();
      await expect.poll(() => page.getByTestId("cartao-previa").evaluate((i: HTMLImageElement) => i.naturalWidth), { timeout: 45_000 }).toBe(1080);
      await expect(page.getByTestId("cartao-legenda")).toContainText(`/c/${ids.curtoDono}`);
      await semRolagemLateral(page);
      await page.screenshot({ path: `${SAIDA}/t235-dono-cartao-${largura}.png`, fullPage: true });
      await page.getByTestId("cartao-formato-quadrado").click();
      await expect.poll(() => page.getByTestId("cartao-previa").evaluate((i: HTMLImageElement) => i.naturalHeight), { timeout: 45_000 }).toBe(1080);
      if (largura === 1280) {
        const antes = await contarEventos("cards_shared", ids.imovel!, "ownercard");
        await capturarAbertura(page);
        await page.getByTestId("cartao-compartilhar-whatsapp").click();
        await expect.poll(() => page.evaluate(() => (window as unknown as { __abertos: string[] }).__abertos[0] ?? "")).toMatch(/^https:\/\/wa\.me\/\?text=/);
        const aberto = await page.evaluate(() => (window as unknown as { __abertos: string[] }).__abertos[0]);
        expect(decodeURIComponent(aberto.split("text=")[1])).toContain(`/c/${ids.curtoDono}`);
        await expect.poll(() => contarEventos("cards_shared", ids.imovel!, "ownercard"), { timeout: 15_000 }).toBe(antes + 1);
      }
      await page.context().close();
    }
    expect(await contarEventos("cards_generated", ids.imovel!, "ownercard")).toBe(1); // um cartão por anúncio, não um por acesso
    await imagemRapida(request, `/cartoes/${ids.curtoDono}/imagem?formato=retrato`, { w: 1080, h: 1350 });
    await imagemRapida(request, `/cartoes/${ids.curtoDono}/imagem?formato=quadrado`, { w: 1080, h: 1080 });
    for (const formato of ["retrato", "quadrado"]) {
      const r = await request.get(`/cartoes/${ids.curtoDono}/imagem?formato=${formato}`);
      writeFileSync(`${SAIDA}/t235-imagem-anuncio-${formato}.png`, await r.body());
    }
  });

  test("2. morador: depois da saída o cartão-postal aparece; primeiro nome só com consentimento", async ({ browser, request }) => {
    test.setTimeout(120_000);
    for (const largura of [390, 1280]) {
      const page = await abrirComo(browser, inq.email, largura);
      await page.goto(`/dashboard/locacoes/${ids.contrato}`, { waitUntil: "domcontentloaded" });
      const painel = page.getByTestId("cartao-postal-painel");
      await expect(painel).toBeVisible({ timeout: 20_000 });
      await expect(painel.getByTestId("cartao-compartilhar")).toHaveAttribute("data-tipo", "poststay");
      ids.curtoPostal = (await painel.getByTestId("cartao-compartilhar").getAttribute("data-curto")) ?? undefined;
      await expect.poll(() => page.getByTestId("cartao-previa").evaluate((i: HTMLImageElement) => i.naturalWidth), { timeout: 45_000 }).toBe(1080);
      await semRolagemLateral(page);
      await page.screenshot({ path: `${SAIDA}/t235-postal-${largura}.png`, fullPage: true });
      if (largura === 390) {
        const { data: antes } = await adm().from("cartoes_compartilhaveis").select("mostrar_nome").eq("curto", ids.curtoPostal!).single();
        expect(antes!.mostrar_nome).toBe(false); // sem consentimento, sem nome
        await page.getByRole("switch", { name: "Mostrar meu primeiro nome no cartão" }).click();
        await expect.poll(async () => (await adm().from("cartoes_compartilhaveis").select("mostrar_nome").eq("curto", ids.curtoPostal!).single()).data!.mostrar_nome).toBe(true);
        const antesShare = await contarEventos("cards_shared", ids.imovel!, "poststay");
        await capturarAbertura(page);
        await page.getByTestId("cartao-compartilhar-whatsapp").click();
        await expect.poll(() => contarEventos("cards_shared", ids.imovel!, "poststay"), { timeout: 15_000 }).toBe(antesShare + 1);
      }
      await page.context().close();
    }
    await imagemRapida(request, `/cartoes/${ids.curtoPostal}/imagem?formato=retrato`, { w: 1080, h: 1350 });
    await imagemRapida(request, `/cartoes/${ids.curtoPostal}/imagem?formato=quadrado`, { w: 1080, h: 1080 });
    const comNome: Record<string, Buffer> = {};
    for (const formato of ["retrato", "quadrado"] as const) {
      const r = await request.get(`/cartoes/${ids.curtoPostal}/imagem?formato=${formato}`);
      comNome[formato] = await r.body();
      writeFileSync(`${SAIDA}/t235-imagem-postal-${formato}.png`, comNome[formato]);
    }
    // O cartão-postal respeita o opt-in: sem consentimento, a imagem sai sem o primeiro nome (outra imagem).
    await adm().from("cartoes_compartilhaveis").update({ mostrar_nome: false }).eq("curto", ids.curtoPostal!);
    for (const formato of ["retrato", "quadrado"] as const) {
      const semNome = await (await request.get(`/cartoes/${ids.curtoPostal}/imagem?formato=${formato}`)).body();
      expect(semNome.equals(comNome[formato]), `cartão-postal ${formato} sem o nome deve mudar`).toBe(false);
      writeFileSync(`${SAIDA}/t235-imagem-postal-sem-nome-${formato}.png`, semNome);
    }
    await adm().from("cartoes_compartilhaveis").update({ mostrar_nome: true }).eq("curto", ids.curtoPostal!);
    // Contrato ainda em andamento (outro morador, outro imóvel) não tem cartão-postal.
    const agora = new Date().toISOString();
    const { data: emAndamento, error } = await adm()
      .from("contratos")
      .insert({
        property_id: ids.semFoto, tenant_id: ids.vis, owner_plan: "free", faixa: "temporada", prazo_total_dias: 60, aluguel_mensal: 2800,
        tamanho_bloco_meses: 2, comissao_percent: 0.12, comissao_valor: 672, qtd_ocupantes: 1, status: "ativo", garantia: "caucao",
        assinado_proprietario_em: agora, assinado_inquilino_em: agora,
      })
      .select("id")
      .single();
    expect(error).toBeNull();
    await adm().from("contrato_blocos").insert({ contrato_id: emAndamento!.id, numero_bloco: 1, inicio: dia(-10), fim: dia(50), meses: 2, valor: 5600, caucao: 2800, status: "ativo" });
    const page = await abrirComo(browser, visit.email, 390);
    await page.goto(`/dashboard/locacoes/${emAndamento!.id}`, { waitUntil: "domcontentloaded" });
    await expect(page.getByTestId("contrato-selo")).toBeVisible({ timeout: 20_000 });
    await expect(page.getByTestId("cartao-postal-painel")).toHaveCount(0);
    await page.context().close();
  });

  test("3. QR/link: imóvel certo com ref + UTM; visita sem login conta; adulterado não conta; código trocado para de contar", async ({ browser, request }) => {
    test.setTimeout(120_000);
    const r = await request.get(`/c/${ids.curtoDono}`, { maxRedirects: 0 });
    expect(r.status()).toBe(302);
    const destino = new URL(r.headers()["location"]);
    const base = new URL(process.env.TESTES_BASE_URL ?? "http://localhost:3123");
    expect(destino.host).toBe(base.host); // só o próprio domínio (no laboratório, o do servidor de teste)
    expect(destino.pathname).toBe(`/imoveis/${ids.imovel}`);
    expect(destino.searchParams.get("utm_source")).toBe("share_card");
    expect(destino.searchParams.get("utm_medium")).toBe("link");
    expect(destino.searchParams.get("utm_campaign")).toBe("ownercard");
    expect(destino.searchParams.get("utm_content")).toBe(ids.imovel);
    expect(destino.searchParams.get("ref")).toMatch(/^[23456789ABCDEFGHJKMNPQRSTUVWXYZ]{4}-[23456789ABCDEFGHJKMNPQRSTUVWXYZ]{4}$/);
    expect(destino.searchParams.get("sig")).toMatch(/^[0-9a-f]{64}$/);
    // O QR é a mesma URL com utm_medium=qr (a assinatura cobre ref + imóvel).
    const qr = new URL(destino.toString());
    qr.searchParams.set("utm_medium", "qr");

    const visitar = async (url: string, largura = 390) => {
      const ctx = await browser.newContext({ storageState: { cookies: [], origins: [] }, viewport: { width: largura, height: largura === 390 ? 844 : 900 } });
      const page = await ctx.newPage();
      await page.goto(url.replace(destino.origin, ""), { waitUntil: "domcontentloaded" });
      await expect(page.getByRole("heading", { level: 1 })).toContainText(`Studio T235 ${sufixo}`, { timeout: 20_000 });
      return { ctx, page };
    };

    const scans0 = await contarEventos("qr_scans", ids.imovel!, "ownercard");
    const views0 = await contarEventos("ref_listing_views", ids.imovel!, "ownercard");
    for (const largura of [390, 1280]) {
      const { ctx, page } = await visitar(qr.toString(), largura);
      await expect.poll(() => page.url(), { timeout: 15_000 }).not.toContain("sig=");
      await expect.poll(async () => decodeURIComponent((await ctx.cookies()).find((c) => c.name === "vn_ref")?.value ?? ""), { timeout: 15_000 }).toContain(`|ownercard|${ids.imovel}`);
      await semRolagemLateral(page);
      await page.screenshot({ path: `${SAIDA}/t235-imovel-pelo-qr-${largura}.png`, fullPage: false });
      await ctx.close();
    }
    await expect.poll(() => contarEventos("qr_scans", ids.imovel!, "ownercard"), { timeout: 15_000 }).toBe(scans0 + 2);
    await expect.poll(() => contarEventos("ref_listing_views", ids.imovel!, "ownercard"), { timeout: 15_000 }).toBe(views0 + 2);

    // Adulterado: assinatura trocada e imóvel trocado → abre o imóvel, mas nada conta e nenhum cookie.
    const ruim1 = new URL(qr.toString());
    const sig = ruim1.searchParams.get("sig")!;
    ruim1.searchParams.set("sig", (sig[0] === "a" ? "b" : "a") + sig.slice(1));
    const ruim2 = new URL(qr.toString());
    ruim2.searchParams.set("ref", "ZZZZ-ZZZZ");
    for (const u of [ruim1, ruim2]) {
      const { ctx, page } = await visitar(u.toString());
      await expect.poll(() => page.url(), { timeout: 15_000 }).not.toContain("sig=");
      await page.waitForTimeout(2000); // dá tempo da conferência no servidor responder
      expect((await ctx.cookies()).find((c) => c.name === "vn_ref")).toBeUndefined();
      await ctx.close();
    }
    await new Promise((r) => setTimeout(r, 1500));
    expect(await contarEventos("qr_scans", ids.imovel!, "ownercard")).toBe(scans0 + 2);

    // Trocar o código (dono, na tela do cartão): o QR antigo deixa de contar.
    const page = await abrirComo(browser, dono.email, 390);
    await page.goto(`/dashboard/imoveis/${ids.imovel}/cartao`, { waitUntil: "domcontentloaded" });
    await page.getByTestId("cartao-trocar-codigo").click();
    await page.getByRole("button", { name: "Trocar código" }).click();
    await expect(page.getByTestId("cartao-msg")).toContainText("Código trocado", { timeout: 15_000 });
    await page.context().close();
    const { data: codigos } = await adm().from("codigos_compartilhamento").select("codigo, revogado_em").eq("usuario_id", ids.dono!);
    expect((codigos ?? []).filter((c) => !c.revogado_em)).toHaveLength(1);
    expect((codigos ?? []).find((c) => c.codigo === qr.searchParams.get("ref"))?.revogado_em).toBeTruthy();
    const { ctx } = await visitar(qr.toString());
    await ctx.close();
    await new Promise((r) => setTimeout(r, 1500));
    expect(await contarEventos("qr_scans", ids.imovel!, "ownercard")).toBe(scans0 + 2);
    const novo = new URL((await request.get(`/c/${ids.curtoDono}`, { maxRedirects: 0 })).headers()["location"]);
    expect(novo.searchParams.get("ref")).not.toBe(qr.searchParams.get("ref"));
  });

  test("4. ref_bookings: lead atribuído com contrato assinado pelas duas partes conta uma vez", async () => {
    const { data: codigo } = await adm().from("codigos_compartilhamento").select("codigo").eq("usuario_id", ids.dono!).is("revogado_em", null).single();
    const { data: lead, error } = await adm()
      .from("leads")
      .insert({ property_id: ids.semFoto, owner_id: ids.dono, tenant_id: ids.vis, status: "accepted", ref_codigo: codigo!.codigo, ref_tipo: "ownercard" })
      .select("id")
      .single();
    expect(error).toBeNull();
    const antes = await contarEventos("ref_bookings", ids.semFoto!, "ownercard");
    const { data: c } = await adm()
      .from("contratos")
      .insert({
        lead_id: lead!.id, property_id: ids.semFoto, tenant_id: ids.vis, owner_plan: "free", faixa: "temporada", prazo_total_dias: 60, aluguel_mensal: 2800,
        tamanho_bloco_meses: 2, comissao_percent: 0.12, comissao_valor: 672, qtd_ocupantes: 1, status: "ativo", garantia: "caucao",
      })
      .select("id")
      .single();
    await adm().from("contratos").update({ assinado_proprietario_em: new Date().toISOString() }).eq("id", c!.id);
    expect(await contarEventos("ref_bookings", ids.semFoto!, "ownercard")).toBe(antes);
    await adm().from("contratos").update({ assinado_inquilino_em: new Date().toISOString() }).eq("id", c!.id);
    expect(await contarEventos("ref_bookings", ids.semFoto!, "ownercard")).toBe(antes + 1);
    await adm().from("contratos").update({ assinado_inquilino_em: new Date().toISOString() }).eq("id", c!.id); // regravar não conta de novo
    expect(await contarEventos("ref_bookings", ids.semFoto!, "ownercard")).toBe(antes + 1);
  });

  test("5. imóvel sem foto: o cartão sai com o fundo da marca, sem erro", async ({ browser, request }) => {
    const page = await abrirComo(browser, dono.email, 390);
    await page.goto(`/dashboard/imoveis/${ids.semFoto}/cartao`, { waitUntil: "domcontentloaded" });
    const curto = await page.getByTestId("cartao-compartilhar").getAttribute("data-curto");
    await page.context().close();
    await imagemRapida(request, `/cartoes/${curto}/imagem?formato=retrato`, { w: 1080, h: 1350 });
    const r = await request.get(`/cartoes/${curto}/imagem?formato=quadrado`);
    writeFileSync(`${SAIDA}/t235-imagem-sem-foto-quadrado.png`, await r.body());
    expect((await request.get("/cartoes/AAAAAAAAAA/imagem")).status()).toBe(404);
  });
});
