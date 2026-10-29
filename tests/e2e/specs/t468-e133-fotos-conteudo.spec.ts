// Portão pós-#1506/#1507 (Pista C, 29/10): E180 (entrada do anúncio novo, cópia local) e E222-B (renovar = aditivo); roda no lab-crítico deste PR.
import { test, expect, type Page } from "@playwright/test";
import { join } from "node:path";
import { NO_LABORATORIO, adm, apagarContas, criarConta, criarImovelPronto, entrar, novaSenha, novoSufixo } from "../fixtures/laboratorio";
import { authFile } from "../fixtures/auth";
import { FOTOS_TESTE_MINIMO, noPasso, abrirCadastroNovo } from "../fixtures/cadastro";

/*
  T468 — E133: o Passo 2 (Fotos) não aceita qualquer imagem. Só no laboratório (a conferência usa a medida local de
  tela no lugar do modelo; o link do vídeo usa a resposta fixa do oEmbed).
   1. Abaixo de 8 fotos o "Continuar" fica desabilitado de verdade (visual e clique), com a contagem.
   2. Foto-print: aviso forte junto da foto, não vira a principal, e o passo não avança (nem depois de recarregar o
      rascunho) até o dono remover ou confirmar; confirmada, avança.
   3. Vídeo arbitrário (quadros sintéticos) é sinalizado e trava até confirmar.
   4. Link: formato errado, vídeo que não existe e vídeo que não pode ser incorporado são recusados com mensagem clara;
      o link válido fica pendente — o anúncio não mostra o vídeo até o admin aprovar.
*/
const SAIDA = "tests/laboratorio/saida";
const PRINT = "docs/capturas/e44/exportar-1280.png";
const VIDEO = join("tests/e2e/fixtures/videos", "casa-10s.mp4");
const senha = novaSenha();
const sufixo = novoSufixo();
const dono = { email: `dono.t468.${sufixo}@lab.vivanomads.test`, nome: "Dalva Fotos", role: "owner" as const };
const ids: Record<string, string> = {};

const continuar = (p: Page) => p.getByTestId("cadastro-continuar");
const enviar = (p: Page, arquivos: string | string[]) => p.getByTestId("etapa-fotos").locator('input[type="file"]').first().setInputFiles(arquivos);

async function semRolagemLateral(p: Page) {
  expect(await p.evaluate(() => document.documentElement.scrollWidth - window.innerWidth)).toBeLessThanOrEqual(1);
}

async function abrirPassoFotos(p: Page) {
  await abrirCadastroNovo(p, "domcontentloaded");
  const aviso = p.getByTestId("rascunho-aviso");
  const tipo = p.getByTestId("passo-titulo");
  await expect(tipo.or(aviso).first()).toBeVisible({ timeout: 30_000 });
  if (await aviso.isVisible()) await aviso.getByRole("button", { name: "Começar outro" }).click();
  await noPasso(p, "tipo");
  await continuar(p).click();
  await noPasso(p, "fotos");
}

test.describe("T468 — E133: fotos, vídeo e link que não mostram o imóvel", () => {
  test.skip(!NO_LABORATORIO, "Só no laboratório.");
  test.describe.configure({ mode: "serial", timeout: 240_000 });

  test.beforeAll(async () => {
    ids.dono = await criarConta(dono, senha);
    await adm().from("profiles").update({ is_teste: true }).eq("id", ids.dono);
  });

  test.afterAll(async () => {
    if (ids.comLink) await adm().from("moderacao_log").delete().eq("alvo_id", ids.comLink);
    await apagarContas([ids.dono]);
  });

  for (const w of [390, 1280] as const) {
    test(`1–3. a ${w} px: mínimo de 8, foto-print e vídeo sinalizado travam o Passo 2`, async ({ browser }) => {
      const p = await entrar(browser, dono.email, senha);
      await p.setViewportSize({ width: w, height: w === 390 ? 844 : 900 });
      await abrirPassoFotos(p);

      // 1. Sem foto e com 1 foto: desabilitado, a contagem explica; o clique não avança.
      await expect(continuar(p)).toBeDisabled();
      await enviar(p, [PRINT, FOTOS_TESTE_MINIMO[0]]);
      await expect(p.getByText(/^2\/40 fotos/)).toBeVisible({ timeout: 60_000 });
      await expect(p.getByTestId("fotos-trava")).toHaveAttribute("data-trava", "faltam");
      await expect(p.getByTestId("fotos-trava")).toHaveText("Faltam 6 fotos para continuar (mínimo de 8).");
      await expect(continuar(p)).toBeDisabled();
      await continuar(p).click({ force: true });
      await noPasso(p, "fotos");

      // 2. O print é sinalizado junto da foto e NÃO é a principal (a foto do imóvel foi para a frente).
      const sinalizada = p.locator('[data-nao-imovel="1"]');
      await expect(sinalizada).toHaveCount(1);
      await expect(p.getByTestId("aviso-foto-nao-imovel")).toContainText("Esta foto não parece ser do imóvel.");
      await expect(p.getByTestId("foto-principal").locator('[data-nao-imovel="1"]')).toHaveCount(0);
      await expect(p.getByTestId("foto-miniatura").filter({ has: sinalizada }).getByRole("button", { name: "Usar como foto principal" })).toHaveCount(0);
      await p.screenshot({ path: `${SAIDA}/t468-print-sinalizado-${w}.png`, fullPage: true });

      // Com 8 fotos do imóvel + o print: ainda desabilitado por causa do print.
      await enviar(p, FOTOS_TESTE_MINIMO.slice(1));
      await expect(p.getByText(/^9\/40 fotos/)).toBeVisible({ timeout: 60_000 });
      await expect(p.getByTestId("fotos-trava")).toHaveAttribute("data-trava", "sinalizadas");
      await expect(continuar(p)).toBeDisabled();

      // O rascunho guarda o aviso: recarregado, continua travado.
      await expect(p).toHaveURL(/draft=/, { timeout: 30_000 });
      // Autosave (debounce de 2 s): espera o "Salvo" das 9 fotos antes de recarregar.
      await p.waitForTimeout(2_500);
      await expect(p.getByText("Salvando…")).toHaveCount(0, { timeout: 15_000 });
      await expect(p.getByText(/Salvo/).first()).toBeVisible({ timeout: 15_000 });
      await p.reload({ waitUntil: "domcontentloaded" });
      await noPasso(p, "fotos", 30_000);
      await expect(p.getByText(/^9\/40 fotos/)).toBeVisible({ timeout: 30_000 });
      await expect(p.getByTestId("aviso-foto-nao-imovel")).toBeVisible({ timeout: 30_000 });
      await expect(continuar(p)).toBeDisabled();

      // 3. Vídeo de quadros sintéticos: sinalizado; com o print confirmado, a trava passa a ser o vídeo.
      await p.getByTestId("foto-nao-imovel-confirmar").click();
      await p.getByTestId("foto-nao-imovel-confirmar-confirmar").click();
      await expect(p.getByTestId("foto-conteudo-confirmada")).toBeVisible();
      await expect(continuar(p)).toBeEnabled();
      await p.getByTestId("video-input").setInputFiles(VIDEO);
      await expect(p.getByTestId("aviso-video-nao-imovel")).toBeVisible({ timeout: 60_000 });
      await expect(p.getByTestId("fotos-trava")).toHaveAttribute("data-trava", "video");
      await expect(continuar(p)).toBeDisabled();
      await p.getByTestId("aviso-video-nao-imovel").scrollIntoViewIfNeeded();
      await p.screenshot({ path: `${SAIDA}/t468-video-sinalizado-${w}.png`, fullPage: true });
      await p.getByTestId("video-nao-imovel-confirmar").click();
      await p.getByTestId("video-nao-imovel-confirmar-confirmar").click();
      await expect(continuar(p)).toBeEnabled();
      await semRolagemLateral(p);
      await continuar(p).click();
      await noPasso(p, "endereco");
      await p.context().close();
    });
  }

  test("4. link: inválido, inexistente e não incorporável recusados; o válido só aparece depois do admin aprovar", async ({ browser }) => {
    const p = await entrar(browser, dono.email, senha);
    await p.setViewportSize({ width: 1280, height: 900 });
    await abrirPassoFotos(p);
    const link = p.getByTestId("video-link");
    const erro = p.getByTestId("video-link-erro");
    await link.fill("https://example.com/video.mp4");
    await expect(erro).toHaveText("Use um link do YouTube ou do Vimeo.");
    await link.fill("https://youtu.be/Xaaaaaaaaaa");
    await expect(erro).toHaveText("Não encontramos este vídeo. Confira se o link está certo e se o vídeo é público.", { timeout: 20_000 });
    await link.fill("https://youtu.be/Naaaaaaaaaa");
    await expect(erro).toHaveText("Este vídeo não pode ser exibido em outros sites (o dono do vídeo bloqueou). Libere a incorporação ou use outro vídeo.", { timeout: 20_000 });
    await link.fill("https://youtu.be/dQw4w9WgXcQ");
    await expect(p.getByTestId("video-link-ok")).toContainText("Vídeo encontrado. Ele aparece no anúncio depois que a equipe conferir", { timeout: 20_000 });
    await p.getByTestId("video-link").scrollIntoViewIfNeeded();
    await p.screenshot({ path: `${SAIDA}/t468-link-ok-1280.png` });
    await p.context().close();

    // Anúncio publicado com link: sem a aprovação, a página não mostra o vídeo.
    const url = "https://youtu.be/dQw4w9WgXcQ";
    ids.comLink = await criarImovelPronto(ids.dono, `Studio link t468 ${sufixo}`, { ativo: true });
    await adm().from("properties").update({ video_url: url }).eq("id", ids.comLink);
    const visitante = await (await browser.newContext({ viewport: { width: 1280, height: 900 } })).newPage();
    await visitante.goto(`/imoveis/${ids.comLink}`, { waitUntil: "domcontentloaded" });
    const mosaico = visitante.getByTestId("galeria-mosaico");
    await expect(mosaico.getByTestId("galeria-tile-0")).toBeVisible({ timeout: 30_000 });
    await expect(mosaico.locator('[data-item="video"]')).toHaveCount(0);

    // O admin vê o link pendente em Imóveis e aprova; a página passa a mostrar o vídeo.
    const a = await (await browser.newContext({ storageState: authFile("admin"), viewport: { width: 1280, height: 900 } })).newPage();
    await a.goto("/admin/imoveis", { waitUntil: "domcontentloaded" });
    const linha = a.locator(`[data-testid="admin-link-video"][data-imovel="${ids.comLink}"]`);
    await expect(linha).toBeVisible({ timeout: 30_000 });
    await a.getByTestId("admin-links-video").screenshot({ path: `${SAIDA}/t468-admin-links-1280.png` });
    await linha.getByTestId("admin-link-video-aprovar").click();
    await expect(linha).toHaveCount(0, { timeout: 20_000 });
    await a.context().close();
    await visitante.reload({ waitUntil: "domcontentloaded" });
    await expect(visitante.getByTestId("galeria-mosaico").locator('[data-item="video"]')).toHaveCount(1, { timeout: 30_000 });
    await visitante.context().close();
  });
});
