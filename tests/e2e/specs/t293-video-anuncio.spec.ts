import { test, expect } from "@playwright/test";
import { authFile } from "../fixtures/auth";
import { noPasso } from "../fixtures/cadastro";

/**
 * T293 — vídeo curto no anúncio (ordem 8681ae95, parte 2): o envio recusa o que passa de 60 s ou não é MP4/MOV,
 * a rota de conferência exige dono logado na própria pasta e o endereço público do vídeo só existe para anúncio publicado.
 */
const u32 = (n: number) => Buffer.from([(n >>> 24) & 255, (n >>> 16) & 255, (n >>> 8) & 255, n & 255]);
const caixa = (tipo: string, corpo: Buffer) => Buffer.concat([u32(8 + corpo.length), Buffer.from(tipo, "latin1"), corpo]);
/** MP4 mínimo: só ftyp + moov/mvhd com a duração pedida (o servidor lê a duração do próprio arquivo). */
function mp4DeSegundos(segundos: number): Buffer {
  const mvhd = Buffer.concat([Buffer.alloc(4), Buffer.alloc(8), u32(1000), u32(segundos * 1000), Buffer.alloc(80)]);
  return Buffer.concat([caixa("ftyp", Buffer.concat([Buffer.from("isom"), u32(0), Buffer.from("isom")])), caixa("moov", caixa("mvhd", mvhd))]);
}

test.describe("T293 — Vídeo no anúncio", () => {
  test.describe("visitante", () => {
    test.use({ storageState: { cookies: [], origins: [] } });
    test("sem login a conferência do vídeo responde 401", async ({ request }) => {
      const r = await request.post("/api/upload/video/confirmar", { data: { path: "x/y.mp4" } });
      expect(r.status()).toBe(401);
    });
    test("anúncio inexistente ou sem vídeo: o endereço do vídeo responde 404 (e id malformado também)", async ({ request }) => {
      expect((await request.get("/api/imoveis/00000000-0000-4000-8000-000000000000/video")).status()).toBe(404);
      expect((await request.get("/api/imoveis/nao-e-id/video")).status()).toBe(404);
    });
  });

  test.describe("proprietário logado", () => {
    test.use({ storageState: authFile("proprietario") });
    test("caminho fora da própria pasta é recusado (400)", async ({ request }) => {
      for (const path of ["outro-dono/y.mp4", "../y.mp4", ""]) {
        const r = await request.post("/api/upload/video/confirmar", { data: { path } });
        expect(r.status(), path).toBe(400);
      }
    });

    test("na etapa Fotos: arquivo que não é vídeo e vídeo de 90 s são recusados com mensagem, sem marcar 'Vídeo enviado'", async ({ page }) => {
      await page.goto("/dashboard/imoveis/novo", { waitUntil: "networkidle" });
      const outro = page.getByRole("button", { name: "Começar outro" });
      if (await outro.isVisible().catch(() => false)) await outro.click();
      // Assistente em 10 passos: Fotos (com o vídeo) é o 2º passo, logo depois do Tipo (que não tem trava).
      await noPasso(page, "tipo");
      await page.getByTestId("cadastro-continuar").click();
      await noPasso(page, "fotos");

      const entrada = page.getByTestId("video-input");
      await entrada.setInputFiles({ name: "x.txt", mimeType: "text/plain", buffer: Buffer.from("não sou vídeo") });
      await expect(page.getByTestId("video-erro")).toHaveText("Envie o vídeo em MP4 ou MOV.");

      await entrada.setInputFiles({ name: "longo.mp4", mimeType: "video/mp4", buffer: mp4DeSegundos(90) });
      await expect(page.getByTestId("video-erro")).toHaveText("O vídeo deve ter no máximo 60 segundos.", { timeout: 20_000 });
      await expect(page.getByTestId("video-enviado")).toHaveCount(0);
    });
  });
});
