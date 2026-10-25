import { test, expect, type Page } from "@playwright/test";
import { NO_LABORATORIO, adm, apagarContas, criarConta, entrar, novaSenha, novoSufixo } from "../fixtures/laboratorio";
import { FOTOS_TESTE_MINIMO, noPasso } from "../fixtures/cadastro";

/*
  T523 — E133 (#1373), guarda permanente da Pista C: o limite exato e a TROCA, que a t468 não cobre (ela vai de 2 para 9
  fotos e só passa pela confirmação).
   1. Com 7 fotos do imóvel o "Continuar" fica desabilitado ("Falta 1 foto"); com a 8ª, libera.
   2. Um print enviado PRIMEIRO (sozinho na posição 1) não fica como principal quando chegam as 8 fotos do imóvel, não
      oferece "Usar como foto principal" e trava o passo; removido (a troca), o passo libera sem confirmação e avança.
  A 390 e 1280 px. Só no laboratório (a conferência do print usa a medida local de tela, como na t468).
*/
const SAIDA = "tests/laboratorio/saida";
const PRINT = "docs/capturas/e44/exportar-1280.png";
const senha = novaSenha();
const sufixo = novoSufixo();
const dono = { email: `dono.t523.${sufixo}@lab.vivanomads.test`, nome: "Sete Fotos", role: "owner" as const };
const ids: Record<string, string> = {};

const continuar = (p: Page) => p.getByTestId("cadastro-continuar");
const enviar = (p: Page, arquivos: string | string[]) => p.getByTestId("etapa-fotos").locator('input[type="file"]').first().setInputFiles(arquivos);

async function abrirPassoFotos(p: Page) {
  await p.goto("/dashboard/imoveis/novo", { waitUntil: "domcontentloaded" });
  const aviso = p.getByTestId("rascunho-aviso");
  await expect(p.getByTestId("passo-titulo").or(aviso).first()).toBeVisible({ timeout: 30_000 });
  if (await aviso.isVisible()) await aviso.getByRole("button", { name: "Começar outro" }).click();
  await noPasso(p, "tipo");
  await continuar(p).click();
  await noPasso(p, "fotos");
}

test.describe("T523 — E133: 7 trava, 8 libera; print não vira principal e a troca destrava", () => {
  test.skip(!NO_LABORATORIO, "Só no laboratório.");
  test.describe.configure({ mode: "serial", timeout: 240_000 });

  test.beforeAll(async () => {
    ids.dono = await criarConta(dono, senha);
    await adm().from("profiles").update({ is_teste: true }).eq("id", ids.dono);
  });
  test.afterAll(async () => {
    await apagarContas([ids.dono]);
  });

  for (const w of [390, 1280] as const) {
    test(`1. a ${w} px: 7 fotos desabilitam o Continuar, a 8ª libera`, async ({ browser }) => {
      const p = await entrar(browser, dono.email, senha);
      await p.setViewportSize({ width: w, height: w === 390 ? 844 : 900 });
      await abrirPassoFotos(p);
      await enviar(p, FOTOS_TESTE_MINIMO.slice(0, 7));
      await expect(p.getByText(/^7\/40 fotos/)).toBeVisible({ timeout: 60_000 });
      await expect(p.getByTestId("fotos-trava")).toHaveAttribute("data-trava", "faltam");
      await expect(p.getByTestId("fotos-trava")).toContainText(/Faltam? 1 foto/);
      await expect(continuar(p)).toBeDisabled();
      await continuar(p).click({ force: true });
      await noPasso(p, "fotos");
      await enviar(p, FOTOS_TESTE_MINIMO[7]);
      await expect(p.getByText(/^8\/40 fotos/)).toBeVisible({ timeout: 60_000 });
      await expect(p.getByTestId("fotos-trava")).toHaveCount(0);
      await expect(continuar(p)).toBeEnabled();
      await continuar(p).click();
      await noPasso(p, "endereco");
      await p.context().close();
    });

    test(`2. a ${w} px: print enviado primeiro não fica principal; removido, o passo libera`, async ({ browser }) => {
      const p = await entrar(browser, dono.email, senha);
      await p.setViewportSize({ width: w, height: w === 390 ? 844 : 900 });
      await abrirPassoFotos(p);
      await enviar(p, PRINT);
      await expect(p.getByTestId("aviso-foto-nao-imovel")).toBeVisible({ timeout: 60_000 });
      await enviar(p, FOTOS_TESTE_MINIMO);
      await expect(p.getByText(/^9\/40 fotos/)).toBeVisible({ timeout: 60_000 });
      // A principal é uma foto do imóvel; o print não oferece a estrela.
      await expect(p.getByTestId("foto-principal").locator('[data-nao-imovel="1"]')).toHaveCount(0);
      await expect(p.getByTestId("selo-foto-principal")).toBeVisible();
      await expect(p.getByTestId("selo-principal-bloqueada")).toHaveCount(0);
      const sinalizada = p.locator('[data-nao-imovel="1"]');
      await expect(sinalizada).toHaveCount(1);
      await expect(p.getByTestId("foto-miniatura").filter({ has: sinalizada }).getByRole("button", { name: "Usar como foto principal" })).toHaveCount(0);
      await expect(p.getByTestId("fotos-trava")).toHaveAttribute("data-trava", "sinalizadas");
      await expect(continuar(p)).toBeDisabled();
      await p.screenshot({ path: `${SAIDA}/t523-print-primeiro-${w}.png`, fullPage: true });
      // A troca: remover o print, sem confirmar nada.
      await p.getByTestId("foto-nao-imovel-remover").click();
      await expect(p.getByText(/^8\/40 fotos/)).toBeVisible({ timeout: 30_000 });
      await expect(sinalizada).toHaveCount(0);
      await expect(continuar(p)).toBeEnabled();
      await continuar(p).click();
      await noPasso(p, "endereco");
      await p.context().close();
    });
  }
});
