import { test, expect, type Page } from "@playwright/test";
import { NO_LABORATORIO, adm, apagarContas, criarConta, entrar, novaSenha, novoSufixo } from "../fixtures/laboratorio";
import { FOTOS_TESTE_MINIMO, noPasso } from "../fixtures/cadastro";

/*
  T478 — E164 (QA ao vivo do Muse, 25/10): no Passo 2, a "Visualização do anúncio" mostrava a foto sinalizada e NÃO
  confirmada como "Foto principal do anúncio", enquanto o selo da própria foto dizia "Não pode ser a foto principal".
  A prévia (cartão lateral e "Ver no tamanho real") mostra só foto elegível: a primeira sem pendência, ou nenhuma.
  Selo e prévia concordam nos três estados: pendente, confirmada e trocada. Só no laboratório (a conferência usa a
  medida local de tela; o print é sinalizado).
*/
const SAIDA = "tests/laboratorio/saida";
const PRINT = "docs/capturas/e44/exportar-1280.png";
const senha = novaSenha();
const sufixo = novoSufixo();
const dono = { email: `dono.t478.${sufixo}@lab.vivanomads.test`, nome: "Paula Prévia", role: "owner" as const };
const ids: Record<string, string> = {};

const enviar = (p: Page, arquivos: string | string[]) => p.getByTestId("etapa-fotos").locator('input[type="file"]').first().setInputFiles(arquivos);

/** O src da 1ª foto elegível do uploader (sem pendência de "não parece imóvel"), na ordem da galeria; null se nenhuma. */
async function primeiraElegivel(p: Page): Promise<string | null> {
  return p.evaluate(() => {
    const cards = Array.from(document.querySelectorAll('[data-testid="foto-principal"], [data-testid="foto-miniatura"]'));
    for (const c of cards) {
      if (c.querySelector('[data-nao-imovel="1"]')) continue;
      const img = c.querySelector("img");
      if (img) return img.getAttribute("src");
    }
    return null;
  });
}

async function conferePrevia(p: Page, estado: string) {
  const previa = p.getByTestId("novo-resumo");
  const esperada = await primeiraElegivel(p);
  if (esperada === null) {
    await expect(previa.getByTestId("previa-sem-foto"), `${estado}: sem foto elegível, a prévia fica sem foto`).toBeVisible();
    await expect(previa.getByTestId("previa-foto")).toHaveCount(0);
  } else {
    await expect(previa.getByTestId("previa-foto"), `${estado}: a prévia mostra a 1ª foto elegível`).toHaveAttribute("src", esperada);
  }
  // A sinalizada pendente nunca é a foto da prévia.
  const pendente = await p.locator('[data-nao-imovel="1"] img').first().getAttribute("src").catch(() => null);
  if (pendente && esperada !== null) await expect(previa.getByTestId("previa-foto")).not.toHaveAttribute("src", pendente);
  return esperada;
}

async function confereTamanhoReal(p: Page, esperada: string | null, estado: string) {
  await p.getByTestId("novo-resumo").getByTestId("previa-tamanho-real-abrir").click();
  const real = p.getByTestId("previa-tamanho-real");
  await expect(real).toBeVisible();
  const tile = real.getByTestId("galeria-mosaico").getByTestId("galeria-tile-0").locator("img").first();
  // Sem foto elegível, o tamanho real mostra o espaço da foto (sem imagem), como no anúncio sem fotos.
  if (esperada === null) await expect(real.getByTestId("galeria-mosaico").getByTestId("galeria-tile-0").locator("img")).toHaveCount(0);
  else expect(decodeURIComponent((await tile.getAttribute("src")) ?? ""), `${estado}: a 1ª foto do tamanho real`).toContain(esperada);
  await p.keyboard.press("Escape");
  await expect(real).toHaveCount(0);
}

test.describe("T478 — E164: a prévia nunca mostra a foto sinalizada pendente como principal", () => {
  test.skip(!NO_LABORATORIO, "Só no laboratório.");
  test.describe.configure({ mode: "serial", timeout: 240_000 });

  test.beforeAll(async () => {
    ids.dono = await criarConta(dono, senha);
    await adm().from("profiles").update({ is_teste: true }).eq("id", ids.dono);
  });
  test.afterAll(async () => {
    await apagarContas([ids.dono]);
  });

  test("a 1280 px: pendente, confirmada e trocada — selo e prévia concordam", async ({ browser }) => {
    const p = await entrar(browser, dono.email, senha);
    await p.setViewportSize({ width: 1280, height: 900 });
    await p.goto("/dashboard/imoveis/novo", { waitUntil: "domcontentloaded" });
    const aviso = p.getByTestId("rascunho-aviso");
    await expect(p.getByTestId("passo-titulo").or(aviso).first()).toBeVisible({ timeout: 30_000 });
    if (await aviso.isVisible()) await aviso.getByRole("button", { name: "Começar outro" }).click();
    await noPasso(p, "tipo");
    await p.getByTestId("cadastro-continuar").click();
    await noPasso(p, "fotos");

    // 1. Só a foto sinalizada: o selo diz que ela não pode ser a principal; a prévia fica sem foto.
    await enviar(p, PRINT);
    await expect(p.getByTestId("aviso-foto-nao-imovel")).toBeVisible({ timeout: 60_000 });
    await expect(p.getByTestId("selo-principal-bloqueada")).toHaveText("Não pode ser a foto principal");
    expect(await conferePrevia(p, "só a sinalizada")).toBeNull();
    await p.screenshot({ path: `${SAIDA}/t478-so-sinalizada-1280.png` });
    await confereTamanhoReal(p, null, "só a sinalizada");

    // 2. Pendente + fotos do imóvel: a prévia mostra a 1ª elegível, nunca a sinalizada.
    await enviar(p, FOTOS_TESTE_MINIMO.slice(0, 2));
    await expect(p.getByText(/^3\/40 fotos/)).toBeVisible({ timeout: 60_000 });
    const pendente = await conferePrevia(p, "pendente");
    expect(pendente).not.toBeNull();
    await p.screenshot({ path: `${SAIDA}/t478-pendente-1280.png` });
    await confereTamanhoReal(p, pendente, "pendente");

    // 3. Confirmada ("É do imóvel"): a foto volta a valer; prévia e selo seguem a ordem da galeria.
    await p.getByTestId("foto-nao-imovel-confirmar").click();
    await p.getByTestId("foto-nao-imovel-confirmar-confirmar").click();
    await expect(p.getByTestId("foto-conteudo-confirmada")).toBeVisible();
    await expect(p.locator('[data-nao-imovel="1"]')).toHaveCount(0);
    await expect(p.getByTestId("selo-principal-bloqueada")).toHaveCount(0);
    const confirmada = await conferePrevia(p, "confirmada");
    const principal = await p.getByTestId("foto-principal").locator("img").first().getAttribute("src");
    expect(confirmada, "confirmada: a prévia mostra a foto marcada como principal").toBe(principal);
    await p.screenshot({ path: `${SAIDA}/t478-confirmada-1280.png` });
    await p.context().close();
  });

  test("a 1280 px: trocada — remover a sinalizada deixa prévia e principal iguais", async ({ browser }) => {
    const p = await entrar(browser, dono.email, senha);
    await p.setViewportSize({ width: 1280, height: 900 });
    await p.goto("/dashboard/imoveis/novo", { waitUntil: "domcontentloaded" });
    const aviso = p.getByTestId("rascunho-aviso");
    await expect(p.getByTestId("passo-titulo").or(aviso).first()).toBeVisible({ timeout: 30_000 });
    if (await aviso.isVisible()) await aviso.getByRole("button", { name: "Começar outro" }).click();
    await noPasso(p, "tipo");
    await p.getByTestId("cadastro-continuar").click();
    await noPasso(p, "fotos");
    await enviar(p, [PRINT, FOTOS_TESTE_MINIMO[0]]);
    await expect(p.getByText(/^2\/40 fotos/)).toBeVisible({ timeout: 60_000 });
    await expect(p.getByTestId("aviso-foto-nao-imovel")).toBeVisible({ timeout: 60_000 });
    await conferePrevia(p, "pendente (2 fotos)");
    await p.getByTestId("foto-nao-imovel-remover").click();
    await expect(p.getByText(/^1\/40 fotos/)).toBeVisible({ timeout: 30_000 });
    await expect(p.locator('[data-nao-imovel="1"]')).toHaveCount(0);
    const trocada = await conferePrevia(p, "trocada");
    expect(trocada).toBe(await p.getByTestId("foto-principal").locator("img").first().getAttribute("src"));
    await expect(p.getByTestId("selo-foto-principal")).toHaveText("Foto principal");
    await p.screenshot({ path: `${SAIDA}/t478-trocada-1280.png` });
    await p.context().close();
  });
});
