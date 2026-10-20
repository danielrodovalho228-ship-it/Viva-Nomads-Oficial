import { writeFileSync } from "node:fs";
import { test, expect, type Browser, type Page, type APIRequestContext } from "@playwright/test";
import { NO_LABORATORIO, adm, apagarContas, cpfAleatorio, criarConta, entrar, novaSenha, novoSufixo } from "../fixtures/laboratorio";
import { authFile } from "../fixtures/auth";

/*
  T239 — Cartão do parceiro (Prompt 31c), laboratório, 390 e 1280 px:
   1. parceiro com página PUBLICADA (linhas criadas pelo adm(): parceiros + serviço + galeria + avatar_path, como o
      t44 do 31a) → painel › "Cartão para divulgar" → gera o cartão: prévia nos dois formatos (1080×1350 e 1080×1080),
      opt-in do nome, Baixar imagem, Compartilhar (sem Web Share API → copia o link); conta cards_generated 1× e
      cards_shared;
   2. a URL do QR (/parceiros/<slug>?ref&utm_source=cartao&utm_medium=partnercard&sig) abre a página do parceiro sem
      login e conta qr_scans e ref_partner_views; assinatura adulterada abre normal e não conta nada;
   3. pedido com ref (SIMULA o 31b: insere em parceiro_pedidos pelo adm() com ref_codigo e ref_tipo='partnercard') →
      o gatilho da 0192 grava ref_partner_requests 1× (regravar não conta de novo);
   4. admin vê 1 em "Pedidos vindos de cartão" na linha do parceiro, com a fórmula escrita;
   5. sem página publicada, o botão fica desabilitado com "Publique sua página para gerar o cartão".
*/
const SAIDA = "tests/laboratorio/saida";
const senha = novaSenha();
const sufixo = novoSufixo();
const parc = { email: `parc.t239.${sufixo}@lab.vivanomads.test`, nome: "Lia Cartão Mendes", role: "tenant" as const };
const rasc = { email: `rasc.t239.${sufixo}@lab.vivanomads.test`, nome: "Rui Rascunho Alves", role: "tenant" as const };
const cli = { email: `cli.t239.${sufixo}@lab.vivanomads.test`, nome: "Clara Cliente Souza", role: "tenant" as const };
const slug = `t239-lia-${sufixo}`;
const nomePublico = `Lia Fotos T239 ${sufixo}`;
const ids: Record<string, string | undefined> = {};
let curto = "";
let urlQr = "";

async function contar(tipo: string): Promise<number> {
  const { count } = await adm().from("eventos").select("id", { count: "exact", head: true }).eq("tipo", tipo).eq("parceiro_id", ids.parceiro!).eq("cartao_tipo", "partnercard");
  return count ?? 0;
}

function semDialogo(page: Page) {
  page.on("dialog", (d) => {
    throw new Error(`diálogo do navegador não permitido: ${d.type()} ${d.message()}`);
  });
}

async function semRolagemLateral(page: Page) {
  expect(await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth)).toBeLessThanOrEqual(1);
}

async function abrir(browser: Browser, email: string, largura: number) {
  const page = await entrar(browser, email, senha);
  await page.setViewportSize({ width: largura, height: largura === 390 ? 844 : 900 });
  semDialogo(page);
  return page;
}

function dimensoesPng(buf: Buffer): { w: number; h: number } {
  expect(buf.subarray(1, 4).toString("ascii")).toBe("PNG");
  return { w: buf.readUInt32BE(16), h: buf.readUInt32BE(20) };
}

async function imagem(request: APIRequestContext, formato: "retrato" | "quadrado") {
  const r = await request.get(`/cartoes/${curto}/imagem?formato=${formato}`);
  expect(r.status()).toBe(200);
  expect(r.headers()["content-type"]).toContain("image/png");
  const buf = await r.body();
  expect(dimensoesPng(buf)).toEqual(formato === "retrato" ? { w: 1080, h: 1350 } : { w: 1080, h: 1080 });
  writeFileSync(`${SAIDA}/t239-imagem-parceiro-${formato}.png`, buf);
}

async function novoParceiro(userId: string, o: { slug: string; nome: string; status: "publicado" | "rascunho" }): Promise<string> {
  const { data, error } = await adm()
    .from("parceiros")
    .insert({
      user_id: userId,
      tipo_pessoa: "pf",
      documento: cpfAleatorio(),
      nome_publico: o.nome,
      slug: o.slug,
      categorias: ["fotografia"],
      cidades: ["Uberlândia", "Araguari", "Uberaba"],
      descricao: "Fotografia de imóveis mobiliados para anúncio, com luz natural e edição leve.",
      // Foto que não existe no Storage: o cartão sai com o fundo da marca (sem erro), como no t235 sem foto.
      avatar_path: `${userId}/avatar-t239.webp`,
      telefone: "34999991234",
      status: o.status,
      publicado_em: o.status === "publicado" ? new Date().toISOString() : null,
    })
    .select("id")
    .single();
  if (error) throw error;
  const id = data.id as string;
  const { error: eS } = await adm().from("parceiro_servicos").insert({ parceiro_id: id, categoria: "fotografia", titulo: "Ensaio do imóvel (20 fotos)", preco_base: 350, unidade: "por serviço" });
  if (eS) throw eS;
  const { error: eG } = await adm()
    .from("parceiro_galeria")
    .insert([0, 1, 2].map((i) => ({ parceiro_id: id, path: `${userId}/galeria-t239-${i}.webp`, ordem: i })));
  if (eG) throw eG;
  return id;
}

test.describe("T239 — cartão do parceiro (partnercard)", () => {
  test.skip(!NO_LABORATORIO, "Só no laboratório (Supabase local + integrações simuladas).");
  test.describe.configure({ mode: "serial" });

  test.beforeAll(async () => {
    ids.parc = await criarConta(parc, senha);
    ids.rasc = await criarConta(rasc, senha);
    ids.cli = await criarConta(cli, senha);
    ids.parceiro = await novoParceiro(ids.parc, { slug, nome: nomePublico, status: "publicado" });
    ids.parceiroRasc = await novoParceiro(ids.rasc, { slug: `t239-rui-${sufixo}`, nome: `Rui Rascunho T239 ${sufixo}`, status: "rascunho" });
  });

  test.afterAll(async () => {
    // Pedidos antes (parceiro_pedidos → parceiros/contas é "restrict"); cartões e eventos saem em cascata/nulo.
    for (const id of [ids.parceiro, ids.parceiroRasc]) if (id) await adm().from("parceiro_pedidos").delete().eq("parceiro_id", id);
    for (const id of [ids.parceiro, ids.parceiroRasc]) if (id) await adm().from("parceiros").delete().eq("id", id);
    await apagarContas([ids.parc, ids.rasc, ids.cli]);
  });

  test("1. parceiro publicado gera o cartão no painel: dois formatos, opt-in do nome, baixar e compartilhar", async ({ browser, request }) => {
    test.setTimeout(150_000);
    for (const largura of [390, 1280]) {
      const page = await abrir(browser, parc.email, largura);
      await page.goto("/dashboard/parceiro", { waitUntil: "domcontentloaded" });
      await expect(page.getByTestId("painel-parceiro")).toHaveAttribute("data-status", "publicado", { timeout: 20_000 });
      await page.getByTestId("parceiro-aba-cartao").click();
      const aba = page.getByTestId("parceiro-cartao");
      await expect(aba).toContainText("Quem escanear cai na sua página na Viva e pede orçamento por lá. Contato sempre pela plataforma.");
      await expect(page.getByTestId("parceiro-gerar-cartao")).toBeEnabled();
      await page.getByTestId("parceiro-gerar-cartao").click();
      const painel = page.getByTestId("cartao-compartilhar");
      await expect(painel).toHaveAttribute("data-tipo", "partnercard", { timeout: 20_000 });
      curto = (await painel.getAttribute("data-curto")) ?? "";
      expect(curto).toMatch(/^[23456789ABCDEFGHJKMNPQRSTUVWXYZ]{10}$/);
      await expect.poll(() => page.getByTestId("cartao-previa").evaluate((i: HTMLImageElement) => i.naturalWidth), { timeout: 20_000 }).toBe(1080);
      await expect.poll(() => page.getByTestId("cartao-previa").evaluate((i: HTMLImageElement) => i.naturalHeight), { timeout: 20_000 }).toBe(1350);
      await expect.poll(() => page.getByTestId("cartao-previa-quadrado").evaluate((i: HTMLImageElement) => i.naturalHeight), { timeout: 20_000 }).toBe(1080);
      await expect(page.getByTestId("cartao-baixar")).toBeVisible();
      await expect(page.getByTestId("cartao-compartilhar-sistema")).toHaveText(/Compartilhar/);
      await expect(page.getByTestId("cartao-compartilhar-whatsapp")).toHaveCount(0);
      // Texto do parceiro sem contato nem vocabulário proibido.
      const texto = (await aba.innerText()).toLowerCase();
      for (const p of ["whatsapp", "telefone", "e-mail", "34999991234", "comissão", "aluguel", "intermedia"]) expect(texto, p).not.toContain(p);
      await semRolagemLateral(page);
      await page.screenshot({ path: `${SAIDA}/t239-painel-cartao-${largura}.png`, fullPage: true });
      if (largura === 390) {
        // Opt-in do nome (desligado por padrão).
        expect((await adm().from("cartoes_compartilhaveis").select("mostrar_nome").eq("curto", curto).single()).data!.mostrar_nome).toBe(false);
        await page.getByRole("switch", { name: "Mostrar meu nome no cartão" }).click();
        await expect.poll(async () => (await adm().from("cartoes_compartilhaveis").select("mostrar_nome").eq("curto", curto).single()).data!.mostrar_nome, { timeout: 15_000 }).toBe(true);
        // Sem Web Share API: copia o link.
        const antes = await contar("cards_shared");
        await page.evaluate(() => {
          Object.defineProperty(navigator, "canShare", { value: undefined, configurable: true });
          Object.defineProperty(navigator, "share", { value: undefined, configurable: true });
        });
        await page.getByTestId("cartao-compartilhar-sistema").click();
        await expect(page.getByTestId("cartao-msg")).toContainText(/Link copiado|Copie o link/, { timeout: 15_000 });
        await expect.poll(() => contar("cards_shared"), { timeout: 15_000 }).toBeGreaterThan(antes);
      }
      await page.context().close();
    }
    expect(await contar("cards_generated")).toBe(1); // um cartão por parceiro, não um por acesso
    const { data: linhas } = await adm().from("cartoes_compartilhaveis").select("tipo, parceiro_id, property_id").eq("usuario_id", ids.parc!);
    expect(linhas).toEqual([{ tipo: "partnercard", parceiro_id: ids.parceiro, property_id: null }]);
    await imagem(request, "retrato");
    await imagem(request, "quadrado");
  });

  test("2. URL do QR abre a página do parceiro e conta qr_scans e ref_partner_views; assinatura adulterada não conta", async ({ browser, request }) => {
    test.setTimeout(120_000);
    const r = await request.get(`/c/${curto}`, { maxRedirects: 0 });
    expect(r.status()).toBe(302);
    const link = new URL(r.headers()["location"]);
    const base = new URL(process.env.TESTES_BASE_URL ?? "http://localhost:3123");
    expect(link.host).toBe(base.host);
    expect(link.pathname).toBe(`/parceiros/${slug}`);
    expect(link.searchParams.get("utm_source")).toBe("cartao");
    expect(link.searchParams.get("utm_medium")).toBe("partnercard");
    expect(link.searchParams.get("utm_content")).toBe("link");
    expect(link.searchParams.get("ref")).toMatch(/^[23456789ABCDEFGHJKMNPQRSTUVWXYZ]{4}-[23456789ABCDEFGHJKMNPQRSTUVWXYZ]{4}$/);
    expect(link.searchParams.get("sig")).toMatch(/^[0-9a-f]{64}$/);
    // O QR é a mesma URL sem utm_content (a assinatura cobre ref + parceiro).
    const qr = new URL(link.toString());
    qr.searchParams.delete("utm_content");
    expect([...qr.searchParams.keys()]).toEqual(["ref", "utm_source", "utm_medium", "sig"]);
    urlQr = qr.toString();

    const visitar = async (url: string, largura = 390) => {
      const ctx = await browser.newContext({ storageState: { cookies: [], origins: [] }, viewport: { width: largura, height: largura === 390 ? 844 : 900 } });
      const page = await ctx.newPage();
      semDialogo(page);
      await page.goto(url.replace(link.origin, ""), { waitUntil: "domcontentloaded" });
      await expect(page.getByTestId("pagina-parceiro")).toHaveAttribute("data-slug", slug, { timeout: 20_000 });
      await expect(page.getByRole("heading", { level: 1 })).toContainText(nomePublico);
      return { ctx, page };
    };

    const scans0 = await contar("qr_scans");
    const views0 = await contar("ref_partner_views");
    for (const largura of [390, 1280]) {
      const { ctx, page } = await visitar(urlQr, largura);
      await expect.poll(() => page.url(), { timeout: 15_000 }).not.toContain("sig=");
      await expect.poll(async () => decodeURIComponent((await ctx.cookies()).find((c) => c.name === "vn_ref_parceiro")?.value ?? ""), { timeout: 15_000 }).toContain(`|${ids.parceiro}`);
      await semRolagemLateral(page);
      await page.screenshot({ path: `${SAIDA}/t239-parceiro-pelo-qr-${largura}.png`, fullPage: false });
      await ctx.close();
    }
    await expect.poll(() => contar("qr_scans"), { timeout: 15_000 }).toBe(scans0 + 2);
    await expect.poll(() => contar("ref_partner_views"), { timeout: 15_000 }).toBe(views0 + 2);

    // Adulterado: assinatura trocada → a página abre normal, sem cookie e sem contar.
    const ruim = new URL(urlQr);
    const sig = ruim.searchParams.get("sig")!;
    ruim.searchParams.set("sig", (sig[0] === "a" ? "b" : "a") + sig.slice(1));
    const { ctx, page } = await visitar(ruim.toString());
    await expect.poll(() => page.url(), { timeout: 15_000 }).not.toContain("sig=");
    await page.waitForTimeout(2000); // dá tempo da conferência no servidor responder
    expect((await ctx.cookies()).find((c) => c.name === "vn_ref_parceiro")).toBeUndefined();
    await ctx.close();
    await new Promise((res) => setTimeout(res, 1500));
    expect(await contar("qr_scans")).toBe(scans0 + 2);
    expect(await contar("ref_partner_views")).toBe(views0 + 2);
  });

  test("3. pedido com ref do cartão (simula o 31b) → ref_partner_requests 1×", async () => {
    const ref = new URL(urlQr).searchParams.get("ref")!;
    const antes = await contar("ref_partner_requests");
    const codigo = `VN-SV-T239${sufixo.slice(0, 4).toUpperCase()}`;
    // O 31b cria o pedido pelo servidor com atribuicaoDoPedidoParceiro(); aqui o adm() faz o papel dele.
    const { data: pedido, error } = await adm()
      .from("parceiro_pedidos")
      .insert({ codigo, parceiro_id: ids.parceiro, cliente_id: ids.cli, categoria: "fotografia", descricao: "Fotos do studio", ref_codigo: ref, ref_tipo: "partnercard" })
      .select("id, ref_tipo, ref_codigo")
      .single();
    expect(error).toBeNull();
    expect(pedido!.ref_tipo).toBe("partnercard");
    await expect.poll(() => contar("ref_partner_requests"), { timeout: 10_000 }).toBe(antes + 1);
    await adm().from("parceiro_pedidos").update({ status: "orcado", ref_codigo: ref, ref_tipo: "partnercard" }).eq("id", pedido!.id); // regravar não conta de novo
    expect(await contar("ref_partner_requests")).toBe(antes + 1);
    // Código que não é do parceiro não conta.
    const { error: e2 } = await adm()
      .from("parceiro_pedidos")
      .insert({ codigo: `VN-SV-T23Z${sufixo.slice(0, 4).toUpperCase()}`, parceiro_id: ids.parceiro, cliente_id: ids.cli, categoria: "fotografia", ref_codigo: "ZZZZ-ZZZZ", ref_tipo: "partnercard" });
    expect(e2).toBeNull();
    expect(await contar("ref_partner_requests")).toBe(antes + 1);
    await adm().from("parceiro_pedidos").delete().eq("codigo", `VN-SV-T23Z${sufixo.slice(0, 4).toUpperCase()}`);
  });

  test("4. admin vê 1 em 'Pedidos vindos de cartão' na linha do parceiro, com a fórmula", async ({ browser }) => {
    for (const largura of [390, 1280]) {
      const ctx = await browser.newContext({ storageState: authFile("admin"), viewport: { width: largura, height: largura === 390 ? 844 : 900 } });
      const page = await ctx.newPage();
      semDialogo(page);
      await page.goto("/admin/parceiros?aba=ativas", { waitUntil: "domcontentloaded" });
      await expect(page.getByTestId("admin-cartao-parceiro")).toContainText("Pedidos vindos de cartão", { timeout: 20_000 });
      await expect(page.getByTestId("admin-cartao-formula")).toContainText("ref_tipo = partnercard");
      await expect(page.getByTestId("admin-cartao-formula")).toContainText("Contas de teste (parceiro ou cliente) ficam fora dos totais.");
      const totalPedidos = Number(await page.getByTestId("admin-pedidos-cartao").innerText());
      expect(totalPedidos).toBeGreaterThanOrEqual(1);
      const linha = page.locator(`[data-testid="linha-ativa"][data-slug="${slug}"]`);
      await expect(linha.getByTestId("linha-pedidos-cartao")).toHaveText("1");
      await expect(linha.getByTestId("linha-cartoes-gerados")).toHaveText("1");
      await semRolagemLateral(page);
      await page.screenshot({ path: `${SAIDA}/t239-admin-${largura}.png`, fullPage: false });
      await ctx.close();
    }
  });

  test("5. sem página publicada: botão desabilitado com o motivo", async ({ browser }) => {
    for (const largura of [390, 1280]) {
      const page = await abrir(browser, rasc.email, largura);
      await page.goto("/dashboard/parceiro", { waitUntil: "domcontentloaded" });
      await expect(page.getByTestId("painel-parceiro")).toHaveAttribute("data-status", "rascunho", { timeout: 20_000 });
      await page.getByTestId("parceiro-aba-cartao").click();
      await expect(page.getByTestId("parceiro-gerar-cartao")).toBeDisabled();
      await expect(page.getByTestId("parceiro-cartao-motivo")).toHaveText("Publique sua página para gerar o cartão");
      await semRolagemLateral(page);
      await page.context().close();
    }
    const { count } = await adm().from("cartoes_compartilhaveis").select("id", { count: "exact", head: true }).eq("usuario_id", ids.rasc!);
    expect(count).toBe(0);
  });
});
