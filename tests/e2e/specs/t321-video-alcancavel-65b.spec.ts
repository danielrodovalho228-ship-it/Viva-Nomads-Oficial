import { test, expect, type Page } from "@playwright/test";
import { mkdtempSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { NO_LABORATORIO, adm, apagarContas, criarConta, criarImovelPronto, entrar, novaSenha, novoSufixo } from "../fixtures/laboratorio";
import { ANCORA_VIDEO_EDITOR } from "../../../src/lib/anuncio/prontidao";

/**
 * T321 — 65-B: o vídeo do anúncio alcançável pelo dono.
 *   1. "Para melhorar: Vídeo do imóvel" abre a seção Vídeo do editor; enviar MP4 de 10 s → "Vídeo enviado (00:10)" →
 *      salvar seção → recarregar → continua;
 *   2. página pública: miniatura acima da descrição + item da galeria; o <video> só recebe src depois do play e toca;
 *   3. trocar por um MOV → o anterior some do bucket; remover → some da página (nenhum bloco vazio);
 *   4. negativos com a mensagem certa: 70 s, 55 MB, .avi renomeado, sem duração legível e queda de rede (Tentar de novo);
 *   5. no assistente, o bloco de vídeo vem depois das fotos e ANTES da caixa da IA; "Para melhorar" do rascunho leva a ele.
 */
const SAIDA = "tests/laboratorio/saida";
const BUCKET = "anuncio-videos";
const VIDEOS = "tests/e2e/fixtures/videos";

const u32 = (n: number) => Buffer.from([(n >>> 24) & 255, (n >>> 16) & 255, (n >>> 8) & 255, n & 255]);
const caixa = (tipo: string, corpo: Buffer) => Buffer.concat([u32(8 + corpo.length), Buffer.from(tipo, "latin1"), corpo]);
const ftyp = () => caixa("ftyp", Buffer.concat([Buffer.from("isom"), u32(0), Buffer.from("isom")]));
/** MP4 mínimo (ftyp + moov/mvhd) com a duração pedida: o navegador e o servidor leem a duração do próprio arquivo. */
const mp4DeSegundos = (s: number) => Buffer.concat([ftyp(), caixa("moov", caixa("mvhd", Buffer.concat([Buffer.alloc(12), u32(1000), u32(s * 1000), Buffer.alloc(80)])))]);

test.describe("T321 — vídeo do anúncio alcançável pelo dono (65-B)", () => {
  test.skip(!NO_LABORATORIO, "Só no laboratório.");
  test.describe.configure({ mode: "serial", timeout: 240_000 });
  test.use({ actionTimeout: 20_000, navigationTimeout: 30_000 });

  const senha = novaSenha();
  const sufixo = novoSufixo();
  const dono = { email: `dono.t321.${sufixo}@lab.vivanomads.test`, nome: "Vera Vídeo", role: "owner" as const };
  const ids: Record<string, string> = {};

  const caminhoNoBanco = async (id: string) => (await adm().from("properties").select("video_arquivo").eq("id", id).single()).data?.video_arquivo ?? null;
  const arquivosNoBucket = async () => ((await adm().storage.from(BUCKET).list(ids.dono)).data ?? []).map((f) => `${ids.dono}/${f.name}`);
  const secao = (p: Page) => p.getByTestId("secao-video");
  const abrirEditor = async (p: Page) => {
    await p.goto(`/dashboard/imoveis/${ids.imovel}/editar#${ANCORA_VIDEO_EDITOR}`, { waitUntil: "domcontentloaded" });
    await expect(secao(p)).toHaveAttribute("data-aberta", "true", { timeout: 20_000 });
  };

  test.beforeAll(async () => {
    ids.dono = await criarConta(dono, senha);
    ids.imovel = await criarImovelPronto(ids.dono, `Vídeo t321 ${sufixo}`, { ativo: true });
    ids.rascunho = await criarImovelPronto(ids.dono, `Rascunho vídeo t321 ${sufixo}`);
  });

  test.afterAll(async () => {
    const restos = await arquivosNoBucket().catch(() => []);
    if (restos.length) await adm().storage.from(BUCKET).remove(restos);
    await apagarContas([ids.dono]);
  });

  test("1. 'Para melhorar' abre a seção Vídeo; enviar MP4 de 10 s, salvar e recarregar", async ({ browser }) => {
    const p = await entrar(browser, dono.email, senha);
    await p.setViewportSize({ width: 1280, height: 900 });
    await p.goto(`/dashboard/imoveis/${ids.imovel}/editar`, { waitUntil: "domcontentloaded" });
    await expect(secao(p)).toContainText("Sem vídeo (opcional)", { timeout: 20_000 });
    await expect(secao(p)).toHaveAttribute("data-aberta", "false");
    // O destino tem o campo: o link leva à seção, que abre com o enviador e o campo do link.
    await p.getByTestId("melhorar-video").click();
    await expect(secao(p)).toHaveAttribute("data-aberta", "true");
    await expect(secao(p).getByTestId("video-input")).toBeAttached();
    await expect(secao(p).getByTestId("video-link")).toBeVisible();
    await expect(secao(p).getByTestId("video-limites")).toHaveText("Até 60 segundos e 50 MB, em MP4 ou MOV. Grave pelo celular mostrando o imóvel por dentro. Sem pessoas no vídeo.");
    await expect(secao(p).getByTestId("video-ajuda")).toHaveAttribute("href", "/guias/como-por-um-video-no-anuncio");

    await secao(p).getByTestId("video-input").setInputFiles(join(VIDEOS, "casa-10s.mp4"));
    await expect(secao(p).getByTestId("video-enviado")).toHaveText("Vídeo enviado (00:10)", { timeout: 60_000 });
    await expect.poll(() => caminhoNoBanco(ids.imovel), { timeout: 20_000 }).toMatch(/-10s\.mp4$/);
    await secao(p).getByRole("button", { name: "Salvar seção" }).click();
    await expect(secao(p)).toContainText("Alterações salvas.", { timeout: 20_000 });
    await p.screenshot({ path: `${SAIDA}/t321-secao-video-1280.png`, fullPage: true });

    await p.reload({ waitUntil: "domcontentloaded" });
    await expect(secao(p)).toContainText("Vídeo enviado (00:10)", { timeout: 20_000 });
    ids.primeiro = (await caminhoNoBanco(ids.imovel))!;
    expect(await arquivosNoBucket()).toEqual([ids.primeiro]);
    await p.context().close();
  });

  test("2. página pública: miniatura + item da galeria; o vídeo só baixa depois do play e toca", async ({ browser }) => {
    for (const largura of [390, 1280]) {
      const ctx = await browser.newContext({ viewport: { width: largura, height: largura < 500 ? 844 : 900 } });
      const p = await ctx.newPage();
      await p.goto(`/imoveis/${ids.imovel}`, { waitUntil: "domcontentloaded" });
      await expect(p.getByTestId("video-arquivo-play")).toBeVisible({ timeout: 20_000 });
      // Nada baixa antes do play: não há <video> nem src.
      await expect(p.getByTestId("video-arquivo-player")).toHaveCount(0);
      // O vídeo também é peça da galeria e abre a janela própria.
      const galeria = p.getByTestId(largura < 768 ? "galeria-celular" : "galeria-mosaico");
      const peca = galeria.getByRole("button", { name: /^Tour em vídeo:/ });
      await expect(peca).toHaveCount(1);
      await p.screenshot({ path: `${SAIDA}/t321-publico-${largura}.png`, fullPage: true });
      await peca.click();
      await expect(p.getByTestId("video-modal")).toBeVisible();
      await p.keyboard.press("Escape");
      await expect(p.getByTestId("video-modal")).toHaveCount(0);

      await p.getByTestId("video-arquivo-play").click();
      const player = p.getByTestId("video-arquivo").getByTestId("video-arquivo-player");
      await expect(player).toHaveAttribute("src", /anuncio-videos/, { timeout: 20_000 });
      expect(await player.evaluate((v: HTMLVideoElement) => v.muted && v.controls)).toBe(true);
      await expect.poll(() => player.evaluate((v: HTMLVideoElement) => !v.error && v.readyState >= 2), { timeout: 20_000 }).toBe(true);
      await ctx.close();
    }
  });

  test("3. trocar por um MOV apaga o anterior do bucket; remover tira da página", async ({ browser }) => {
    const p = await entrar(browser, dono.email, senha);
    await p.setViewportSize({ width: 390, height: 844 });
    await abrirEditor(p);
    await secao(p).getByTestId("video-input").setInputFiles(join(VIDEOS, "casa-10s.mov"));
    await expect.poll(() => caminhoNoBanco(ids.imovel), { timeout: 60_000 }).toMatch(/-10s\.mov$/);
    const novo = (await caminhoNoBanco(ids.imovel))!;
    await expect.poll(arquivosNoBucket, { timeout: 20_000 }).toEqual([novo]);
    await p.screenshot({ path: `${SAIDA}/t321-trocar-390.png`, fullPage: true });

    await secao(p).getByTestId("video-remover").click();
    await expect.poll(() => caminhoNoBanco(ids.imovel), { timeout: 20_000 }).toBeNull();
    await expect.poll(arquivosNoBucket, { timeout: 20_000 }).toEqual([]);
    await expect(secao(p)).toContainText("Sem vídeo (opcional)");

    const pub = await browser.newPage();
    await pub.goto(`/imoveis/${ids.imovel}`, { waitUntil: "domcontentloaded" });
    await expect(pub.getByTestId("galeria-mosaico").or(pub.getByTestId("galeria-celular")).first()).toBeAttached({ timeout: 20_000 });
    await expect(pub.getByTestId("video-arquivo")).toHaveCount(0);
    await expect(pub.getByRole("button", { name: /^Tour em vídeo:/ })).toHaveCount(0);
    await pub.close();
    await p.context().close();
  });

  test("4. negativos: 70 s, 55 MB, .avi renomeado, sem duração e queda de rede com 'Tentar de novo'", async ({ browser }) => {
    const p = await entrar(browser, dono.email, senha);
    await p.setViewportSize({ width: 1280, height: 900 });
    await abrirEditor(p);
    const entrada = secao(p).getByTestId("video-input");
    const erro = secao(p).getByTestId("video-erro");

    await entrada.setInputFiles({ name: "longo.mp4", mimeType: "video/mp4", buffer: mp4DeSegundos(70) });
    await expect(erro).toHaveText("O vídeo deve ter no máximo 60 segundos.");
    // 55 MB: grande demais para buffer em memória do Playwright; vai por arquivo temporário.
    const pasta = mkdtempSync(join(tmpdir(), "t321-"));
    const grande = join(pasta, "grande.mp4");
    writeFileSync(grande, Buffer.concat([readFileSync(join(VIDEOS, "casa-10s.mp4")), Buffer.alloc(55 * 1024 * 1024)]));
    await entrada.setInputFiles(grande);
    await expect(erro).toHaveText("O vídeo deve ter no máximo 50 MB.");
    const avi = Buffer.concat([Buffer.from("RIFF"), u32(0), Buffer.from("AVI LIST"), Buffer.alloc(4096)]);
    await entrada.setInputFiles({ name: "casa.mp4", mimeType: "video/mp4", buffer: avi });
    await expect(erro).toHaveText("Envie o vídeo em MP4 ou MOV.");
    await entrada.setInputFiles({ name: "sem-duracao.mp4", mimeType: "video/mp4", buffer: ftyp() });
    await expect(erro).toContainText("Não conseguimos ler a duração do vídeo");
    await expect(secao(p).getByTestId("video-enviado")).toHaveCount(0);
    await expect(secao(p).getByTestId("video-tentar-de-novo")).toHaveCount(0);

    // Queda de rede no meio do envio: mensagem + "Tentar de novo"; nada gravado.
    await p.route(`**/storage/v1/object/${BUCKET}/**`, (r) => r.abort("connectionreset"));
    await entrada.setInputFiles(join(VIDEOS, "casa-10s.mp4"));
    await expect(erro).toHaveText("A conexão caiu durante o envio. Nada foi gravado.", { timeout: 30_000 });
    expect(await caminhoNoBanco(ids.imovel)).toBeNull();
    expect(await arquivosNoBucket()).toEqual([]);
    await p.screenshot({ path: `${SAIDA}/t321-queda-de-rede-1280.png`, fullPage: true });
    await p.unroute(`**/storage/v1/object/${BUCKET}/**`);
    await secao(p).getByTestId("video-tentar-de-novo").click();
    await expect(secao(p).getByTestId("video-enviado")).toHaveText("Vídeo enviado (00:10)", { timeout: 60_000 });
    await expect.poll(() => caminhoNoBanco(ids.imovel), { timeout: 20_000 }).toMatch(/-10s\.mp4$/);
    await p.context().close();
  });

  test("5. assistente: o bloco de vídeo vem antes da caixa da IA; 'Para melhorar' do rascunho leva a ele", async ({ browser }) => {
    const p = await entrar(browser, dono.email, senha);
    await p.setViewportSize({ width: 390, height: 844 });
    await p.goto("/dashboard/imoveis", { waitUntil: "domcontentloaded" });
    const link = p.getByTestId("melhorar-video");
    // O link usa o ID do passo Fotos: 1 nos 10 passos (era 2 nos 6 passos).
    await expect(link).toHaveAttribute("href", `/dashboard/imoveis/novo?draft=${ids.rascunho}&etapa=1#bloco-video`, { timeout: 20_000 });
    await link.click();
    const bloco = p.getByTestId("bloco-video");
    await expect(bloco).toBeVisible({ timeout: 30_000 });
    await expect(bloco.getByTestId("video-input")).toBeAttached();
    await expect(bloco.getByTestId("video-link")).toBeVisible();
    const yBloco = (await bloco.boundingBox())!.y;
    const yIa = (await p.getByTestId("ia-fotos").boundingBox())!.y;
    expect(yBloco).toBeLessThan(yIa);
    await p.screenshot({ path: `${SAIDA}/t321-assistente-390.png`, fullPage: true });
    // O link antigo misturado com as fotos saiu.
    await expect(p.getByText("Link do vídeo do imóvel")).toHaveCount(0);
    await p.context().close();
  });
});
