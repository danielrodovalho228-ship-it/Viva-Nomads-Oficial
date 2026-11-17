import { test, expect } from "@playwright/test";
import { randomUUID } from "node:crypto";
import sharp from "sharp";
import { NO_LABORATORIO, adm } from "../fixtures/laboratorio";

/*
  T2126 — E274 @E274 (com o E264-B): a foto de capa do cartão do e-mail proativo aparece.
  Regra decidida (E274; FOTO_CARTAO em cartoes-email.ts, rota /api/email/foto): a capa do cartão sai sempre como JPEG
  inline com 640 px de largura (q 75), igual para todo leitor de e-mail. A rota só serve capas do bucket público
  property-photos no formato `<uuid>/<uuid>.<ext>`. Qualquer outro caminho dá 404 (nada de URL livre).
  Prova, sem sessão (o leitor de e-mail não tem sessão):
    1. uma capa WebP de 1200×800 no bucket → GET /api/email/foto?p=<caminho> responde 200, `image/jpeg`, inline,
       com bytes de JPEG (FF D8) e 640 px de largura (a altura segue a proporção: 427);
    2. caminho fora do formato (subida de pasta, URL externa, extensão que não é imagem) → 404.
  Os valores esperados estão escritos aqui, pela regra (não importados do código).
*/
const LARGURA_DO_CARTAO = 640;

test.describe("T2126 — E274: a capa do cartão do e-mail sai em JPEG de 640 px, inline; caminho estranho dá 404 @E274", () => {
  test.skip(!NO_LABORATORIO, "Só no laboratório (bucket local + chave de serviço).");
  const caminho = `${randomUUID()}/${randomUUID()}.webp`;

  test.beforeAll(async () => {
    const webp = await sharp({ create: { width: 1200, height: 800, channels: 3, background: { r: 28, g: 107, b: 58 } } }).webp({ quality: 80 }).toBuffer();
    const { error } = await adm().storage.from("property-photos").upload(caminho, webp, { contentType: "image/webp", upsert: true });
    if (error) throw error;
  });
  test.afterAll(async () => {
    await adm().storage.from("property-photos").remove([caminho]);
  });

  test("a capa WebP vira JPEG de 640 px, inline, para qualquer leitor de e-mail", async ({ playwright, baseURL }) => {
    const anonimo = await playwright.request.newContext({ baseURL, storageState: { cookies: [], origins: [] } });
    const r = await anonimo.get(`/api/email/foto?p=${caminho}`, { headers: { accept: "image/webp,image/avif,*/*" } });
    expect(r.status(), await r.text().catch(() => "")).toBe(200);
    expect(r.headers()["content-type"]).toBe("image/jpeg");
    expect(r.headers()["content-disposition"] ?? "").toMatch(/^inline/);
    const corpo = await r.body();
    expect([corpo[0], corpo[1]], "bytes de JPEG (FF D8)").toEqual([0xff, 0xd8]);
    const meta = await sharp(corpo).metadata();
    expect(meta.format).toBe("jpeg");
    expect(meta.width, "largura do cartão do e-mail").toBe(LARGURA_DO_CARTAO);
    expect(meta.height, "a altura segue a proporção 1200×800").toBe(427);
    await anonimo.dispose();
  });

  test("caminho fora do formato das capas: 404 (nunca uma URL livre)", async ({ playwright, baseURL }) => {
    const anonimo = await playwright.request.newContext({ baseURL, storageState: { cookies: [], origins: [] } });
    const ruins = [
      `../${caminho}`,
      `https://example.com/${caminho}`,
      caminho.replace(/\.webp$/, ".svg"),
      caminho.split("/")[1],
      "",
    ];
    for (const p of ruins) {
      const r = await anonimo.get(`/api/email/foto?p=${encodeURIComponent(p)}`);
      expect(r.status(), `p=${p || "(vazio)"}`).toBe(404);
    }
    await anonimo.dispose();
  });
});
