import { test, expect } from "@playwright/test";
import { randomUUID } from "node:crypto";
import sharp from "sharp";
import { NO_LABORATORIO, adm, pngDeTeste } from "../fixtures/laboratorio";

/*
  T932 — E264-B (#2018, Pista B): a foto de capa do cartão do e-mail sai SEMPRE em JPEG pela rota própria
  /api/email/foto?p=<uuid>/<uuid>.<ext> (640 px, inline, igual para todo cliente), e não mais pelo otimizador do site
  (que negocia AVIF/WebP por "Vary: Accept", entrega como anexo e com CSP sandbox). Prova na rota de verdade:
   - uma capa PNG de 1200×800 enviada ao bucket público property-photos (caminho <uuid>/<uuid>.png, como as capas
     reais) volta, pedida por um cliente que PREFERE AVIF/WebP, como image/jpeg (bytes FF D8), Content-Disposition
     inline, sem Vary por Accept, com cache imutável — e com 640 px de largura (a altura na proporção);
   - um caminho fora do padrão (URL livre, ../, outra extensão) responde 404 — a rota não busca qualquer coisa.
  A capa enviada é apagada no fim.
*/
const caminho = `${randomUUID()}/${randomUUID()}.png`;

test.describe("T932 — E264-B (#2018): foto do cartão do e-mail sempre em JPEG pela rota própria", () => {
  test.skip(!NO_LABORATORIO, "Só no laboratório (bucket property-photos do laboratório).");

  test.beforeAll(async () => {
    const { error } = await adm().storage.from("property-photos").upload(caminho, pngDeTeste(7, 1200, 800), { contentType: "image/png", upsert: true });
    if (error) throw error;
  });
  test.afterAll(async () => {
    await adm().storage.from("property-photos").remove([caminho]);
  });

  test("capa PNG volta como JPEG inline de 640 px, mesmo para quem prefere AVIF/WebP", async ({ request }) => {
    const r = await request.get(`/api/email/foto?p=${encodeURIComponent(caminho)}`, { headers: { accept: "image/avif,image/webp,image/*;q=0.8" } });
    const h = r.headers();
    const corpo = await r.body();
    const meta = r.ok() ? await sharp(corpo).metadata() : null;
    console.log(`t932|status=${r.status()}|tipo=${h["content-type"]}|disp=${h["content-disposition"]}|vary=${h["vary"] ?? "-"}|cache=${h["cache-control"]}|bytes=${corpo.length}|fmt=${meta?.format}|${meta?.width}x${meta?.height}`);
    expect(r.status()).toBe(200);
    expect(h["content-type"]).toBe("image/jpeg");
    expect(corpo[0]).toBe(0xff);
    expect(corpo[1]).toBe(0xd8);
    expect(h["content-disposition"]).toBe("inline");
    expect(h["vary"] ?? "", "não varia por Accept (uma resposta só para todo leitor de e-mail)").not.toMatch(/accept\b/i);
    expect(h["cache-control"]).toContain("immutable");
    expect(meta?.format).toBe("jpeg");
    expect(meta?.width).toBe(640);
    expect(meta?.height).toBe(427);
  });

  for (const p of ["https://exemplo.com/foto.png", "../segredo/x.png", "0b8f3a52-6f1c-4c39-9d11-2a7e5c4b9e01/7d2e4f60-1a3b-4c5d-8e9f-0a1b2c3d4e5f.gif", "nao-e-uuid/foto.png"]) {
    test(`caminho fora do padrão responde 404: ${p}`, async ({ request }) => {
      const r = await request.get(`/api/email/foto?p=${encodeURIComponent(p)}`);
      expect(r.status()).toBe(404);
    });
  }
});
