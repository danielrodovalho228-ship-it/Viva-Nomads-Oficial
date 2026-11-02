import { test, expect } from "@playwright/test";
import { NO_LABORATORIO, adm, apagarContas, criarConta, criarImovelPronto, entrar, novaSenha, novoSufixo } from "../fixtures/laboratorio";

/**
 * T719 — P0 do uso real do Daniel (30/10): atalho de pendência de RASCUNHO abre o passo dentro do assistente.
 *   A. Meus anúncios: o rascunho sem fotos mostra "Falta para publicar" com cada item como link; "Pelo menos 8 fotos"
 *      leva a /novo?draft=<id>&etapa=1 — o Passo 2 (Fotos) do assistente, com "Passo 2 de 10" e o envio de fotos.
 *      Nenhum atalho do cartão do rascunho aponta para o editor por seções.
 *   B. Anúncio publicado sem tipo de entrada: o aviso do painel abre o editor por seções JÁ na seção "Regras da casa"
 *      (aberta), onde fica o tipo de entrada.
 */
const SAIDA = "tests/laboratorio/saida";

test.describe("T719 — P0: pendência do rascunho abre o passo no assistente", () => {
  test.skip(!NO_LABORATORIO, "Só no laboratório.");
  test.describe.configure({ mode: "serial", timeout: 180_000 });
  test.use({ actionTimeout: 15_000, navigationTimeout: 30_000 });
  const senha = novaSenha();
  const sufixo = novoSufixo();
  const dono = { email: `dono.t719.${sufixo}@lab.vivanomads.test`, nome: "Dora Pendência", role: "owner" as const };
  const ids: { dono?: string; rascunho?: string; ativo?: string } = {};

  test.beforeAll(async () => {
    ids.dono = await criarConta(dono, senha);
    ids.rascunho = await criarImovelPronto(ids.dono, `Rascunho sem fotos t719 ${sufixo}`);
    ids.ativo = await criarImovelPronto(ids.dono, `Publicado sem entrada t719 ${sufixo}`, { ativo: true });
    // O rascunho fica sem fotos (o caso do Daniel); o publicado, sem o tipo de entrada (anúncio de antes da regra).
    expect((await adm().from("property_photos").delete().eq("property_id", ids.rascunho!)).error).toBeNull();
    expect((await adm().from("properties").update({ draft_data: { title: `Rascunho sem fotos t719 ${sufixo}`, photos: [] } }).eq("id", ids.rascunho!)).error).toBeNull();
    expect((await adm().from("properties").update({ tipo_entrada: null }).eq("id", ids.ativo!)).error).toBeNull();
  });
  test.afterAll(async () => {
    await apagarContas([ids.dono!]);
  });

  test("A: 'Falta para publicar' do rascunho leva ao Passo 2 (Fotos) do assistente", async ({ browser }) => {
    const p = await entrar(browser, dono.email, senha);
    await p.setViewportSize({ width: 390, height: 844 });
    await p.goto("/dashboard/imoveis", { waitUntil: "domcontentloaded" });
    const falta = p.getByTestId("falta-publicar").first();
    await expect(falta).toBeVisible({ timeout: 30_000 });
    // Nenhum atalho de pendência do rascunho vai ao editor por seções.
    for (const href of await falta.locator("a").evaluateAll((as) => as.map((a) => a.getAttribute("href") ?? ""))) {
      expect(href).toMatch(new RegExp(`^/dashboard/imoveis/novo\\?draft=${ids.rascunho}`));
      expect(href).not.toContain("/editar");
    }
    await p.screenshot({ path: `${SAIDA}/t719-cartao-pendencias-390.png`, fullPage: true });
    await falta.getByTestId("pendencia-fotos").click();
    await expect(p).toHaveURL(new RegExp(`/dashboard/imoveis/novo\\?draft=${ids.rascunho}&etapa=1`));
    await expect(p.getByTestId("etapa-fotos")).toBeVisible({ timeout: 30_000 });
    await expect(p.getByTestId("passo-texto")).toHaveText("Passo 2 de 10");
    await p.screenshot({ path: `${SAIDA}/t719-passo2-fotos-390.png`, fullPage: true });
    await p.context().close();
  });

  test("B: publicado sem tipo de entrada → editor por seções na seção Regras, aberta", async ({ browser }) => {
    const p = await entrar(browser, dono.email, senha);
    await p.setViewportSize({ width: 1280, height: 900 });
    await p.goto("/dashboard/imoveis", { waitUntil: "domcontentloaded" });
    // E418 (02/11): um aviso único no topo; o link do anúncio fica no cartão dele.
    await expect(p.getByTestId("aviso-tipo-entrada")).toBeVisible({ timeout: 30_000 });
    const link = p.locator(`[data-testid="meu-anuncio"][data-imovel="${ids.ativo}"]`).getByTestId("card-tipo-entrada");
    await expect(link).toHaveAttribute("href", `/dashboard/imoveis/${ids.ativo}/editar#secao-regras`);
    await link.click();
    await expect(p.getByTestId("secao-regras")).toHaveAttribute("data-aberta", "true", { timeout: 30_000 });
    await p.screenshot({ path: `${SAIDA}/t719-editor-regras-1280.png`, fullPage: true });
    await p.context().close();
  });
});
