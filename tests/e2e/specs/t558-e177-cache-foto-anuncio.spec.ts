import { test, expect } from "@playwright/test";
import { authFile } from "../fixtures/auth";
import { NO_LABORATORIO, adm } from "../fixtures/laboratorio";

/*
  T558 — E177 (#1397), guarda permanente da Pista C: o unitário confere o código da rota; aqui é o que o armazenamento
  SERVE. Duas fotos verdadeiras enviadas por /api/upload/foto (proprietário logado):
   - cada uma ganha um endereço próprio (UUID .webp) — nunca o mesmo endereço para fotos diferentes;
   - o endereço público responde 200 com Cache-Control de 1 ano (max-age=31536000) e image/webp.
  As fotos de teste são apagadas no fim.
*/
const BUCKET = "property-photos";
const caminhos: string[] = [];

test.describe("T558 — E177: a foto do anúncio servida com cache de 1 ano e endereço único", () => {
  test.skip(!NO_LABORATORIO, "Só no laboratório (armazenamento local).");
  test.use({ storageState: authFile("proprietario") });

  test.afterAll(async () => {
    if (caminhos.length) await adm().storage.from(BUCKET).remove(caminhos);
  });

  test("duas fotos: endereços diferentes e Cache-Control max-age=31536000 no endereço público", async ({ request }) => {
    const sharp = (await import("sharp")).default;
    const fotos = await Promise.all(
      ["#336699", "#996633"].map((cor) => sharp({ create: { width: 640, height: 480, channels: 3, background: cor } }).jpeg().toBuffer()),
    );
    const enviados: { path: string; url: string }[] = [];
    for (const [i, buffer] of fotos.entries()) {
      const r = await request.post("/api/upload/foto", { multipart: { file: { name: `casa-${i}.jpg`, mimeType: "image/jpeg", buffer } } });
      expect(r.status(), `envio ${i}`).toBe(200);
      const corpo = (await r.json()) as { path: string; url: string };
      caminhos.push(corpo.path);
      enviados.push(corpo);
    }
    expect(enviados[0].path).toMatch(/^[0-9a-f-]{36}\/[0-9a-f-]{36}\.webp$/);
    expect(enviados[1].path).toMatch(/^[0-9a-f-]{36}\/[0-9a-f-]{36}\.webp$/);
    expect(enviados[0].path, "fotos diferentes no mesmo endereço").not.toBe(enviados[1].path);

    for (const { url } of enviados) {
      const r = await request.get(url);
      expect(r.status(), url).toBe(200);
      const cabecalhos = r.headers();
      console.log(`t558 ${url.split("/").pop()}: cache-control="${cabecalhos["cache-control"]}" content-type="${cabecalhos["content-type"]}"`);
      expect(cabecalhos["cache-control"] ?? "", "Cache-Control do endereço público").toMatch(/max-age=31536000\b/);
      expect(cabecalhos["content-type"] ?? "").toContain("image/webp");
    }
  });
});
