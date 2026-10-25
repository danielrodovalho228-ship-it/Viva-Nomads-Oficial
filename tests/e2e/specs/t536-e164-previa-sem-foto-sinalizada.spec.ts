import { test, expect, type Page } from "@playwright/test";
import { NO_LABORATORIO, adm, apagarContas, criarConta, entrar, novaSenha, novoSufixo } from "../fixtures/laboratorio";
import { FOTOS_TESTE_MINIMO, noPasso } from "../fixtures/cadastro";

/*
  T536 — E164, guarda permanente da Pista C: a "Visualização do anúncio" (prévia lateral do computador, 1280 px) não
  mostra como foto principal uma foto sinalizada "não parece ser do imóvel" e NÃO confirmada.
   1. Só o print no Passo 2 (sinalizado, sem confirmar): a prévia não usa a imagem dele.
   2. Print primeiro e as 8 fotos do imóvel depois: a prévia mostra a mesma foto do selo "Foto principal" (do imóvel),
      não o print.
   3. Confirmado o print ("é do imóvel"), a trava sai: a prévia segue com foto (pode mostrar qualquer uma).
  Só no laboratório (a conferência do print usa a medida local de tela, como na t468).
*/
const PRINT = "docs/capturas/e44/exportar-1280.png";
const senha = novaSenha();
const sufixo = novoSufixo();
const dono = { email: `dono.t536.${sufixo}@lab.vivanomads.test`, nome: "Vera Visualização", role: "owner" as const };
const ids: Record<string, string> = {};

const enviar = (p: Page, arquivos: string | string[]) => p.getByTestId("etapa-fotos").locator('input[type="file"]').first().setInputFiles(arquivos);
const srcPrevia = (p: Page) => p.getByTestId("novo-resumo").getByTestId("previa-foto").getAttribute("src");
const srcSinalizada = (p: Page) => p.locator('[data-nao-imovel="1"] img').first().getAttribute("src");

async function abrirPassoFotos(p: Page) {
  await p.goto("/dashboard/imoveis/novo", { waitUntil: "domcontentloaded" });
  const aviso = p.getByTestId("rascunho-aviso");
  await expect(p.getByTestId("passo-titulo").or(aviso).first()).toBeVisible({ timeout: 30_000 });
  if (await aviso.isVisible()) await aviso.getByRole("button", { name: "Começar outro" }).click();
  await noPasso(p, "tipo");
  await p.getByTestId("cadastro-continuar").click();
  await noPasso(p, "fotos");
}

test.describe("T536 — E164: a prévia não usa a foto sinalizada sem confirmação", () => {
  test.skip(!NO_LABORATORIO, "Só no laboratório.");
  test.describe.configure({ mode: "serial", timeout: 240_000 });

  test.beforeAll(async () => {
    ids.dono = await criarConta(dono, senha);
    await adm().from("profiles").update({ is_teste: true }).eq("id", ids.dono);
  });
  test.afterAll(async () => {
    await apagarContas([ids.dono]);
  });

  test("1. só o print, sem confirmar: a prévia não mostra o print como foto principal", async ({ browser }) => {
    // E164: corrigido no #1390 (antes, 40207606596: a prévia mostrava o print sinalizado como principal).
    const p = await entrar(browser, dono.email, senha);
    await p.setViewportSize({ width: 1280, height: 900 });
    await abrirPassoFotos(p);
    await enviar(p, PRINT);
    await expect(p.getByTestId("aviso-foto-nao-imovel")).toBeVisible({ timeout: 60_000 });
    const sinalizada = await srcSinalizada(p);
    const resumo = p.getByTestId("novo-resumo");
    await expect(resumo.getByTestId("previa-anuncio")).toBeVisible();
    await p.waitForTimeout(500);
    const previa = (await resumo.getByTestId("previa-foto").count()) ? await srcPrevia(p) : null;
    await p.screenshot({ path: "tests/laboratorio/saida/t536-so-print-1280.png" });
    expect(previa, "a prévia usa a foto sinalizada e não confirmada").not.toBe(sinalizada);
    await p.context().close();
  });

  test("2–3. print primeiro + 8 fotos: a prévia mostra a principal do imóvel; confirmado, segue com foto", async ({ browser }) => {
    const p = await entrar(browser, dono.email, senha);
    await p.setViewportSize({ width: 1280, height: 900 });
    await abrirPassoFotos(p);
    await enviar(p, PRINT);
    await expect(p.getByTestId("aviso-foto-nao-imovel")).toBeVisible({ timeout: 60_000 });
    await enviar(p, FOTOS_TESTE_MINIMO);
    await expect(p.getByText(/^9\/40 fotos/)).toBeVisible({ timeout: 60_000 });
    const sinalizada = await srcSinalizada(p);
    const principal = await p.getByTestId("foto-principal").locator("img").first().getAttribute("src");
    expect(principal).not.toBe(sinalizada);
    await expect.poll(() => srcPrevia(p), { timeout: 10_000 }).toBe(principal);
    await p.screenshot({ path: "tests/laboratorio/saida/t536-principal-do-imovel-1280.png" });

    await p.getByTestId("foto-nao-imovel-confirmar").click();
    await p.getByTestId("foto-nao-imovel-confirmar-confirmar").click();
    await expect(p.getByTestId("foto-conteudo-confirmada")).toBeVisible();
    await expect(p.getByTestId("novo-resumo").getByTestId("previa-foto")).toBeVisible();
    await p.context().close();
  });
});
