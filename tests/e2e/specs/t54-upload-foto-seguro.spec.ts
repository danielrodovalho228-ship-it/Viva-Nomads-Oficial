import { test, expect } from "@playwright/test";
import { authFile } from "../fixtures/auth";

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
    });
  });
});
