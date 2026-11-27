import { test, expect, type BrowserContext, type Page, type Response } from "@playwright/test";
import { randomBytes } from "node:crypto";
import { readFileSync } from "node:fs";
import { authFile } from "../fixtures/auth";
import { hasAccount } from "../fixtures/accounts";
import { NO_LABORATORIO, adm, apagarContas, cnpjAleatorio, criarConta, criarImovelPronto, entrar, fotosReais, novaSenha, novoSufixo } from "../fixtures/laboratorio";

/*
  T1740 — E1095 @E1095 @seguranca (ORDEM-DUET-501): a política de conteúdo (CSP) APLICADA não bloqueia nada nas telas
  COM SESSÃO. A t49 cobre as páginas públicas; aqui, um caso por superfície, com a política que a própria tela recebe:
   1. Página do imóvel, com sessão: o mapa e o vídeo. A galeria e o mapa carregam; o vídeo abre no quadro do YouTube; e
      os pedidos que o mapa e a medição de internet fazem em produção passam pela política — o trabalhador do Mapbox
      (worker de blob:), os pedidos à Mapbox (estilo, peças, eventos), as peças da CARTO (imagem), a imagem de blob:, o
      quadro do Vimeo e a medição na Cloudflare.
   2. Painel do parceiro (o painel e a avaliação de imóveis), com a foto de perfil vinda do armazenamento.
   3. Vista de PDF do admin: o documento do imóvel abre no quadro, vindo do armazenamento.
  Em cada caso: a tela chega com `Content-Security-Policy` (aplicada), o recurso chega de verdade ao navegador (não
  basta não haver aviso) e o navegador não regista nenhuma violação (evento `securitypolicyviolation` e console).

  Sobre o mapa: o laboratório constrói SEM as chaves do mapa (como as fatias do noturno), por isso o motor não pede
  peças aqui. O caso 1 faz, dentro da página do imóvel e sob a política dela, os mesmos tipos de pedido que o motor faz
  em produção. Num build com as chaves o motor de verdade corre sob o mesmo ouvido: o caso confere que os pedidos dele
  saíram. Nada sai do laboratório: os serviços de fora são respondidos aqui (page.route), e um pedido que a política
  bloqueia nem chega a essa resposta — é assim que o caso sabe que o pedido passou.
  Massa própria, só contas de teste. Laboratório; não é prova ao vivo no site.
*/
const senha = novaSenha();
const sufixo = novoSufixo();
// O nome leva o sufixo da corrida: a fila do admin acha o cartão deste dono, e só o dele.
const dono = { email: `dono.t1740.${sufixo}@lab.vivanomads.test`, nome: `Dora Política ${sufixo}`, role: "owner" as const };
const morador = { email: `morador.t1740.${sufixo}@lab.vivanomads.test`, nome: "Mauro Política", role: "tenant" as const };
const parceiro = { email: `parceiro.t1740.${sufixo}@lab.vivanomads.test`, nome: "Paulo Teste Parceiro", role: "tenant" as const };
const ids: Record<string, string> = {};
const CIDADE = "Uberaba";
const VIDEO = "https://youtu.be/dQw4w9WgXcQ";
const PNG_1X1 = Buffer.from("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==", "base64");
/** O documento fictício do laboratório (tests/fixtures), com bytes próprios a cada corrida. */
const pdfDeTeste = () => Buffer.concat([readFileSync("tests/fixtures/matricula-ficticia-dono.pdf"), Buffer.from(`% ${randomBytes(8).toString("hex")}\n`)]);

/** Liga o ouvido da política em todas as páginas e quadros do contexto: cada violação vira uma linha no console. */
async function ouvirPolitica(ctx: BrowserContext): Promise<void> {
  await ctx.addInitScript(() => {
    document.addEventListener("securitypolicyviolation", (e) => {
      console.log(["CSPV", e.disposition, e.effectiveDirective, e.blockedURI].join("|"));
    });
  });
}
/** As violações que o navegador registou nesta página: o evento da política e os avisos de bloqueio do console. */
function violacoesDe(page: Page): string[] {
  const achadas: string[] = [];
  page.on("console", (m) => {
    const t = m.text();
    if (t.startsWith("CSPV|")) achadas.push(t.slice(5));
    else if (/Content Security Policy/i.test(t)) achadas.push(`console: ${t.slice(0, 220)}`);
  });
  return achadas;
}
/** A tela chegou com a política APLICADA (e não só observada). Sem isto, "nenhuma violação" não provaria nada. */
function conferirPoliticaAplicada(r: Response | null, rota: string): void {
  const h = r?.headers() ?? {};
  expect(h["content-security-policy"], `${rota}: a tela chega com a política aplicada`).toBeTruthy();
  expect(h["content-security-policy-report-only"], `${rota}: sem o cabeçalho de observação`).toBeUndefined();
}
/** Responde aqui pelo serviço de fora (nada sai do laboratório) e conta os pedidos que o navegador DEIXOU sair. */
async function simular(page: Page, padrao: RegExp, resposta: { contentType: string; body: string | Buffer; status?: number }): Promise<{ pedidos: number }> {
  const conta = { pedidos: 0 };
  await page.route(padrao, (r) => {
    conta.pedidos += 1;
    return r.fulfill({ status: resposta.status ?? 200, contentType: resposta.contentType, body: resposta.body, headers: { "access-control-allow-origin": "*" } });
  });
  return conta;
}
/** Rola a tela até o fim (o que carrega ao aparecer pede os seus recursos) e espera a rede sossegar. */
async function rolarAteOFim(page: Page): Promise<void> {
  await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
  await page.waitForLoadState("networkidle", { timeout: 10_000 }).catch(() => undefined);
  await page.evaluate(() => window.scrollTo(0, 0));
}

test.describe("T1740 — E1095: a política aplicada não bloqueia nada nas telas com sessão @E1095 @seguranca", () => {
  test.skip(!NO_LABORATORIO, "Só no laboratório.");
  // Modo "default" de propósito: os três casos correm no mesmo trabalhador, sobre a mesma massa (uma só semeadura,
  // mesmo com o paralelismo do portão), e são independentes — uma política que parta uma superfície deixa as outras
  // correrem, e é isso que mostra qual partiu. (Em série, a primeira falha calaria as seguintes.)
  test.describe.configure({ mode: "default", timeout: 180_000 });

  test.beforeAll(async () => {
    ids.dono = await criarConta(dono, senha);
    ids.morador = await criarConta(morador, senha);
    ids.parceiro = await criarConta(parceiro, senha);

    // 1. Um anúncio ativo, com fotos de verdade e um vídeo por link já aprovado pela equipe (E133: só então aparece).
    ids.imovel = await criarImovelPronto(ids.dono, `[TESTE QA] t1740 Casa da política ${sufixo}`, { ativo: true });
    await fotosReais(ids.imovel, ids.dono);
    const v = await adm().from("properties").update({ video_url: VIDEO }).eq("id", ids.imovel);
    if (v.error) throw v.error;
    const { data: admin } = await adm().from("profiles").select("id").eq("role", "admin").limit(1).maybeSingle();
    const m = await adm()
      .from("moderacao_log")
      .insert({ admin_id: (admin?.id as string | undefined) ?? ids.dono, acao: "aprovar_video_link", alvo_tipo: "video_link", alvo_id: ids.imovel, motivo: VIDEO });
    if (m.error) throw m.error;

    // 2. Um parceiro que também é avaliador ativo, com a foto de perfil no armazenamento (a que a pessoa envia em Conta).
    const { data: parc, error } = await adm()
      .from("parceiros")
      .insert({ user_id: ids.parceiro, tipo_pessoa: "pj", documento: cnpjAleatorio(), nome_publico: `[TESTE QA] ${parceiro.nome} ${sufixo}`, slug: `parceiro-t1740-${sufixo}`, categorias: ["fotografia"], cidades: [CIDADE] })
      .select("id")
      .single();
    if (error) throw error;
    ids.parc = parc.id as string;
    const { data: n } = await adm().rpc("proximo_numero_avaliador", { p_sigla: "UDI" });
    const { data: c, error: e2 } = await adm()
      .from("avaliadores_credenciamento")
      .insert({ parceiro_id: parc.id, cidade: CIDADE, numero_credenciado: n, status: "ativo", experiencia_link: "https://portfolio.lab.vivanomads.test/t1740", conduta_versao: "2026-10-23", ativado_em: "2025-01-01T00:00:00Z" })
      .select("id")
      .single();
    if (e2) throw e2;
    ids.cred = c.id as string;
    const up = await adm().storage.from("avatars").upload(`${ids.parceiro}/avatar.webp`, readFileSync("public/images/home/persona-saude.webp"), { contentType: "image/webp", upsert: true });
    if (up.error) throw up.error;
    const av = await adm().from("profiles").update({ avatar_url: `${ids.parceiro}/avatar.webp` }).eq("id", ids.parceiro);
    if (av.error) throw av.error;

    // 3. Um documento do imóvel em PDF, à espera da conferência do admin (a fila de /admin/documentos).
    ids.documento = `${ids.dono}/${randomBytes(6).toString("hex")}.pdf`;
    const doc = await adm().storage.from("property-docs").upload(ids.documento, pdfDeTeste(), { contentType: "application/pdf" });
    if (doc.error) throw doc.error;
    const q = await adm().from("qualification_checklists").insert({
      owner_id: ids.dono, property_id: ids.imovel, document_path: ids.documento, document_status: "pending",
      document_hash_sha256: randomBytes(32).toString("hex"), document_uploaded_at: new Date().toISOString(),
      formulario: { versao: 1, elig: { titularDocumento: dono.nome } },
    });
    if (q.error) throw q.error;
  });

  test.afterAll(async () => {
    if (ids.imovel) await adm().from("moderacao_log").delete().eq("alvo_id", ids.imovel);
    if (ids.dono) await adm().from("qualification_checklists").delete().eq("owner_id", ids.dono);
    if (ids.documento) await adm().storage.from("property-docs").remove([ids.documento]);
    if (ids.parceiro) await adm().storage.from("avatars").remove([`${ids.parceiro}/avatar.webp`]);
    if (ids.cred) await adm().from("avaliadores_credenciamento").delete().eq("id", ids.cred);
    if (ids.parc) await adm().from("parceiros").delete().eq("id", ids.parc);
    await apagarContas([ids.dono, ids.morador, ids.parceiro].filter(Boolean));
  });

  test("1. página do imóvel, com sessão: o mapa e o vídeo carregam e a política não bloqueia o que eles pedem", async ({ browser }) => {
    const p = await entrar(browser, morador.email, senha);
    await p.setViewportSize({ width: 1280, height: 900 });
    await ouvirPolitica(p.context());
    const violacoes = violacoesDe(p);
    // Os serviços de fora, respondidos aqui. Cada um conta os pedidos que a política deixou sair.
    const video = "<!doctype html><title>Vídeo simulado</title><p>Vídeo simulado do laboratório</p>";
    const youtube = await simular(p, /^https:\/\/www\.youtube\.com\//, { contentType: "text/html; charset=utf-8", body: video });
    const vimeo = await simular(p, /^https:\/\/player\.vimeo\.com\//, { contentType: "text/html; charset=utf-8", body: video });
    const carto = await simular(p, /^https:\/\/basemaps\.cartocdn\.com\//, { contentType: "image/png", body: PNG_1X1 });
    const mapbox = await simular(p, /^https:\/\/api\.mapbox\.com\//, { contentType: "application/json", body: JSON.stringify({ version: 8, sources: {}, layers: [] }) });
    const eventos = await simular(p, /^https:\/\/events\.mapbox\.com\//, { contentType: "text/plain", body: "", status: 204 });
    const cloudflare = await simular(p, /^https:\/\/speed\.cloudflare\.com\//, { contentType: "application/octet-stream", body: Buffer.alloc(1000) });

    const rota = `/imoveis/${ids.imovel}`;
    conferirPoliticaAplicada(await p.goto(rota, { waitUntil: "domcontentloaded" }), rota);

    // A galeria: as fotos do armazenamento chegam (a capa carregou de verdade).
    const galeria = p.getByTestId("galeria-mosaico");
    await expect(galeria.getByTestId("galeria-tile-1")).toHaveAttribute("data-item", "video", { timeout: 30_000 });
    await expect.poll(() => galeria.getByTestId("galeria-tile-0").locator("img").first().evaluate((el: HTMLImageElement) => el.complete && el.naturalWidth > 0), { timeout: 20_000 }).toBe(true);

    // O mapa: o motor que este build tem sobe sem bloqueio. Com as chaves, os pedidos dele saem (Mapbox ou CARTO).
    const quadroDoMapa = p.locator('[data-testid="mapa-imovel"], .mapboxgl-map').first();
    await quadroDoMapa.scrollIntoViewIfNeeded({ timeout: 30_000 });
    await expect(quadroDoMapa).toBeVisible();
    let motor = "Leaflet sem chave de mapa (nenhuma peça pedida)";
    if ((await p.locator(".mapboxgl-map").count()) > 0) {
      await expect.poll(() => mapbox.pedidos, { timeout: 20_000, message: "o Mapbox pediu o estilo e o pedido saiu" }).toBeGreaterThan(0);
      await expect(p.locator(".mapboxgl-canvas").first()).toBeVisible({ timeout: 20_000 });
      motor = `Mapbox GL (${mapbox.pedidos} pedidos à Mapbox)`;
    } else {
      await expect(p.locator(".leaflet-container").first()).toBeVisible({ timeout: 20_000 });
      if ((await quadroDoMapa.getAttribute("data-mapa-base")) === "carto") {
        await expect.poll(() => carto.pedidos, { timeout: 20_000, message: "as peças da CARTO foram pedidas e os pedidos saíram" }).toBeGreaterThan(0);
        await expect(p.locator(".leaflet-tile-loaded").first()).toBeAttached({ timeout: 20_000 });
        motor = `Leaflet + CARTO (${carto.pedidos} peças pedidas)`;
      }
    }
    // Fica no relato da corrida qual motor este build tinha (as fatias do laboratório constroem sem as chaves).
    test.info().annotations.push({ type: "motor do mapa", description: motor });
    console.log(`T1740: motor do mapa neste build: ${motor}`);

    // O que o mapa e a medição de internet pedem ao navegador em produção, feito aqui dentro, sob a política desta tela.
    const antes = { mapbox: mapbox.pedidos, eventos: eventos.pedidos, carto: carto.pedidos, cloudflare: cloudflare.pedidos };
    const pedidos = await p.evaluate(async (pngBase64) => {
      const ate = <T,>(promessa: Promise<T>, ms = 8000) => Promise.race([promessa, new Promise<string>((ok) => setTimeout(() => ok("sem resposta"), ms))]);
      const buscar = (url: string, init?: RequestInit) => fetch(url, init).then((r) => (r.status < 400 ? "ok" : `http ${r.status}`)).catch((e) => `falhou: ${String(e)}`);
      const imagem = (src: string) =>
        new Promise<string>((ok) => {
          const img = new Image();
          img.onload = () => ok("ok");
          img.onerror = () => ok("falhou");
          img.src = src;
        });
      const bytes = Uint8Array.from(atob(pngBase64), (c) => c.charCodeAt(0));
      return {
        // O Mapbox GL corre o desenho das peças num trabalhador criado de um blob:.
        trabalhadorDeBlob: await ate(
          new Promise<string>((ok) => {
            try {
              const w = new Worker(URL.createObjectURL(new Blob(["self.onmessage = () => self.postMessage('vivo');"], { type: "text/javascript" })));
              w.onmessage = () => {
                w.terminate();
                ok("ok");
              };
              w.onerror = (e) => ok(`falhou: ${e.message}`);
              w.postMessage("ping");
            } catch (e) {
              ok(`falhou: ${String(e)}`);
            }
          }),
        ),
        mapboxEstilo: await ate(buscar("https://api.mapbox.com/styles/v1/mapbox/light-v11?access_token=pk.laboratorio")),
        mapboxPecas: await ate(buscar("https://api.mapbox.com/v4/mapbox.mapbox-streets-v8/13/3000/4500.vector.pbf?access_token=pk.laboratorio")),
        mapboxEventos: await ate(buscar("https://events.mapbox.com/events/v2?access_token=pk.laboratorio", { method: "POST", body: "[]" })),
        // O Leaflet põe cada peça da CARTO numa <img>.
        cartoPeca: await ate(imagem("https://basemaps.cartocdn.com/rastertiles/voyager/13/3000/4500.png?key=laboratorio")),
        // As imagens que o Mapbox monta a partir das peças entram por blob:.
        imagemDeBlob: await ate(imagem(URL.createObjectURL(new Blob([bytes], { type: "image/png" })))),
        // A medição de internet do anúncio baixa e envia para a Cloudflare.
        medicaoBaixa: await ate(buscar("https://speed.cloudflare.com/__down?bytes=1000")),
        medicaoEnvia: await ate(buscar("https://speed.cloudflare.com/__up", { method: "POST", body: "0".repeat(1000) })),
      };
    }, PNG_1X1.toString("base64"));
    expect(pedidos, "cada pedido do mapa e da medição passa pela política").toEqual({
      trabalhadorDeBlob: "ok", mapboxEstilo: "ok", mapboxPecas: "ok", mapboxEventos: "ok", cartoPeca: "ok", imagemDeBlob: "ok", medicaoBaixa: "ok", medicaoEnvia: "ok",
    });
    // E saíram mesmo do navegador (um pedido bloqueado pela política não chega à resposta simulada).
    expect(mapbox.pedidos - antes.mapbox, "os dois pedidos à Mapbox saíram").toBe(2);
    expect(eventos.pedidos - antes.eventos, "o pedido de eventos saiu").toBe(1);
    expect(carto.pedidos - antes.carto, "a peça da CARTO saiu").toBe(1);
    expect(cloudflare.pedidos - antes.cloudflare, "os dois pedidos da medição saíram").toBe(2);

    // O vídeo: abre no quadro do YouTube, e o quadro carrega (um quadro bloqueado fica vazio).
    await galeria.getByTestId("galeria-tile-1").scrollIntoViewIfNeeded();
    await galeria.getByTestId("galeria-tile-1").click();
    const janela = p.getByTestId("video-modal");
    await expect(janela).toBeVisible({ timeout: 15_000 });
    await expect(janela.locator("iframe")).toHaveAttribute("src", /^https:\/\/www\.youtube\.com\/embed\//);
    await expect(janela.frameLocator("iframe").getByText("Vídeo simulado do laboratório")).toBeVisible({ timeout: 15_000 });
    expect(youtube.pedidos, "o quadro do YouTube foi pedido").toBeGreaterThan(0);
    await p.keyboard.press("Escape");
    await expect(janela).toHaveCount(0, { timeout: 10_000 });
    // O outro provedor de vídeo que o anúncio aceita (Vimeo), num quadro posto na mesma tela.
    await p.evaluate(() => {
      const f = document.createElement("iframe");
      f.id = "t1740-vimeo";
      f.src = "https://player.vimeo.com/video/1";
      document.body.appendChild(f);
    });
    await expect(p.frameLocator("#t1740-vimeo").getByText("Vídeo simulado do laboratório")).toBeVisible({ timeout: 15_000 });
    expect(vimeo.pedidos, "o quadro do Vimeo foi pedido").toBeGreaterThan(0);

    await rolarAteOFim(p);
    expect(violacoes, "a política bloqueou algo que a página do imóvel usa").toEqual([]);
    await p.context().close();
  });

  test("2. painel do parceiro: o painel e a avaliação de imóveis carregam, com a foto do armazenamento, sem violação", async ({ browser }) => {
    const p = await entrar(browser, parceiro.email, senha);
    await p.setViewportSize({ width: 1280, height: 900 });
    await ouvirPolitica(p.context());
    const violacoes = violacoesDe(p);

    // O painel do parceiro: a casca, os pedidos e a Agenda (o calendário é um componente de cliente).
    conferirPoliticaAplicada(await p.goto("/dashboard/parceiro", { waitUntil: "domcontentloaded" }), "/dashboard/parceiro");
    await expect(p.getByTestId("parceiro-agenda").getByTestId("parceiro-agenda-calendario")).toBeVisible({ timeout: 30_000 });
    await rolarAteOFim(p);

    // A avaliação de imóveis: o painel do avaliador, com a foto de perfil vinda do armazenamento.
    conferirPoliticaAplicada(await p.goto("/dashboard/parceiro/avaliacao", { waitUntil: "domcontentloaded" }), "/dashboard/parceiro/avaliacao");
    const foto = p.getByTestId("painel-avaliador").getByTestId("painel-foto");
    await expect(foto).toHaveAttribute("data-foto", "sim", { timeout: 30_000 });
    await expect.poll(() => foto.locator("img").evaluate((el: HTMLImageElement) => el.complete && el.naturalWidth > 0), { timeout: 20_000, message: "a foto do armazenamento carregou" }).toBe(true);
    await rolarAteOFim(p);

    expect(violacoes, "a política bloqueou algo que o painel do parceiro usa").toEqual([]);
    await p.context().close();
  });

  test.describe("admin", () => {
    test.skip(!hasAccount("admin"), "conta admin do laboratório não configurada");
    test.use({ storageState: authFile("admin") });

    test("3. vista de PDF do admin: o documento do imóvel abre no quadro, vindo do armazenamento, sem violação", async ({ page }) => {
      await page.setViewportSize({ width: 1280, height: 900 });
      await ouvirPolitica(page.context());
      const violacoes = violacoesDe(page);
      // O PDF sai do armazenamento por um endereço assinado; a resposta tem de chegar ao navegador.
      const respostasDoPdf: number[] = [];
      page.on("response", (r) => {
        if (r.url().includes("/storage/v1/object/sign/property-docs/") && r.url().includes(encodeURIComponent(ids.documento).replace(/%2F/g, "/"))) respostasDoPdf.push(r.status());
      });

      conferirPoliticaAplicada(await page.goto("/admin/documentos", { waitUntil: "domcontentloaded" }), "/admin/documentos");
      await expect(page.getByTestId("conferencia-contadores")).toBeVisible({ timeout: 30_000 });
      const cartao = page.getByTestId("doc-card").filter({ hasText: dono.nome });
      await expect(cartao, "o documento da massa está na fila").toHaveCount(1, { timeout: 20_000 });
      const quadro = cartao.locator('iframe[title="Documento do imóvel (PDF)"]');
      await quadro.scrollIntoViewIfNeeded();
      await expect(quadro).toBeVisible();
      const src = (await quadro.getAttribute("src")) ?? "";
      expect(src, "o quadro aponta para o armazenamento, por endereço assinado").toContain("/storage/v1/object/sign/property-docs/");
      await expect.poll(() => respostasDoPdf, { timeout: 20_000, message: "o PDF chegou ao navegador (um quadro bloqueado não faz o pedido)" }).toContain(200);
      await page.waitForLoadState("networkidle", { timeout: 10_000 }).catch(() => undefined);

      expect(violacoes, "a política bloqueou algo que a vista de PDF do admin usa").toEqual([]);
    });
  });
});
