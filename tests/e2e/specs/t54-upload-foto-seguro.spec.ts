import { test, expect } from "@playwright/test";
import { authFile } from "../fixtures/auth";
import { noPasso } from "../fixtures/cadastro";

/**
 * T54 — upload de foto do anúncio (ordem 99c4d365, F46–F48): a rota do servidor
 * recusa o que não é JPEG/PNG/WebP de verdade e exige dono logado.
 */
const post = (request: import("@playwright/test").APIRequestContext, name: string, mimeType: string, buffer: Buffer) =>
  request.post("/api/upload/foto", { multipart: { file: { name, mimeType, buffer } } });

test.describe("T54 — Upload de foto seguro", () => {
  test.describe("visitante", () => {
    test.use({ storageState: { cookies: [], origins: [] } });
    test("sem login: 401", async ({ request }) => {
      const r = await post(request, "a.jpg", "image/jpeg", Buffer.from([0xff, 0xd8, 0xff, 0xe0, 0, 0]));
      expect(r.status()).toBe(401);
    });
  });

  test.describe("proprietário logado", () => {
    test.use({ storageState: authFile("proprietario") });
    test("F46 executável .jpg, F47 SVG com script e F48 .txt como .png são recusados (415)", async ({ request }) => {
      const mz = await post(request, "x.jpg", "image/jpeg", Buffer.from([0x4d, 0x5a, 0x90, 0, 3, 0, 0, 0, 4, 0, 0, 0]));
      expect(mz.status()).toBe(415);
      const svg = await post(request, "x.svg", "image/svg+xml", Buffer.from('<svg xmlns="http://www.w3.org/2000/svg"><script>alert(1)</script></svg>'));
      expect(svg.status()).toBe(415);
      const txt = await post(request, "x.png", "image/png", Buffer.from("só texto"));
      expect(txt.status()).toBe(415);
      const txtJpg = await post(request, "x.jpg", "image/jpeg", Buffer.from("só texto renomeado para jpg"));
      expect(txtJpg.status()).toBe(415);
    });

    test("foto verdadeira (JPEG) → 200 e salva como WebP; cabeçalho de JPEG sem imagem → 415", async ({ request }) => {
      const sharp = (await import("sharp")).default;
      const jpeg = await sharp({ create: { width: 640, height: 480, channels: 3, background: "#336699" } })
        .withExif({ IFD0: { Copyright: "Dono Fulano" } })
        .jpeg()
        .toBuffer();
      const ok = await post(request, "casa.jpg", "image/jpeg", jpeg);
      expect(ok.status()).toBe(200);
      expect((await ok.json()).path).toMatch(/\.webp$/);
      const falso = await post(request, "falsa.jpg", "image/jpeg", Buffer.from([0xff, 0xd8, 0xff, 0xe0, 0, 0, 0, 0, 0, 0, 0, 0]));
      expect(falso.status()).toBe(415);
    });

    test("F47 na tela: SVG é recusado com mensagem visível e o contador não sobe", async ({ page }) => {
      await page.goto("/dashboard/imoveis/novo?etapa=tipo", { waitUntil: "networkidle" });
      const outro = page.getByRole("button", { name: "Começar outro" });
      if (await outro.isVisible().catch(() => false)) await outro.click();
      // Assistente em 10 passos: as fotos são o 2º passo, logo depois do Tipo (que não tem trava).
      await noPasso(page, "tipo");
      await page.getByTestId("cadastro-continuar").click();
      await noPasso(page, "fotos");
      await page.getByTestId("etapa-fotos").locator('input[type="file"]').first().setInputFiles({
        name: "x.svg",
        mimeType: "image/svg+xml",
        buffer: Buffer.from('<svg xmlns="http://www.w3.org/2000/svg"><script>alert(1)</script></svg>'),
      });
      await expect(page.getByText("Envie fotos em JPG, PNG ou WebP.")).toBeVisible();
      await expect(page.getByText(/\b1\/8\b/)).toHaveCount(0);
    });
  });
});
